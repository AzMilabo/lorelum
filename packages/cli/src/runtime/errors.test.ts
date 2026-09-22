import { describe, expect, test } from "bun:test";

import { createErrorDetail } from "../output/error-details.js";
import { CliError, toVisibleCliError } from "./errors.js";

const detail = createErrorDetail({
  kind: "usage",
  subject: "--top-k",
  reason: "out-of-range",
});

describe("toVisibleCliError details handling", () => {
  test("preserves details when the error code stays visible", () => {
    const error = new CliError("usage.invalid", "The command invocation is invalid.", undefined, [
      detail,
    ]);

    expect(toVisibleCliError(error, ["usage.invalid"]).details).toEqual([detail]);
  });

  test("drops details when the allowlist downgrades the code", () => {
    const error = new CliError("pack.invalid", "The Pack is invalid.", undefined, [detail]);
    const visible = toVisibleCliError(error, ["usage.invalid"]);

    expect(visible.code).toBe("runtime.unexpected");
    expect(visible.details).toBeUndefined();
  });

  test("does not fabricate details for Commander parse errors", () => {
    const commanderError = Object.assign(new Error("error: unknown option '--nope'"), {
      code: "commander.unknownOption",
    });
    const visible = toVisibleCliError(commanderError, ["usage.invalid"]);

    expect(visible.code).toBe("usage.invalid");
    expect(visible.details).toBeUndefined();
  });
});
