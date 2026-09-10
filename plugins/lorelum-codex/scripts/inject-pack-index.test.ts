import { describe, expect, test } from "bun:test";

import {
  buildHookResponse,
  createHookResponse,
  parsePackSummaryEnvelope,
} from "./inject-pack-index";
import type { PackSummarySource } from "./types";

describe("inject-pack-index", () => {
  test("parses the provisional metadata envelope", () => {
    expect(
      parsePackSummaryEnvelope({
        ok: true,
        data: {
          packs: [{ name: "react-fullstack", version: "0.1.0", appliesTo: ["react"] }],
        },
      }),
    ).toEqual([
      { name: "react-fullstack", version: "0.1.0", appliesTo: ["react"] },
    ]);
  });

  test("rejects an invalid envelope", () => {
    expect(() => parsePackSummaryEnvelope({ ok: false })).toThrow();
  });

  test("emits additional context for both supported events", async () => {
    const source: PackSummarySource = {
      async readInstalledPackSummaries() {
        return [{ name: "agentic-coding", version: "0.1.0", appliesTo: [] }];
      },
    };

    const response = await createHookResponse({ hook_event_name: "PostCompact" }, source);
    expect(response.hookSpecificOutput?.hookEventName).toBe("PostCompact");
    expect(response.hookSpecificOutput?.additionalContext).toContain("agentic-coding");
    expect(response).toEqual(buildHookResponse("PostCompact", expect.any(String)));
  });
});
