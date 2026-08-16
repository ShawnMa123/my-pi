/**
 * Minimal Anthropic Messages API types used by pi-ai.
 * Kept local so @anthropic-ai/sdk is not an install/runtime dependency.
 */

export type CacheControlEphemeral = {
	type: "ephemeral";
	ttl?: "5m" | "1h";
};

export type TextBlockParam = {
	type: "text";
	text: string;
	cache_control?: CacheControlEphemeral;
};

export type ImageBlockParam = {
	type: "image";
	source: {
		type: "base64";
		media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
		data: string;
	};
	cache_control?: CacheControlEphemeral;
};

export type ToolUseBlockParam = {
	type: "tool_use";
	id: string;
	name: string;
	input: unknown;
	cache_control?: CacheControlEphemeral;
};

export type ToolReferenceBlockParam = {
	type: "tool_reference";
	tool_name: string;
};

export type ToolResultBlockParam = {
	type: "tool_result";
	tool_use_id: string;
	content?: string | Array<TextBlockParam | ImageBlockParam | ToolReferenceBlockParam>;
	is_error?: boolean;
	cache_control?: CacheControlEphemeral;
};

export type ThinkingBlockParam = {
	type: "thinking";
	thinking: string;
	signature: string;
};

export type RedactedThinkingBlockParam = {
	type: "redacted_thinking";
	data: string;
};

export type ContentBlockParam =
	| TextBlockParam
	| ImageBlockParam
	| ToolUseBlockParam
	| ToolResultBlockParam
	| ToolReferenceBlockParam
	| ThinkingBlockParam
	| RedactedThinkingBlockParam;

export type MessageParam = {
	role: "user" | "assistant";
	content: string | ContentBlockParam[];
};

export type AnthropicToolDefinition = {
	name: string;
	description?: string;
	input_schema: Record<string, unknown>;
	eager_input_streaming?: boolean;
	strict?: boolean;
	defer_loading?: boolean;
	cache_control?: CacheControlEphemeral;
};

export type AnthropicThinkingDisplay = "summarized" | "omitted";

export type MessageCreateParamsStreaming = {
	model: string;
	messages: MessageParam[];
	max_tokens: number;
	stream: true;
	system?: string | TextBlockParam[];
	temperature?: number;
	tools?: AnthropicToolDefinition[];
	tool_choice?: { type: "auto" | "any" | "none" | "tool"; name?: string };
	thinking?:
		| { type: "adaptive"; display?: AnthropicThinkingDisplay }
		| { type: "enabled"; budget_tokens: number; display?: AnthropicThinkingDisplay }
		| { type: "disabled" };
	output_config?: { effort?: string };
	metadata?: { user_id?: string };
};

export type AnthropicStopReason =
	| "end_turn"
	| "max_tokens"
	| "stop_sequence"
	| "tool_use"
	| "pause_turn"
	| "refusal"
	| "sensitive"
	| string;

export type RefusalStopDetails = {
	explanation?: string;
};

export type AnthropicUsage = {
	input_tokens?: number | null;
	output_tokens?: number | null;
	cache_read_input_tokens?: number | null;
	cache_creation_input_tokens?: number | null;
	cache_creation?: {
		ephemeral_1h_input_tokens?: number;
		ephemeral_5m_input_tokens?: number;
	};
	output_tokens_details?: { thinking_tokens?: number };
};

export type RawMessageStreamEvent =
	| {
			type: "message_start";
			message: {
				id: string;
				usage: AnthropicUsage;
			};
	  }
	| {
			type: "message_delta";
			delta: {
				stop_reason?: AnthropicStopReason | null;
				stop_details?: RefusalStopDetails | null;
			};
			usage?: AnthropicUsage | null;
	  }
	| { type: "message_stop" }
	| {
			type: "content_block_start";
			index: number;
			content_block:
				| { type: "text"; text?: string }
				| { type: "thinking"; thinking?: string; signature?: string }
				| { type: "redacted_thinking"; data: string }
				| { type: "tool_use"; id: string; name: string; input?: unknown };
	  }
	| {
			type: "content_block_delta";
			index: number;
			delta:
				| { type: "text_delta"; text: string }
				| { type: "thinking_delta"; thinking: string }
				| { type: "input_json_delta"; partial_json: string }
				| { type: "signature_delta"; signature: string };
	  }
	| { type: "content_block_stop"; index: number };
