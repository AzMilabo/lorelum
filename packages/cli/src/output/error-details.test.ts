import { describe, expect, test } from "bun:test";

import {
  capErrorDetails,
  createErrorDetail,
  errorDetailBudgets,
  errorDetailSchema,
  formatErrorDetail,
  type ErrorDetail,
} from "./error-details.js";
import { validateJsonSchema } from "./protocol-schema.test-helper.js";

describe("createErrorDetail budgets", () => {
  test("passes through facts that already fit the budgets", () => {
    const detail = createErrorDetail({
      kind: "usage",
      subject: "--min-coverage-percent",
      reason: "out-of-range",
      received: "101",
      expected: { kind: "integer-range", min: 0, max: 100 },
    });

    expect(detail).toEqual({
      kind: "usage",
      subject: "--min-coverage-percent",
      reason: "out-of-range",
      received: "101",
      expected: { kind: "integer-range", min: 0, max: 100 },
    });
    expect(Object.isFrozen(detail)).toBe(true);
    expect(validateJsonSchema(detail, errorDetailSchema)).toEqual([]);
  });

  test("truncates over-budget strings deterministically by code point", () => {
    const longSubject = "a".repeat(200);
    const multibyteReceived = "あ".repeat(200);
    const first = createErrorDetail({
      kind: "configuration",
      subject: longSubject,
      reason: "syntax",
      received: multibyteReceived,
      hint: "h".repeat(500),
    });
    const second = createErrorDetail({
      kind: "configuration",
      subject: longSubject,
      reason: "syntax",
      received: multibyteReceived,
      hint: "h".repeat(500),
    });

    expect(first.subject).toHaveLength(errorDetailBudgets.subjectMaxLength);
    expect(first.subject?.endsWith("...")).toBe(true);
    expect([...first.subject!].slice(0, -3).every((point) => point === "a")).toBe(true);
    expect(first.received).toHaveLength(errorDetailBudgets.receivedMaxLength);
    expect(first.hint).toHaveLength(errorDetailBudgets.hintMaxLength);
    expect(first).toEqual(second);
    expect(validateJsonSchema(first, errorDetailSchema)).toEqual([]);
  });

  test("drops empty optional strings and caps enum values", () => {
    const detail = createErrorDetail({
      kind: "usage",
      subject: "--mode",
      reason: "invalid-value",
      received: "",
      expected: {
        kind: "enum",
        values: ["semantic", "keyword", "", ...Array.from({ length: 40 }, (_, i) => `mode-${i}`)],
      },
      hint: "",
    });

    expect(detail.received).toBeUndefined();
    expect(detail.hint).toBeUndefined();
    expect(detail.expected).toEqual({
      kind: "enum",
      values: ["semantic", "keyword", ...Array.from({ length: 14 }, (_, i) => `mode-${i}`)],
    });
    expect(validateJsonSchema(detail, errorDetailSchema)).toEqual([]);
  });

  test("rejects structurally invalid producer input", () => {
    expect(() => createErrorDetail({ kind: "usage", subject: "", reason: "missing" })).toThrow();
    expect(() =>
      createErrorDetail({
        kind: "usage",
        subject: "--x",
        reason: "invalid-value",
        expected: { kind: "enum", values: [] },
      }),
    ).toThrow();
    expect(() =>
      createErrorDetail({
        kind: "usage",
        subject: "--x",
        reason: "invalid-value",
        expected: { kind: "enum", values: [""] },
      }),
    ).toThrow();
    expect(() =>
      createErrorDetail({
        kind: "usage",
        subject: "--x",
        reason: "out-of-range",
        expected: { kind: "integer-range", min: 100, max: 0 },
      }),
    ).toThrow();
    expect(() =>
      createErrorDetail({
        kind: "usage",
        subject: "--x",
        reason: "out-of-range",
        expected: { kind: "integer-range", min: Number.NaN, max: 10 },
      }),
    ).toThrow();
    expect(() =>
      createErrorDetail({
        kind: "usage",
        subject: "--x",
        reason: "invalid-type",
        expected: { kind: "type", name: "" },
      }),
    ).toThrow();
  });

  test("capErrorDetails preserves producer order up to the budget", () => {
    const details = Array.from({ length: 8 }, (_, index) =>
      createErrorDetail({ kind: "usage", subject: `--option-${index}`, reason: "missing" }),
    );

    expect(capErrorDetails(details)).toHaveLength(errorDetailBudgets.maxDetails);
    expect(capErrorDetails(details.slice(0, 2))).toEqual(details.slice(0, 2));
  });
});

