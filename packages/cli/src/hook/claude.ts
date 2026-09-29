import type { ListPackDetailsResult } from "@lorelum/engine";
import type { Logger } from "@lorelum/log";

import type { OutputWriter } from "../output/protocol.js";
import {
  buildHostHookResponse,
  createHostHookResponse,
  parseHostHookInvocation,
  runHostHook,
  type HostHookEvent,
  type HostHookInput,
  type HostHookInvocation,
  type HostHookResponse,
  type HostHookServices,
  type TextInput,
} from "./host-hook.js";

export type ClaudeHookEvent = HostHookEvent;
export type ClaudeHookInput = HostHookInput;
export type ClaudeHookResponse = HostHookResponse;
export type ClaudeHookServices = HostHookServices;
export type ClaudeHookInvocation = HostHookInvocation;
export type { TextInput } from "./host-hook.js";

export interface RunClaudeHookOptions {
  readonly stdin: TextInput;
  readonly stdout: OutputWriter;
  readonly stderr: OutputWriter;
  readonly services?: ClaudeHookServices;
  readonly storeRoot?: string;
  readonly log?: Logger;
}

/** Detect the raw Claude Code Hook ABI and consume its only supported global option. */
export function parseClaudeHookInvocation(
  arguments_: readonly string[],
): ClaudeHookInvocation | undefined {
  return parseHostHookInvocation(arguments_, "claude");
}

/**
 * Execute the versioned raw Claude Code Hook ABI. It deliberately does not emit
 * the normal Lorelum CLI envelope: Claude Code consumes this envelope directly.
 */
export async function runClaudeHook(options: RunClaudeHookOptions): Promise<0> {
  return runHostHook({ ...options, host: "claude" });
}

export async function createClaudeHookResponse(
  input: ClaudeHookInput,
  services?: ClaudeHookServices,
  storeRoot?: string,
): Promise<ClaudeHookResponse> {
  return createHostHookResponse(input, "claude", services, storeRoot);
}

export function buildClaudeHookResponse(
  eventName: ClaudeHookEvent,
  details: ListPackDetailsResult,
): ClaudeHookResponse {
  return buildHostHookResponse(eventName, details);
}
