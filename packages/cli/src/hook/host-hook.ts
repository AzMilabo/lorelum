import {
  createListService,
  defaultStorageRoot,
  type ListPackDetailsResult,
  type ListService,
  type StorageRoot,
} from "@lorelum/engine";

import type { OutputWriter } from "../output/protocol.js";
import { resolveInvocationStorageRoot } from "../store/storage-root.js";
import { renderPackCatalog } from "./pack-catalog.js";
import type { Logger } from "@lorelum/log";
import type { ReadHint } from "@lorelum/backend/client";
import { sessionRefSchema } from "@lorelum/backend/client";
import { defaultPracticeHints } from "../practice-hints/backend.js";
import { loadAgentHookSettings, type AgentHookSettings } from "./agent-settings.js";
import { renderReadHints } from "../practice-hints/render.js";

/** Hosts with a versioned raw session Hook ABI (`lore hook <host>`). */
export type HostHookName = "claude" | "codex" | "cursor" | "workbuddy" | "zcode";

export type HostHookEvent = "SessionStart" | "SubagentStart";

/** Cursor's native session Hook spells the event in camelCase. */
export type CursorHookEvent = "sessionStart";

export interface HostHookInput {
  readonly hook_event_name?: string;
  readonly session_id?: unknown;
  /** Cursor's session identifier; the docs expose `session_id` with the same value. */
  readonly conversation_id?: unknown;
  readonly tool_name?: unknown;
  readonly tool_use_id?: unknown;
  readonly cwd?: unknown;
  readonly tool_input?: unknown;
}

export interface HostHookResponse {
  readonly hookSpecificOutput?:
    | { readonly hookEventName: HostHookEvent; readonly additionalContext: string }
    | {
        readonly hookEventName: "PreToolUse";
        // Claude Code and WorkBuddy apply `updatedInput` through their normal
        // permission flow when no decision is present; Codex's host contract
        // requires "allow" alongside the rewrite.
        readonly permissionDecision?: "allow";
        readonly updatedInput: Record<string, unknown>;
      };
  readonly continue?: boolean;
}

/** Cursor consumes a flat snake_case envelope instead of `hookSpecificOutput`. */
export interface CursorHookResponse {
  readonly additional_context?: string;
  /** Cursor's preToolUse form: a flat field that replaces the tool input. */
  readonly updated_input?: Record<string, unknown>;
}

export interface TextInput {
  text(): Promise<string>;
}

export interface HostHookServices {
  readonly list: Pick<ListService, "listPackDetails">;
  readonly storageRoot: StorageRoot;
  readonly practiceHints?: {
    readRecentHints(hostKey: string, sessionId: string): Promise<readonly ReadHint[]>;
  };
  readonly agentHookSettings?: () => Promise<AgentHookSettings>;
  readonly platform?: NodeJS.Platform;
}

export interface RunHostHookOptions {
  readonly host: HostHookName;
  readonly stdin: TextInput;
  readonly stdout: OutputWriter;
  readonly stderr: OutputWriter;
  readonly services?: HostHookServices;
  readonly storeRoot?: string;
  readonly log?: Logger;
}

export interface HostHookInvocation {
  readonly storeRoot?: string;
  readonly debug?: boolean;
}

const defaultServices: HostHookServices = Object.freeze({
  list: createListService(),
  storageRoot: defaultStorageRoot(),
  practiceHints: defaultPracticeHints,
  agentHookSettings: loadAgentHookSettings,
});

/**
 * Detect a raw host Hook ABI (`hook <host>`) and consume its only supported
 * global option.
 */
export function parseHostHookInvocation(
  arguments_: readonly string[],
  host: HostHookName,
): HostHookInvocation | undefined {
  const positionals: string[] = [];
  let storeRoot: string | undefined;
  let debug = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === "--debug") {
      if (debug) return undefined;
      debug = true;
      continue;
    }
    if (argument === "--store-root") {
      const value = arguments_[index + 1];
      if (storeRoot !== undefined || typeof value !== "string" || value.length === 0) {
        return undefined;
      }
      storeRoot = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--store-root=")) {
      const value = argument.slice("--store-root=".length);
      if (storeRoot === undefined || value.length === 0) return undefined;
      storeRoot = value;
      continue;
    }
    positionals.push(argument);
  }

  return positionals.length === 2 && positionals[0] === "hook" && positionals[1] === host
    ? { ...(storeRoot === undefined ? {} : { storeRoot }), ...(debug ? { debug } : {}) }
    : undefined;
}

/**
 * Execute the versioned raw host Hook ABI. It deliberately does not emit the
 * normal Lorelum CLI envelope: the host consumes this envelope directly, and
 * failures emit a host-safe no-op (`{"continue":true}` for SessionStart,
 * `{}` for the optional tool/subagent events) so work can continue.
 */
