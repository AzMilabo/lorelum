import { expect, test } from "bun:test";

import { createErrorDetail, errorDetailBudgets } from "./error-details.js";
import {
  createFailureEnvelope,
  createSuccessEnvelope,
  protocolResponseSchema,
  protocolVersion,
  toolVersion,
} from "./protocol.js";
import goldenEnvelopes from "./protocol-envelope.fixture.json";
import { validateProtocolSchema } from "./protocol-schema.test-helper.js";

const traceId = "00000000-0000-4000-8000-000000000001" as never;

test("creates structured protocol success envelopes", () => {
  const response = createSuccessEnvelope("describe", { name: "lore" }, { traceId });

  expect(response).toEqual({
    protocolVersion,
    toolVersion,
    command: "describe",
    diagnostics: { traceId },
    ok: true,
    data: { name: "lore" },
  });
  expect(validateProtocolSchema(response, protocolResponseSchema)).toEqual([]);
});

test("rejects non-JSON-safe success data before rendering", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const invalidValues: unknown[] = [
    undefined,
    { nested: undefined },
    Number.NaN,
    1n,
    new Date(0),
    circular,
  ];

  for (const value of invalidValues) {
    expect(() => createSuccessEnvelope("invalid", value as never, { traceId })).toThrow();
  }
});

test("creates structured protocol failures", () => {
  const response = createFailureEnvelope(
    "unknown",
    "usage.invalid",
    "The command invocation is invalid.",
    undefined,
    { traceId },
  );

  expect(response).toMatchObject({
    protocolVersion,
    command: "unknown",
    diagnostics: { traceId },
    ok: false,
    error: { code: "usage.invalid" },
  });
  expect(validateProtocolSchema(response, protocolResponseSchema)).toEqual([]);
});

test("creates optional machine recovery without widening unrelated failures", () => {
  const response = createFailureEnvelope(
    "query",
    "backend.build-mismatch",
    "A different Lorelum build owns the local backend.",
    {
      action: "backend.stop-if-idle",
      automation: "auto",
      reason: "idle",
      retry: "original-command",
    },
    { traceId },
  );
  expect(response).toMatchObject({
    error: {
      code: "backend.build-mismatch",
      recovery: {
        action: "backend.stop-if-idle",
        automation: "auto",
        reason: "idle",
        retry: "original-command",
      },
    },
  });
  expect(validateProtocolSchema(response, protocolResponseSchema)).toEqual([]);
});

const configurationDetail = createErrorDetail({
  kind: "configuration",
  subject: "query.maxWaitMs",
  reason: "invalid-type",
  received: "nope",
  expected: { kind: "integer-range", min: 0, max: 120_000 },
  hint: "Fix or remove query.maxWaitMs in ~/.lorelum/config.yaml.",
});

test("creates failures carrying validator-owned details", () => {
  const response = createFailureEnvelope(
    "query",
    "query.config-invalid",
    "The query configuration is invalid.",
    undefined,
    { traceId },
    [configurationDetail],
  );

  expect(response.error.details).toEqual([configurationDetail]);
  expect(validateProtocolSchema(response, protocolResponseSchema)).toEqual([]);
});

test("omits empty detail lists and caps over-budget lists", () => {
  expect(
    createFailureEnvelope("query", "usage.invalid", "m", undefined, { traceId }, []).error.details,
  ).toBeUndefined();

  const repeated = createErrorDetail({ kind: "usage", subject: "--x", reason: "missing" });
  const capped = createFailureEnvelope("query", "usage.invalid", "m", undefined, { traceId }, [
    ...Array.from({ length: errorDetailBudgets.maxDetails + 3 }, () => repeated),
  ]);
  expect(capped.error.details).toHaveLength(errorDetailBudgets.maxDetails);
  expect(validateProtocolSchema(capped, protocolResponseSchema)).toEqual([]);
});

test("rejects malformed details with the exported JSON Schema", () => {
  const base = createFailureEnvelope("query", "usage.invalid", "m", undefined, { traceId }, [
    createErrorDetail({
      kind: "usage",
      subject: "--top-k",
      reason: "out-of-range",
      received: "0",
      expected: { kind: "integer-range", min: 1, max: 50 },
    }),
  ]);

  const mutate = (path: (error: Record<string, unknown>) => void): unknown => {
    const clone = JSON.parse(JSON.stringify(base)) as typeof base;
    path(clone.error);
    return clone;
  };

  expect(
    validateProtocolSchema(
      mutate((error) => {
        (error.details as Record<string, unknown>[])[0]!.unexpected = true;
      }),
      protocolResponseSchema,
    ),
  ).not.toEqual([]);
  expect(
    validateProtocolSchema(
      mutate((error) => {
        (error.details as Record<string, unknown>[])[0]!.kind = "runtime";
      }),
      protocolResponseSchema,
    ),
  ).not.toEqual([]);
  expect(
    validateProtocolSchema(
      mutate((error) => {
        (error.details as Record<string, unknown>[])[0]!.reason = "too-big";
      }),
      protocolResponseSchema,
    ),
  ).not.toEqual([]);
  expect(
    validateProtocolSchema(
      mutate((error) => {
        (error.details as Record<string, unknown>[])[0]!.expected = { kind: "range", min: 1 };
      }),
      protocolResponseSchema,
    ),
  ).not.toEqual([]);
  expect(
    validateProtocolSchema(
      mutate((error) => (error.details = [])),
      protocolResponseSchema,
    ),
  ).not.toEqual([]);
});

test("validates independent golden envelopes with the exported envelope schema", () => {
  for (const response of goldenEnvelopes) {
    expect(response.toolVersion).toBe(toolVersion);
    expect(response.command).toStartWith("fixture.");
    expect(validateProtocolSchema(response, protocolResponseSchema)).toEqual([]);
  }
});

test("rejects malformed envelopes with the exported JSON Schema", () => {
  expect(
    validateProtocolSchema(
      { protocolVersion, toolVersion, command: "describe", ok: true },
      protocolResponseSchema,
    ),
  ).not.toEqual([]);
  expect(
    validateProtocolSchema(
      {
        protocolVersion: 1,
        toolVersion,
        command: "describe",
        diagnostics: { traceId },
        ok: true,
        data: {},
        extra: true,
      },
      protocolResponseSchema,
    ),
  ).not.toEqual([]);
});
