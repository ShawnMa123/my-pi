import type { FetchFunction, ProviderHeaders } from "../types.ts";
import type { MessageCreateParamsStreaming, RawMessageStreamEvent } from "./anthropic-types.ts";

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Mirrors the shape `retryProviderRequest` expects from provider SDK errors:
 * `status` and `headers` drive retry eligibility, `retry-after` parsing, and backoff.
 */
export class AnthropicApiError extends Error {
	status: number | undefined;
	headers: Headers | undefined;

	constructor(status: number | undefined, message: string, headers: Headers | undefined) {
		super(message);
		this.name = "AnthropicApiError";
		this.status = status;
		this.headers = headers;
	}
}

export interface AnthropicRequestOptions {
	signal?: AbortSignal;
	timeout?: number;
	maxRetries?: number;
}

/**
 * Minimal client surface the messages API depends on. Alternative clients can
 * still be injected through `AnthropicOptions.client`.
 */
export interface AnthropicMessagesClient {
	messages: {
		create(
			body: MessageCreateParamsStreaming,
			options?: AnthropicRequestOptions,
		): { asResponse(): Promise<Response> };
	};
}

export interface AnthropicHttpClientOptions {
	apiKey?: string | null;
	authToken?: string | null;
	baseURL?: string;
	defaultHeaders?: ProviderHeaders;
	fetch?: FetchFunction;
}

async function toApiError(response: Response): Promise<AnthropicApiError> {
	const body = await response.text().catch(() => "");
	let detail = body;
	try {
		const parsed = JSON.parse(body) as { error?: { message?: string } };
		if (typeof parsed.error?.message === "string") detail = parsed.error.message;
	} catch {
		// Non-JSON error bodies are reported verbatim.
	}
	const message = detail ? `${response.status} ${detail}` : `${response.status} ${response.statusText}`;
	return new AnthropicApiError(response.status, message, response.headers);
}

async function* iterateSseData(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let dataLines: string[] = [];

	const flush = (): string | null => {
		if (dataLines.length === 0) return null;
		const data = dataLines.join("\n");
		dataLines = [];
		return data;
	};

	try {
		while (true) {
			if (signal?.aborted) throw new Error("Request was aborted");
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			let newlineIndex = buffer.indexOf("\n");
			while (newlineIndex !== -1) {
				let line = buffer.slice(0, newlineIndex);
				buffer = buffer.slice(newlineIndex + 1);
				if (line.endsWith("\r")) line = line.slice(0, -1);

				if (line === "") {
					const data = flush();
					if (data !== null) yield data;
				} else if (line.startsWith("data:")) {
					const valuePart = line.slice(5);
					dataLines.push(valuePart.startsWith(" ") ? valuePart.slice(1) : valuePart);
				}

				newlineIndex = buffer.indexOf("\n");
			}
		}

		buffer += decoder.decode();
		if (buffer.length > 0) {
			const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
			if (line.startsWith("data:")) {
				const valuePart = line.slice(5);
				dataLines.push(valuePart.startsWith(" ") ? valuePart.slice(1) : valuePart);
			}
		}
		const trailing = flush();
		if (trailing !== null) yield trailing;
	} finally {
		reader.releaseLock();
	}
}

/**
 * Transport-only Anthropic Messages client. Streaming responses can be consumed
 * as raw `Response` objects (`create().asResponse()`) or as parsed SSE events
 * (`stream()`).
 */
export class AnthropicHttpClient implements AnthropicMessagesClient {
	readonly messages: {
		create(
			body: MessageCreateParamsStreaming,
			options?: AnthropicRequestOptions,
		): { asResponse(): Promise<Response> };
		stream(
			body: MessageCreateParamsStreaming,
			options?: AnthropicRequestOptions,
		): AsyncGenerator<RawMessageStreamEvent>;
	};
	private readonly baseUrl: string;
	private readonly apiKey: string | null;
	private readonly authToken: string | null;
	private readonly defaultHeaders: ProviderHeaders;
	private readonly fetchImpl: FetchFunction;

	constructor(options: AnthropicHttpClientOptions) {
		this.baseUrl = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
		this.apiKey = options.apiKey ?? null;
		this.authToken = options.authToken ?? null;
		this.defaultHeaders = options.defaultHeaders ?? {};
		this.fetchImpl = options.fetch ?? globalThis.fetch;
		this.messages = {
			create: (body, requestOptions) => ({
				asResponse: () => this.createMessage(body, requestOptions),
			}),
			stream: (body, requestOptions) => this.streamEvents(body, requestOptions),
		};
	}

	private async *streamEvents(
		body: MessageCreateParamsStreaming,
		options?: AnthropicRequestOptions,
	): AsyncGenerator<RawMessageStreamEvent> {
		const response = await this.createMessage(body, options);
		if (!response.body) {
			throw new Error("Attempted to stream an Anthropic response with no body");
		}
		for await (const data of iterateSseData(response.body, options?.signal)) {
			if (!data || data === "[DONE]") continue;
			let parsed: RawMessageStreamEvent;
			try {
				parsed = JSON.parse(data) as RawMessageStreamEvent;
			} catch {
				continue;
			}
			yield parsed;
		}
	}

	private async createMessage(
		body: MessageCreateParamsStreaming,
		options?: AnthropicRequestOptions,
	): Promise<Response> {
		const headers = new Headers({
			"content-type": "application/json",
			"anthropic-version": ANTHROPIC_VERSION,
		});
		if (this.apiKey) headers.set("x-api-key", this.apiKey);
		if (this.authToken) headers.set("authorization", `Bearer ${this.authToken}`);
		for (const [name, value] of Object.entries(this.defaultHeaders)) {
			if (value === null) {
				headers.delete(name);
			} else {
				headers.set(name, value);
			}
		}

		const timeoutSignal = options?.timeout !== undefined ? AbortSignal.timeout(options.timeout) : undefined;
		const signals = [options?.signal, timeoutSignal].filter((signal) => signal !== undefined);
		const signal = signals.length > 0 ? AbortSignal.any(signals) : undefined;

		const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			signal,
		});

		if (!response.ok) throw await toApiError(response);
		return response;
	}
}