export async function runHostHook(options: RunHostHookOptions): Promise<0> {
  let eventName: string | undefined;
  try {
    const serialized = await options.stdin.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      options.log?.debug("hook.payload.invalid", { byteLength: Buffer.byteLength(serialized) });
      throw new Error(`Lorelum ${hostLabel(options.host)} Hook input must be valid JSON.`);
    }
    if (!isRecord(parsed)) {
      throw new Error(`Lorelum ${hostLabel(options.host)} Hook input must be a JSON object.`);
    }
    const input: HostHookInput = parsed;
    eventName = input.hook_event_name;
    options.log?.debug("hook.payload.received", {
      byteLength: Buffer.byteLength(serialized),
      ...(typeof input.hook_event_name === "string"
        ? { hookEventName: input.hook_event_name }
        : {}),
    });
    const response = await respondToHostHook(
      input,
      options.host,
      options.services ?? defaultServices,
      options.storeRoot,
    );
    options.log?.debug("hook.response.rendered", { event: input.hook_event_name });
    options.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    options.log?.error("hook.degraded", { host: options.host }, error);
    options.stderr.write(`lore hook ${options.host} degraded: ${diagnosticMessage(error)}\n`);
    // PreToolUse-style events do not accept `continue`, so a failed optional
    // hint Hook must return an empty, valid result instead of a malformed
    // permission. Cursor spells these events in camelCase.
    const normalizedEvent = eventName?.toLowerCase();
    options.stdout.write(
      isPracticeHintHost(options.host) &&
        normalizedEvent !== undefined &&
        normalizedEvent !== "sessionstart" &&
        (normalizedEvent === "pretooluse" ||
          normalizedEvent === "posttooluse" ||
          normalizedEvent === "subagentstart")
        ? "{}\n"
        : '{"continue":true}\n',
    );
  }
  return 0;
}

/** Hosts whose shell/subagent events feed the shared read-Practice hint chain. */
type PracticeHintHost = "claude" | "codex" | "cursor" | "workbuddy";

function isPracticeHintHost(host: HostHookName): host is PracticeHintHost {
  return host === "claude" || host === "codex" || host === "cursor" || host === "workbuddy";
}

/** The session-start event literal each hint host sends. */
function sessionStartEvent(host: PracticeHintHost): "SessionStart" | "sessionStart" {
  return host === "cursor" ? "sessionStart" : "SessionStart";
}

function respondToHostHook(
  input: HostHookInput,
  host: HostHookName,
  services: HostHookServices,
  storeRoot?: string,
): Promise<HostHookResponse | CursorHookResponse> {
  if (isPracticeHintHost(host) && input.hook_event_name !== sessionStartEvent(host)) {
    return respondToPracticeHint(
      input,
      host,
      services.practiceHints ?? defaultPracticeHints,
      services.agentHookSettings ?? loadAgentHookSettings,
      services.platform,
    );
  }
  if (input.hook_event_name !== supportedSessionEvent(host)) {
    throw new Error(`Lorelum ${hostLabel(host)} Hook received an unsupported event.`);
  }
  const storageRoot = resolveInvocationStorageRoot(storeRoot, services.storageRoot);
  return services.list
    .listPackDetails({ storageRoot })
    .then((details) =>
      host === "cursor"
        ? buildCursorHookResponse(details)
        : buildHostHookResponse("SessionStart", details),
    );
}

async function respondToPracticeHint(
  input: HostHookInput,
  host: PracticeHintHost,
  hints: NonNullable<HostHookServices["practiceHints"]>,
  loadSettings: () => Promise<AgentHookSettings>,
  platform: NodeJS.Platform = process.platform,
): Promise<HostHookResponse | CursorHookResponse> {
  const eventName = input.hook_event_name;
  if (eventName === "SubagentStart" || eventName === "subagentStart") {
    // WorkBuddy dispatches SubagentStart but discards Hook stdout, and
    // Cursor's subagentStart response cannot carry additional context, so a
    // hint envelope cannot reach the subagent on either host; Codex and
    // Claude Code consume the hint today.
    if (host !== "codex" && host !== "claude") return {};
    if (typeof input.session_id !== "string" || !input.session_id) return {};
    const context = renderReadHints(await hints.readRecentHints(host, input.session_id));
    return context === undefined
      ? {}
      : {
          hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: context },
        };
  }
  const isPreToolUse = eventName === "PreToolUse" || eventName === "preToolUse";
  const isPostToolUse = eventName === "PostToolUse" || eventName === "postToolUse";
  if (isPreToolUse || isPostToolUse) {
    if (isPostToolUse) return {};
    const syntax = shellInjectionSyntax(host, input.tool_name, platform);
    if (syntax === undefined) return {};
    const sessionId = firstString(input.session_id, input.conversation_id);
    const session = sessionRefSchema.safeParse({ hostKey: host, sessionId });
    if (!session.success || !isRecord(input.tool_input)) return {};
    const command = input.tool_input.command;
    if (typeof command !== "string") return {};
    const settings = await loadSettings();
    if (settings.shellSessionInjection === "lore-only" && !containsLoreToken(command)) return {};
    const updatedInput: Record<string, unknown> = {
      ...input.tool_input,
      command:
        (syntax === "powershell"
          ? `$env:LORELUM_HOST_KEY = '${host}'\n` +
            `$env:LORELUM_HOST_SESSION_ID = ${powerShellQuote(session.data.sessionId)}\n`
          : `export LORELUM_HOST_KEY='${host}'\n` +
            `export LORELUM_HOST_SESSION_ID=${shellQuote(session.data.sessionId)}\n`) + command,
    };
    if (host === "cursor") {
      // Cursor's preToolUse response is flat and carries no permission
      // decision, so the rewritten input still goes through its normal flow.
      return { updated_input: updatedInput };
    }
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        // Codex's host contract requires "allow" alongside updatedInput;
        // Claude Code and WorkBuddy apply updatedInput through their normal
        // permission flow, and WorkBuddy's "allow" would bypass its
        // permission system entirely.
        ...(host === "codex" ? { permissionDecision: "allow" as const } : {}),
        updatedInput,
      },
    };
  }
  throw new Error(`Lorelum ${hostLabel(host)} Hook received an unsupported event.`);
}

