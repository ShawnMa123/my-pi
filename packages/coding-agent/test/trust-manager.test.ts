import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasTrustRequiringProjectResources, ProjectTrustStore } from "../src/core/trust-manager.ts";
import { CONFIG_DIR_NAME } from "../src/config.ts";


describe("ProjectTrustStore", () => {
	let tempDir: string;
	let agentDir: string;
	let cwd: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `trust-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		cwd = join(tempDir, "project");
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(cwd, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("stores decisions and inherits from parent directories", () => {
		const store = new ProjectTrustStore(agentDir);
		const parentDir = join(tempDir, "trusted-parent");
		const childDir = join(parentDir, "project");
		mkdirSync(childDir, { recursive: true });

		expect(store.get(childDir)).toBeNull();
		store.set(parentDir, true);
		expect(store.get(childDir)).toBe(true);
		store.set(childDir, false);
		expect(store.get(childDir)).toBe(false);
		store.set(childDir, null);
		expect(store.get(childDir)).toBe(true);
	});

	it("detects trust-requiring project resources", () => {
		const originalHome = process.env.HOME;
		const originalUserProfile = process.env.USERPROFILE;
		// Keep the synthetic home under tempDir so parent walks cannot reach a real
		// user-profile ~/.agents/skills (Windows %TEMP% lives under the profile).
		const isolatedHome = join(tempDir, "home");
		const isolatedProject = join(tempDir, "project");
		mkdirSync(isolatedHome, { recursive: true });
		mkdirSync(isolatedProject, { recursive: true });
		process.env.HOME = isolatedHome;
		process.env.USERPROFILE = isolatedHome;
		try {
			mkdirSync(join(isolatedHome, CONFIG_DIR_NAME, "agent"), { recursive: true });
			mkdirSync(join(isolatedHome, ".agents", "skills"), { recursive: true });
			expect(hasTrustRequiringProjectResources(isolatedHome)).toBe(false);
			expect(hasTrustRequiringProjectResources(isolatedProject)).toBe(false);

			writeFileSync(join(isolatedHome, CONFIG_DIR_NAME, "settings.json"), "{}");
			expect(hasTrustRequiringProjectResources(isolatedHome)).toBe(true);
			rmSync(join(isolatedHome, CONFIG_DIR_NAME, "settings.json"), { force: true });

			mkdirSync(join(isolatedProject, CONFIG_DIR_NAME), { recursive: true });
			writeFileSync(join(isolatedProject, CONFIG_DIR_NAME, "settings.json"), "{}");
			expect(hasTrustRequiringProjectResources(isolatedProject)).toBe(true);

			rmSync(join(isolatedProject, CONFIG_DIR_NAME), { recursive: true, force: true });
			mkdirSync(join(isolatedProject, ".agents", "skills"), { recursive: true });
			expect(hasTrustRequiringProjectResources(isolatedProject)).toBe(true);
		} finally {
			if (originalHome === undefined) {
				delete process.env.HOME;
			} else {
				process.env.HOME = originalHome;
			}
			if (originalUserProfile === undefined) {
				delete process.env.USERPROFILE;
			} else {
				process.env.USERPROFILE = originalUserProfile;
			}
		}
	});
});
