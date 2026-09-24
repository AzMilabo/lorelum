import type { JsonSchema } from "./protocol.js";

/** Categories of structured diagnostic facts a public failure may expose. */
export const errorDetailKinds = ["usage", "configuration"] as const;
export type ErrorDetailKind = (typeof errorDetailKinds)[number];

/** Small, stable reason vocabulary owned by this contract. */
export const errorDetailReasons = [
  "missing",
  "invalid-type",
  "invalid-value",
  "out-of-range",
  "conflicting-options",
  "unknown-option",
  "unknown-command",
  "unknown-key",
  "syntax",
] as const;
export type ErrorDetailReason = (typeof errorDetailReasons)[number];

/** What the owning validator already verified about the accepted input. */
export type ErrorDetailExpected =
  | { readonly kind: "enum"; readonly values: readonly string[] }
  | { readonly kind: "integer-range"; readonly min: number; readonly max: number }
  | { readonly kind: "type"; readonly name: string };

/** One validator-owned diagnostic fact attached to a public failure. */
export interface ErrorDetail {
  readonly kind: ErrorDetailKind;
  readonly subject: string;
  readonly reason: ErrorDetailReason;
  readonly received?: string;
  readonly expected?: ErrorDetailExpected;
  readonly hint?: string;
}

/**
 * Output budgets for public details. `createErrorDetail` enforces them so every
 * emitted detail validates against `errorDetailSchema`.
 */
export const errorDetailBudgets = Object.freeze({
  maxDetails: 5,
  subjectMaxLength: 120,
  receivedMaxLength: 120,
  hintMaxLength: 200,
  enumValuesMax: 16,
  enumValueMaxLength: 64,
  typeNameMaxLength: 64,
});

/**
 * Builds a budget-constrained detail. Producers must construct details only
 * through this factory: it truncates deterministically (by Unicode code point)
 * and drops empty optional strings, so identical input always yields identical
 * output and the result always satisfies the public schema.
 */
export function createErrorDetail(input: ErrorDetail): ErrorDetail {
  if (input.subject.length === 0) throw new TypeError("Error detail subject must not be empty.");
  const received = optionalText(input.received);
  const hint = optionalText(input.hint);
  return Object.freeze({
    kind: input.kind,
    subject: truncate(input.subject, errorDetailBudgets.subjectMaxLength),
    reason: input.reason,
    ...(received === undefined
      ? {}
      : { received: truncate(received, errorDetailBudgets.receivedMaxLength) }),
    ...(input.expected === undefined ? {} : { expected: constrainExpected(input.expected) }),
    ...(hint === undefined ? {} : { hint: truncate(hint, errorDetailBudgets.hintMaxLength) }),
  });
}

/** Caps a detail list to the public output budget, preserving producer order. */
export function capErrorDetails(details: readonly ErrorDetail[]): readonly ErrorDetail[] {
  return details.length <= errorDetailBudgets.maxDetails
    ? details
    : details.slice(0, errorDetailBudgets.maxDetails);
}

/**
 * Compresses one detail into a single actionable line for text output. The
 * `--json` envelope carries the structure; this renders the same facts for
 * people without parsing the message.
 */
export function formatErrorDetail(detail: ErrorDetail): string {
  const subject = escapeTerminalControls(detail.subject);
  const received =
    detail.received === undefined ? "" : ` (received: ${escapeTerminalControls(detail.received)})`;
  const core =
    detail.expected === undefined
      ? detail.reason === "missing"
        ? `${subject} is required`
        : `${subject} was rejected (${detail.reason})`
      : `${subject} ${expectedClause(detail.expected)}`;
  const statement = `${core}${received}.`;
  return detail.hint === undefined
    ? statement
    : `${statement} ${escapeTerminalControls(detail.hint)}`;
}

/** JSON Schema for one detail entry; composed into the public failure schema. */
export const errorDetailSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "subject", "reason"],
  properties: {
    kind: { enum: [...errorDetailKinds] },
    subject: { type: "string", minLength: 1, maxLength: errorDetailBudgets.subjectMaxLength },
    reason: { enum: [...errorDetailReasons] },
    received: { type: "string", maxLength: errorDetailBudgets.receivedMaxLength },
    hint: { type: "string", maxLength: errorDetailBudgets.hintMaxLength },
    expected: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "values"],
          properties: {
            kind: { const: "enum" },
            values: {
              type: "array",
              minItems: 1,
              maxItems: errorDetailBudgets.enumValuesMax,
              items: {
                type: "string",
                minLength: 1,
                maxLength: errorDetailBudgets.enumValueMaxLength,
              },
            },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "min", "max"],
          properties: {
            kind: { const: "integer-range" },
            min: { type: "integer" },
            max: { type: "integer" },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "name"],
          properties: {
            kind: { const: "type" },
            name: { type: "string", minLength: 1, maxLength: errorDetailBudgets.typeNameMaxLength },
          },
        },
      ],
    },
  },
} as const satisfies JsonSchema;

function expectedClause(expected: ErrorDetailExpected): string {
  switch (expected.kind) {
    case "enum":
      return `must be one of: ${expected.values.map(escapeTerminalControls).join(", ")}`;
    case "integer-range":
      return `must be an integer from ${expected.min} through ${expected.max}`;
    case "type":
      return `must be of type ${escapeTerminalControls(expected.name)}`;
  }
}

/** Keeps untrusted detail text printable when written directly to a terminal. */
function escapeTerminalControls(value: string): string {
  return [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      if (!isTerminalControl(codePoint)) return character;

      switch (character) {
        case "\n":
          return "\\n";
        case "\r":
          return "\\r";
        case "\t":
          return "\\t";
        default:
          return `\\u${codePoint.toString(16).padStart(4, "0")}`;
      }
    })
    .join("");
}

function isTerminalControl(codePoint: number): boolean {
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    (codePoint >= 0x2028 && codePoint <= 0x2029) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  );
}

function constrainExpected(expected: ErrorDetailExpected): ErrorDetailExpected {
  switch (expected.kind) {
    case "enum": {
      const values = expected.values
        .filter((value) => value.length > 0)
        .slice(0, errorDetailBudgets.enumValuesMax)
        .map((value) => truncate(value, errorDetailBudgets.enumValueMaxLength));
      if (values.length === 0) throw new TypeError("Enum expectations need at least one value.");
      return Object.freeze({ kind: "enum", values: Object.freeze(values) });
    }
    case "integer-range": {
      if (
        !Number.isSafeInteger(expected.min) ||
        !Number.isSafeInteger(expected.max) ||
        expected.min > expected.max
      ) {
        throw new TypeError("Integer-range expectations need safe, ordered bounds.");
      }
      return Object.freeze({ kind: "integer-range", min: expected.min, max: expected.max });
    }
    case "type": {
      if (expected.name.length === 0) throw new TypeError("Type expectations need a name.");
      return Object.freeze({
        kind: "type",
        name: truncate(expected.name, errorDetailBudgets.typeNameMaxLength),
      });
    }
  }
}

function optionalText(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}

/**
 * Bounds a detail string to its budget. Real CR/LF characters are escaped to
 * their literal two-character form first, so a multi-line received value can
 * never break the one-line-per-detail text rendering — in either format.
 */
function truncate(value: string, maxLength: number): string {
  const singleLine = value.replace(/\r/gu, "\\r").replace(/\n/gu, "\\n");
  const codePoints = [...singleLine];
  return codePoints.length <= maxLength
    ? singleLine
    : `${codePoints.slice(0, maxLength - 3).join("")}...`;
}
