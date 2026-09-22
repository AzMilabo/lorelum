import { expect, test } from "bun:test";

import { createErrorDetail } from "./error-details.js";
import { protocolResponseSchema, toolVersion } from "./protocol.js";
import { renderResult } from "./render.js";
import { validateProtocolSchema } from "./protocol-schema.test-helper.js";

class MemoryWriter {
  value = "";

  write(message: string): void {
    this.value += message;
  }
}

test("renders JSON success as the complete existing protocol envelope", () => {
  const writer = new MemoryWriter();

  renderResult(writer, "json", {
    kind: "success",
    command: "fixture.success",
    data: { source: { id: "source-1" }, values: [1, null] },
    diagnostics: { traceId: "00000000-0000-4000-8000-000000000001" as never },
  });

  const response = JSON.parse(writer.value);
  expect(response).toEqual({
    protocolVersion: 2,
    toolVersion,
    command: "fixture.success",
    diagnostics: { traceId: "00000000-0000-4000-8000-000000000001" },
    ok: true,
    data: { source: { id: "source-1" }, values: [1, null] },
  });
  expect(validateProtocolSchema(response, protocolResponseSchema)).toEqual([]);
});

test("renders complete default text without a command-specific projection", () => {
  const writer = new MemoryWriter();

  renderResult(writer, "text", {
    kind: "success",
    command: "fixture.success",
    data: { state: "partial", operationId: "operation-1", warnings: [] },
  });

  expect(writer.value).toBe(`state: partial
operationId: operation-1
warnings: []
`);
});

test("custom layout receives the complete data and pure fallback", () => {
  const writer = new MemoryWriter();

  renderResult(writer, "text", {
    kind: "success",
    command: "fixture.custom",
    data: { title: "Readable", source: { id: "source-1" } },
    textRenderer: (data, fallback) => `Heading: Readable\n${fallback(data)}`,
  });

  expect(writer.value).toContain("Heading: Readable");
  expect(writer.value).toContain("source:");
  expect(writer.value).toContain("id: source-1");
});

test("renders a default text error with every public error field", () => {
  const writer = new MemoryWriter();

  renderResult(writer, "text", {
    kind: "failure",
    command: "query",
    code: "backend.build-mismatch",
    message: "A different Lorelum build owns the local backend.",
    recovery: {
      action: "backend.stop-if-idle",
      automation: "auto",
      reason: "idle",
      retry: "original-command",
    },
    diagnostics: { traceId: "00000000-0000-4000-8000-000000000002" as never },
  });

  expect(writer.value).toBe(`error:
  code: backend.build-mismatch
  message: A different Lorelum build owns the local backend.
  recovery:
    action: backend.stop-if-idle
    automation: auto
    reason: idle
    retry: original-command
diagnostics:
  traceId: 00000000-0000-4000-8000-000000000002
`);
});

test("renders failure details as structured JSON and compressed text", () => {
  const detail = createErrorDetail({
    kind: "usage",
    subject: "--min-coverage-percent",
    reason: "out-of-range",
    received: "101",
    expected: { kind: "integer-range", min: 0, max: 100 },
  });

  const jsonWriter = new MemoryWriter();
  renderResult(jsonWriter, "json", {
    kind: "failure",
    command: "query",
    code: "usage.invalid",
    message: "The command invocation is invalid.",
    details: [detail],
    diagnostics: { traceId: "00000000-0000-4000-8000-000000000004" as never },
  });
  const response = JSON.parse(jsonWriter.value);
  expect(response.error.details).toEqual([
    {
      kind: "usage",
      subject: "--min-coverage-percent",
      reason: "out-of-range",
      received: "101",
      expected: { kind: "integer-range", min: 0, max: 100 },
    },
  ]);
  expect(validateProtocolSchema(response, protocolResponseSchema)).toEqual([]);

  const textWriter = new MemoryWriter();
  renderResult(textWriter, "text", {
    kind: "failure",
    command: "query",
    code: "usage.invalid",
    message: "The command invocation is invalid.",
    details: [detail],
    diagnostics: { traceId: "00000000-0000-4000-8000-000000000004" as never },
  });
  expect(textWriter.value).toBe(`error:
  code: usage.invalid
  message: The command invocation is invalid.
  details:
    - --min-coverage-percent must be an integer from 0 through 100 (received: 101).
diagnostics:
  traceId: 00000000-0000-4000-8000-000000000004
`);
});

test("renders JSON failures as one envelope with the supplied trace", () => {
  const writer = new MemoryWriter();

  renderResult(writer, "json", {
    kind: "failure",
    command: "query",
    code: "backend.unavailable",
    message: "The local backend is unavailable.",
    diagnostics: { traceId: "00000000-0000-4000-8000-000000000003" as never },
  });

  expect(JSON.parse(writer.value)).toMatchObject({
    command: "query",
    ok: false,
    diagnostics: { traceId: "00000000-0000-4000-8000-000000000003" },
    error: { code: "backend.unavailable" },
  });
  expect(writer.value.split("\n")).toEqual([expect.any(String), ""]);
});

test("rejects non-JSON-safe data before writing either format", () => {
  const writer = new MemoryWriter();
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  expect(() =>
    renderResult(writer, "text", {
      kind: "success",
      command: "invalid",
      data: circular as never,
    }),
  ).toThrow();
  expect(writer.value).toBe("");
});