describe("formatErrorDetail text compression", () => {
  test("renders expected facts with received values", () => {
    expect(
      formatErrorDetail(
        createErrorDetail({
          kind: "usage",
          subject: "--min-coverage-percent",
          reason: "out-of-range",
          received: "101",
          expected: { kind: "integer-range", min: 0, max: 100 },
        }),
      ),
    ).toBe("--min-coverage-percent must be an integer from 0 through 100 (received: 101).");
  });

  test("renders enum, type, and missing variants", () => {
    expect(
      formatErrorDetail(
        createErrorDetail({
          kind: "usage",
          subject: "--mode",
          reason: "invalid-value",
          received: "typo",
          expected: { kind: "enum", values: ["semantic", "keyword"] },
        }),
      ),
    ).toBe("--mode must be one of: semantic, keyword (received: typo).");
    expect(
      formatErrorDetail(
        createErrorDetail({
          kind: "configuration",
          subject: "query.maxWaitMs",
          reason: "invalid-type",
          received: "nope",
          expected: { kind: "type", name: "integer" },
        }),
      ),
    ).toBe("query.maxWaitMs must be of type integer (received: nope).");
    expect(
      formatErrorDetail(createErrorDetail({ kind: "usage", subject: "text", reason: "missing" })),
    ).toBe("text is required.");
  });

  test("falls back to the reason and appends hints", () => {
    expect(
      formatErrorDetail(
        createErrorDetail({ kind: "configuration", subject: "config.yaml", reason: "syntax" }),
      ),
    ).toBe("config.yaml was rejected (syntax).");
    expect(
      formatErrorDetail(
        createErrorDetail({
          kind: "configuration",
          subject: "query.maxWaitMs",
          reason: "invalid-type",
          received: "nope",
          expected: { kind: "integer-range", min: 0, max: 120_000 },
          hint: "Fix or remove this setting in ~/.lorelum/config.yaml.",
        }),
      ),
    ).toBe(
      "query.maxWaitMs must be an integer from 0 through 120000 (received: nope). Fix or remove this setting in ~/.lorelum/config.yaml.",
    );
  });

  test("documents the secret no-echo policy: producers omit received, keep locator facts", () => {
    // A protocol-marked secret value MUST NOT be handed to the transport as
    // `received`; the producer still reports subject, reason, and a fix hint so
    // callers can locate the field without the value itself.
    const secretDetail = createErrorDetail({
      kind: "usage",
      subject: "--private-token",
      reason: "missing",
      hint: "Provide the token through the documented environment channel.",
    });

    expect("received" in secretDetail).toBe(false);
    expect(validateJsonSchema(secretDetail, errorDetailSchema)).toEqual([]);
    expect(formatErrorDetail(secretDetail)).toBe(
      "--private-token is required. Provide the token through the documented environment channel.",
    );
  });
});

describe("errorDetailSchema closure", () => {
  const base: ErrorDetail = createErrorDetail({
    kind: "usage",
    subject: "--top-k",
    reason: "out-of-range",
    received: "0",
    expected: { kind: "integer-range", min: 1, max: 50 },
  });

  test("rejects undefined properties, kinds, reasons, and expected variants", () => {
    expect(validateJsonSchema({ ...base, extra: true }, errorDetailSchema)).not.toEqual([]);
    expect(validateJsonSchema({ ...base, kind: "runtime" }, errorDetailSchema)).not.toEqual([]);
    expect(validateJsonSchema({ ...base, reason: "too-big" }, errorDetailSchema)).not.toEqual([]);
    expect(
      validateJsonSchema(
        { ...base, expected: { kind: "string-range", min: 1, max: 5 } },
        errorDetailSchema,
      ),
    ).not.toEqual([]);
    expect(
      validateJsonSchema({ kind: "usage", subject: "--x", reason: "missing" }, errorDetailSchema),
    ).toEqual([]);
  });

  test("rejects over-budget strings and non-integer bounds", () => {
    expect(
      validateJsonSchema(
        { ...base, subject: "a".repeat(errorDetailBudgets.subjectMaxLength + 1) },
        errorDetailSchema,
      ),
    ).not.toEqual([]);
    expect(
      validateJsonSchema(
        { ...base, expected: { kind: "integer-range", min: 0.5, max: 10 } },
        errorDetailSchema,
      ),
    ).not.toEqual([]);
    expect(
      validateJsonSchema(
        {
          ...base,
          expected: {
            kind: "enum",
            values: Array.from({ length: errorDetailBudgets.enumValuesMax + 1 }, (_, i) => `v${i}`),
          },
        },
        errorDetailSchema,
      ),
    ).not.toEqual([]);
  });
});
