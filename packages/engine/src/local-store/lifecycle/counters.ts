import { StoreCounterExhaustedError } from "./errors";

/** Increment one persisted monotonic counter without crossing JS's exact-integer boundary. */
export function nextStoreCounter(
  value: number,
  counter: "generation" | "effectiveRevision",
): number {
  if (!Number.isSafeInteger(value) || value < 0 || value === Number.MAX_SAFE_INTEGER) {
    throw new StoreCounterExhaustedError(counter);
  }
  return value + 1;
}
