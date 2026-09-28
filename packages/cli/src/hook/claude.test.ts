import { describe, expect, test } from "bun:test";
import type { ListPackDetailsResult } from "@lorelum/engine";

import {
  parseClaudeHookInvocation,
  runClaudeHook,
  type ClaudeHookServices,
  type TextInput,
} from "./claude.js";
import { parseCodexHookInvocation } from "./codex.js";
import { parseZcodeHookInvocation } from "./zcode.js";

class MemoryWriter {
  value = "";

  write(message: string): void {
    this.value += message;
  }
}

const details: ListPackDetailsResult = {
  generation: 1,
  effectiveRevision: 2,
  packs: [
    {
      name: "agentic-coding",
      version: "0.1.0",
      packRoot: "/private/store/packs/p-agentic-coding/current",
      description: "Engineering guidance.",
      applies_to: ["typescript"],
    },
  ],
};

function input(value: string): TextInput {
  return {
    async text() {
      return value;
    },
  };
}

function services(overrides: Partial<ClaudeHookServices> = {}): ClaudeHookServices {
  return {
    list: {
      async listPackDetails() {
        return details;
      },
    },
    storageRoot: { rootPath: "/default-store" },
    ...overrides,
  };
}

describe("lore hook claude", () => {
  test("renders the current Catalog through the raw Claude Code Hook envelope", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    await expect(
      runClaudeHook({
        stdin: input('{"hook_event_name":"SessionStart"}'),
        stdout,
        stderr,
        services: services(),
      }),
    ).resolves.toBe(0);

    expect(stderr.value).toBe("");
    expect(JSON.parse(stdout.value)).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: expect.stringContaining("Engineering guidance."),
      },
    });
    expect(stdout.value).toContain("Pack root: /private/store/packs/p-agentic-coding/current");
  });

  test.each([
    ["malformed JSON", "{"],
    ["non-object payload", "[]"],
    ["unsupported event", '{"hook_event_name":"PostCompact"}'],
  ])("degrades for %s", async (_label, payload) => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();

    await expect(
      runClaudeHook({ stdin: input(payload), stdout, stderr, services: services() }),
    ).resolves.toBe(0);

    expect(stdout.value).toBe('{"continue":true}\n');
    expect(stderr.value).toMatch(/^lore hook claude degraded: /);
  });

  test("degrades when the selected Store cannot provide Pack details", async () => {
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const failing = services({
      list: {
        async listPackDetails() {
          throw new Error("Store is unavailable.");
        },
      },
    });

    await expect(
      runClaudeHook({
        stdin: input('{"hook_event_name":"SessionStart"}'),
        stdout,
        stderr,
        services: failing,
      }),
    ).resolves.toBe(0);

    expect(stdout.value).toBe('{"continue":true}\n');
    expect(stderr.value).toContain("Store is unavailable.");
  });

  test("accepts the global Store override before or after the raw Hook command", () => {
    expect(parseClaudeHookInvocation(["hook", "claude", "--store-root", "isolated-store"])).toEqual(
      {
        storeRoot: "isolated-store",
      },
    );
    expect(parseClaudeHookInvocation(["--store-root=isolated-store", "hook", "claude"])).toEqual({
      storeRoot: "isolated-store",
    });
    expect(parseClaudeHookInvocation(["hook", "claude", "extra"])).toBeUndefined();
  });

  test("keeps the claude, codex, and zcode raw Hook invocations disjoint", () => {
    expect(parseClaudeHookInvocation(["hook", "codex"])).toBeUndefined();
    expect(parseClaudeHookInvocation(["hook", "zcode"])).toBeUndefined();
    expect(parseCodexHookInvocation(["hook", "claude"])).toBeUndefined();
    expect(parseZcodeHookInvocation(["hook", "claude"])).toBeUndefined();
  });
});
