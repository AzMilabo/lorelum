import { expect, test } from "bun:test";
import { BackendError, type BackendErrorDetail } from "@lorelum/backend/protocol";

import type { ErrorDetail } from "../output/error-details.js";
import type { CommandInvocation } from "../registry.js";
import { lifecycleCommand } from "./common.js";

const detail: BackendErrorDetail = {
  kind: "configuration",
  subject: "backend.requestTimeoutMs",
  reason: "out-of-range",
  received: "0",
  expected: { kind: "integer-range", min: 1, max: 120_000 },
  hint: "Fix or remove this setting in ~/.lorelum/config.yaml.",
};
// The backend and CLI contracts declare structurally identical detail shapes;
// this assignment fails to compile if the mirrors drift apart.
const mirroredDetail: ErrorDetail = detail;

test("lifecycle commands preserve BackendError details through the CliError mapping", async () => {
  const command = lifecycleCommand({
    name: "backend.fixture",
    summary: "Fixture command.",
    resultSchema: { type: "object" },
    errorCodes: ["backend.config-invalid"],
    execute: () =>
      Promise.reject(
        new BackendError("backend.config-invalid", undefined, undefined, [mirroredDetail]),
      ),
  });

  await expect(command.handler({} as CommandInvocation)).rejects.toMatchObject({
    name: "CliError",
    code: "backend.config-invalid",
    details: [mirroredDetail],
  });
});