/**
 * Resolve the assignment syntax for a host's shell tool. Claude Code names its
 * shell tools "Bash" and "PowerShell", and each tool implies its own syntax on
 * every platform (the Bash tool runs a POSIX-style shell even on Windows).
 * Codex, WorkBuddy, and Cursor expose one shell tool — "Bash", "Bash", and
 * "Shell" respectively — and Codex keys the prefix on the host platform
 * because its native Windows agent runs PowerShell, while WorkBuddy's Bash
 * tool and Cursor's agent host run Git Bash on every platform, so those two
 * always get POSIX exports.
 */
function shellInjectionSyntax(
  host: PracticeHintHost,
  toolName: unknown,
  platform: NodeJS.Platform,
): "export" | "powershell" | undefined {
  if (host === "claude") {
    if (toolName === "Bash") return "export";
    if (toolName === "PowerShell") return "powershell";
    return undefined;
  }
  const shellToolName = host === "cursor" ? "Shell" : "Bash";
  if (toolName !== shellToolName) return undefined;
  if (host === "workbuddy" || host === "cursor") return "export";
  return platform === "win32"
    ? "powershell"
    : platform === "darwin" || platform === "linux"
      ? "export"
      : undefined;
}

function firstString(...values: readonly unknown[]): unknown {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return undefined;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function powerShellQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function containsLoreToken(command: string): boolean {
  return /(^|[^A-Za-z0-9_-])lore(?=$|[^A-Za-z0-9_-])/.test(command);
}

export async function createHostHookResponse(
  input: HostHookInput,
  host: "cursor",
  services?: HostHookServices,
  storeRoot?: string,
): Promise<CursorHookResponse>;
export async function createHostHookResponse(
  input: HostHookInput,
  host: "claude" | "codex" | "workbuddy" | "zcode",
  services?: HostHookServices,
  storeRoot?: string,
): Promise<HostHookResponse>;
export async function createHostHookResponse(
  input: HostHookInput,
  host: HostHookName,
  services: HostHookServices = defaultServices,
  storeRoot?: string,
): Promise<HostHookResponse | CursorHookResponse> {
  return respondToHostHook(input, host, services, storeRoot);
}

export function buildHostHookResponse(
  eventName: HostHookEvent,
  details: ListPackDetailsResult,
): HostHookResponse {
  return {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: renderPackCatalog(catalogEntries(details)),
    },
  };
}

export function buildCursorHookResponse(details: ListPackDetailsResult): CursorHookResponse {
  return { additional_context: renderPackCatalog(catalogEntries(details)) };
}

function catalogEntries(details: ListPackDetailsResult) {
  return details.packs.map((pack) => ({
    name: pack.name,
    ...(pack.description === undefined ? {} : { description: pack.description }),
    appliesTo: pack.applies_to ?? [],
  }));
}

/** The native event literal each host sends on its raw session Hook. */
function supportedSessionEvent(host: HostHookName): HostHookEvent | CursorHookEvent {
  return host === "cursor" ? "sessionStart" : "SessionStart";
}

const hostLabels: Readonly<
  Record<HostHookName, "Claude Code" | "Codex" | "Cursor" | "Workbuddy" | "Zcode">
> = Object.freeze({
  claude: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  workbuddy: "Workbuddy",
  zcode: "Zcode",
});

function hostLabel(host: HostHookName) {
  return hostLabels[host];
}

function diagnosticMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
