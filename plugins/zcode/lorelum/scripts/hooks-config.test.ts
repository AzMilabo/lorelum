import { expect, test } from "bun:test";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface ProcessHook {
  readonly type?: string;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly timeoutMs?: number;
  readonly shell?: unknown;
  readonly async?: unknown;
  readonly timeout?: unknown;
  readonly commandWindows?: unknown;
  readonly additionalContextLimit?: unknown;
}

interface HookConfiguration {
  readonly hooks: {
    readonly SessionStart?: readonly {
      readonly matcher: string;
      readonly hooks: readonly ProcessHook[];
    }[];
    readonly PreToolUse?: readonly {
      readonly matcher: string;
      readonly hooks: readonly ProcessHook[];
    }[];
    readonly PostToolUse?: unknown;
    readonly SubagentStart?: unknown;
    readonly PostCompact?: unknown;
  };
}

async function readHookConfiguration(): Promise<HookConfiguration> {
  return JSON.parse(
    await readFile(join(import.meta.dir, "../hooks/hooks.json"), "utf8"),
  ) as HookConfiguration;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test("restores the Pack Catalog through a native ZCode process Hook", async () => {
  const configuration = await readHookConfiguration();

  expect(configuration.hooks.SessionStart).toEqual([
    {
      matcher: "startup|resume|clear|compact",
      hooks: [
        {
          type: "process",
          command: "lore",
          args: ["hook", "zcode"],
          timeoutMs: 10_000,
        },
      ],
    },
  ]);
  expect(configuration.hooks.PostCompact).toBeUndefined();

  const hook = configuration.hooks.SessionStart?.[0]?.hooks[0];
  expect(hook?.shell).toBeUndefined();
  expect(hook?.async).toBeUndefined();
  expect(hook?.timeout).toBeUndefined();
  expect(hook?.commandWindows).toBeUndefined();
  expect(hook?.additionalContextLimit).toBeUndefined();
});

test("passes session identity through a Bash-only PreToolUse process Hook", async () => {
  const configuration = await readHookConfiguration();

  expect(configuration.hooks.PreToolUse).toEqual([
    {
      matcher: "^Bash$",
      hooks: [
        {
          type: "process",
          command: "lore",
          args: ["hook", "zcode"],
          timeoutMs: 10_000,
        },
      ],
    },
  ]);

  const hook = configuration.hooks.PreToolUse?.[0]?.hooks[0];
  expect(hook?.shell).toBeUndefined();
  expect(hook?.async).toBeUndefined();
  expect(hook?.timeout).toBeUndefined();
  expect(hook?.commandWindows).toBeUndefined();
  expect(hook?.additionalContextLimit).toBeUndefined();
});

test("does not register events ZCode does not offer", async () => {
  const configuration = await readHookConfiguration();

  // ZCode has no SubagentStart event, and the explicit shell identity path
  // does not need the shared activity-window fallback.
  expect(configuration.hooks.SubagentStart).toBeUndefined();
  expect(configuration.hooks.PostToolUse).toBeUndefined();
});

test("does not ship shell or Git Bash Hook wrappers", async () => {
  const hooksDirectory = join(import.meta.dir, "../hooks");

  expect(await exists(join(hooksDirectory, "run-hook.cmd"))).toBe(false);
  expect(await exists(join(hooksDirectory, "session-start"))).toBe(false);
});

test.skipIf(process.platform === "win32")(
  "forwards the Hook payload to the lore process without a Bun runtime",
  async () => {
    const configuration = await readHookConfiguration();
    const hook = configuration.hooks.SessionStart?.[0]?.hooks[0];
    if (hook?.command === undefined || hook.args === undefined) {
      throw new Error("Missing ZCode process Hook command.");
    }

    const directory = await mkdtemp(join(tmpdir(), "lorelum-zcode-hook-cli-"));
    const lore = join(directory, "lore");
    const payload = '{"hook_event_name":"SessionStart"}';
    await writeFile(
      lore,
      [
        "#!/bin/sh",
        'input="$(cat)"',
        `if [ "$input" != '${payload}' ]; then exit 2; fi`,
        'printf \'{"hookSpecificOutput":{"hookEventName":"SessionStart"}}\\n\'',
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(lore, 0o755);

    try {
      const child = Bun.spawn([hook.command, ...hook.args], {
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH ?? ""}`,
        },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      child.stdin.write(payload);
      child.stdin.end();
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toBe('{"hookSpecificOutput":{"hookEventName":"SessionStart"}}\n');
      expect(stderr).toBe("");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test.skipIf(process.platform === "win32")(
  "forwards the PreToolUse payload and an older CLI's continue envelope unchanged",
  async () => {
    const configuration = await readHookConfiguration();
    const hook = configuration.hooks.PreToolUse?.[0]?.hooks[0];
    if (hook?.command === undefined || hook.args === undefined) {
      throw new Error("Missing ZCode PreToolUse process Hook command.");
    }

    const directory = await mkdtemp(join(tmpdir(), "lorelum-zcode-old-cli-"));
    const lore = join(directory, "lore");
    const payload = JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      session_id: "zcode-session",
      tool_input: { command: "lore get practice.id" },
    });
    await writeFile(
      lore,
      [
        "#!/bin/sh",
        'input="$(cat)"',
        `if [ "$input" != '${payload}' ]; then exit 2; fi`,
        // An older CLI does not know the PreToolUse event and degrades to a
        // continue envelope with exit code 0; ZCode accepts that on any event.
        "printf '{\"continue\":true}\\n'",
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(lore, 0o755);

    try {
      const child = Bun.spawn([hook.command, ...hook.args], {
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH ?? ""}`,
        },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      child.stdin.write(payload);
      child.stdin.end();
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toBe('{"continue":true}\n');
      expect(stderr).toBe("");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
