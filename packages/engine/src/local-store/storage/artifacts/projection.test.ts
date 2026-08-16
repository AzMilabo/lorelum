import { expect, test } from "bun:test";

import { createPackCandidate } from "../../model";
import { createProjection, parseProjection, serializeProjection } from "./projection";

test("projection records canonical source data in source-path order", () => {
  const { candidate } = createPackCandidate(
    {
      pack: { name: "platform", version: "1.0.0", applies_to: ["typescript"] },
      practices: [
        {
          id: "platform.second",
          title: "Second",
          stage: "api",
          tech_stack: ["typescript"],
          applies_when: "always",
        },
        {
          id: "platform.first",
          title: "First",
          stage: "api",
          tech_stack: ["typescript"],
          applies_when: "always",
        },
      ],
      decisions: [],
    },
    {
      "platform.second": "practices/z.md",
      "platform.first": "practices/a.md",
    },
  );
  const projection = createProjection(candidate.pack, candidate.sources, candidate.decisions);

  expect(projection.practices.map((practice) => practice.sourcePath)).toEqual([
    "practices/a.md",
    "practices/z.md",
  ]);
  expect(projection.decisions).toEqual([]);
  const parsed = parseProjection(serializeProjection(projection), "snapshot");
  expect(parsed).toEqual(projection);
  expect(Object.isFrozen(parsed.pack.applies_to)).toBe(true);
});

test("projection seals decisions verbatim and rejects invalid ones", () => {
  const { candidate } = createPackCandidate(
    {
      pack: { name: "platform", version: "1.0.0" },
      practices: [
        {
          id: "platform.api",
          title: "API",
          stage: "api",
          tech_stack: ["typescript"],
          applies_when: "always",
        },
      ],
      decisions: [
        {
          id: "state.client-vs-server",
          question: "How much client state?",
          branches: [
            {
              when: "heavy client state",
              recommend: ["platform.api"],
              reason: "Redux scales",
            },
          ],
        },
      ],
    },
    { "platform.api": "practices/api.md" },
  );
  const projection = createProjection(candidate.pack, candidate.sources, candidate.decisions);
  expect(projection.decisions).toHaveLength(1);
  const parsed = parseProjection(serializeProjection(projection), "snapshot");
  expect(parsed.decisions).toEqual(candidate.decisions);
  expect(() =>
    parseProjection(
      '{"projectionVersion":2,"pack":{"name":"platform","version":"1.0.0"},"practices":[],"decisions":[{"id":"bad"}]}',
      "snapshot",
    ),
  ).toThrow("projection decision violates schema");
});

test("projection rejects untrusted JSON shapes", () => {
  expect(() =>
    parseProjection('{"projectionVersion":2,"pack":{},"practices":[],"decisions":[]}', "snapshot"),
  ).toThrow("projection Pack metadata is invalid");
  expect(() =>
    parseProjection('{"projectionVersion":1,"pack":{},"practices":[],"decisions":[]}', "snapshot"),
  ).toThrow("unsupported shape");
  expect(() =>
    parseProjection('{"projectionVersion":2,"pack":{},"practices":[]}', "snapshot"),
  ).toThrow("decisions must be an array");
});

test("projection rejects a forged canonical payload or unsafe source metadata", () => {
  expect(() =>
    parseProjection(
      '{"projectionVersion":2,"pack":{"name":"platform","version":"1.0.0"},"practices":[{"id":"platform.api","contentDigest":"' +
        "a".repeat(64) +
        '","canonicalContent":"{}","sourcePath":"../api.md"}],"decisions":[]}',
      "snapshot",
    ),
  ).toThrow("projection canonical content violates Practice schema");
});
