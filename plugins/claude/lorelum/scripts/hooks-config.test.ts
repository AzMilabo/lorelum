/* eslint-disable no-await-in-loop -- Exercise and assert each Hook process before starting the next. */
import { expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Absolute `sh` path; spawn by path so the tests can replace PATH entirely. */
const shPath = Bun.which("sh");

interface ClaudeHookEntry {
  readonly additionalContextLimit?: number;
  readonly commandWindows?: string;
  readonly command?: string;
  readonly timeout?: number;
  readonly type?: string;
}

interface ClaudeHookConfiguration {
  readonly description?: unknown;
  readonly hooks: {
    readonly SessionStart?: readonly {
      readonly matcher: string;
      readonly hooks: readonly ClaudeHookEntry[];
    }[];
    readonly PreToolUse?: readonly {
      readonly matcher?: string;
      readonly hooks: readonly ClaudeHookEntry[];
    }[];
    readonly SubagentStart?: readonly {
      readonly matcher?: string;
      readonly hooks: readonly ClaudeHookEntry[];
    }[];
    readonly PostToolUse?: unknown;
    readonly PostCompact?: unknown;
  };
}

function readConfiguration() {
  return readFile(join(import.meta.dir, "../hooks/hooks.json"), "utf8").then(
    (content) => JSON.parse(content) as ClaudeHookConfiguration,
  );
}

function hookCommand(
  configuration: ClaudeHookConfiguration,
  event: "PreToolUse" | "SessionStart" | "SubagentStart",
): string {
  const command = configuration.hooks[event]?.[0]?.hooks[0]?.command;
  if (command === undefined) throw new Error(`Missing Claude Code ${event} Hook command.`);
  return command;
}

test("restores the Pack Catalog through SessionStart after compaction and forks", async () => {
  const configuration = await readConfiguration();

  expect(configuration.description).toBeString();
  expect(configuration.hooks.SessionStart).toEqual([
    {
      // Claude Code matches SessionStart sources by exact token after splitting
      // the matcher on "|". `fork` is included because a forked session loses
      // the previously injected context, like `compact`.
      matcher: "startup|resume|clear|compact|fork",
      hooks: [expect.objectContaining({ timeout: 10, type: "command" })],
    },
  ]);
  expect(configuration.hooks.PostCompact).toBeUndefined();
  const hook = configuration.hooks.SessionStart?.[0]?.hooks[0];
  // Windows ships only a `lore.cmd` shim on PATH while POSIX ships a plain
  // `lore` executable; Claude Code's shell form runs through Git Bash on
  // Windows, where the bare name does not resolve the shim. The `||` chain
  // covers both layouts without host-specific fields.
  expect(hook?.command).toBe("lore hook claude || lore.cmd hook claude");
  expect(hook?.command).not.toContain("bun");
  expect(hook?.additionalContextLimit).toBeUndefined();
  expect(hook?.commandWindows).toBeUndefined();
});

test("routes only shell tool hooks and shares bounded hints at SubagentStart", async () => {
  const configuration = await readConfiguration();

  expect(configuration.hooks.PreToolUse).toEqual([
    {
      // Claude Code may run shell commands through the PowerShell tool instead
      // of Bash (on Windows without Git Bash the Bash tool is not registered
      // at all), so both shell tools carry session identity.
      matcher: "Bash|PowerShell",
      hooks: [expect.objectContaining({ timeout: 10, type: "command" })],
    },
  ]);
  expect(configuration.hooks.PostToolUse).toBeUndefined();
  expect(configuration.hooks.SubagentStart).toEqual([
    // No matcher: every subagent type may receive the optional hint.
    { hooks: [expect.objectContaining({ timeout: 10, type: "command" })] },
  ]);
  for (const event of ["PreToolUse", "SubagentStart"] as const) {
    const hook = configuration.hooks[event]?.[0]?.hooks[0];
    expect(hook?.command).toContain("lore hook claude");
    expect(hook?.command).not.toContain("bun");
    expect(hook?.commandWindows).toBeUndefined();
    expect(hook?.additionalContextLimit).toBeUndefined();
  }
});

test.skipIf(process.platform === "win32" || shPath === null)(
  "forwards the Hook payload to lore hook claude without a Bun runtime",
  async () => {
    const command = hookCommand(await readConfiguration(), "SessionStart");
    const directory = await mkdtemp(join(tmpdir(), "lorelum-claude-hook-cli-"));
    const lore = join(directory, "lore");
    const payload = '{"hook_event_name":"SessionStart"}';
    // Builtins only: with PATH scoped to this fixture, external tools like cat
    // are unavailable inside the fake CLI.
    await writeFile(
      lore,
      [
        "#!/bin/sh",
        "IFS= read -r input",
        `if [ "$input" != '${payload}' ]; then exit 2; fi`,
        'printf \'{"hookSpecificOutput":{"hookEventName":"SessionStart"}}\\n\'',
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(lore, 0o755);

    try {
      const child = Bun.spawn([shPath, "-c", command], {
        env: { ...process.env, PATH: directory },
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

test.skipIf(process.platform === "win32" || shPath === null)(
  "resolves the lore.cmd shim when a bare lore executable is absent",
  async () => {
    const command = hookCommand(await readConfiguration(), "SessionStart");
    const directory = await mkdtemp(join(tmpdir(), "lorelum-claude-hook-shim-"));
    const loreCmd = join(directory, "lore.cmd");
    const payload = '{"hook_event_name":"SessionStart"}';
    await writeFile(
      loreCmd,
      [
        "#!/bin/sh",
        "IFS= read -r input",
        `if [ "$input" != '${payload}' ]; then exit 2; fi`,
        'printf \'{"hookSpecificOutput":{"hookEventName":"SessionStart"}}\\n\'',
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(loreCmd, 0o755);

    try {
      const child = Bun.spawn([shPath, "-c", command], {
        env: { ...process.env, PATH: directory },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      child.stdin.write(payload);
      child.stdin.end();
      const [stdout, , exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toBe('{"hookSpecificOutput":{"hookEventName":"SessionStart"}}\n');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test.skipIf(process.platform === "win32" || shPath === null)(
  "keeps an unlaunchable CLI visible instead of swallowing the failure",
  async () => {
    const command = hookCommand(await readConfiguration(), "SessionStart");
    const directory = await mkdtemp(join(tmpdir(), "lorelum-claude-hook-missing-"));
    const emptyFile = join(directory, "empty");

    try {
      await writeFile(emptyFile, "", "utf8");
      const child = Bun.spawn([shPath, "-c", command], {
        env: { ...process.env, PATH: directory },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      child.stdin.end();
      const [, , exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);

      // Claude Code turns any Hook failure into a non-blocking session notice.
      // The command must not mask a missing CLI with a fabricated envelope.
      expect(exitCode).not.toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test.skipIf(process.platform === "win32" || shPath === null)(
  "hint Hook commands allow a missing or failing CLI to fail open",
  async () => {
    const configuration = await readConfiguration();
    const directory = await mkdtemp(join(tmpdir(), "lorelum-claude-old-cli-"));
    const lore = join(directory, "lore");
    await writeFile(lore, "#!/bin/sh\nexit 2\n", "utf8");
    await chmod(lore, 0o755);

    try {
      for (const event of ["PreToolUse", "SubagentStart"] as const) {
        const child = Bun.spawn([shPath!, "-c", hookCommand(configuration, event)], {
          env: { ...process.env, PATH: directory },
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        });
        child.stdin.write(JSON.stringify({ hook_event_name: event, tool_name: "Bash" }));
        child.stdin.end();
        const [stdout, exitCode] = await Promise.all([
          new Response(child.stdout).text(),
          child.exited,
        ]);
        expect(exitCode).toBe(0);
        expect(stdout).toBe("{}\n");
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test.skipIf(process.platform === "win32" || shPath === null)(
  "the PreToolUse wrapper does not forward a SessionStart degrade envelope",
  async () => {
    const configuration = await readConfiguration();
    const directory = await mkdtemp(join(tmpdir(), "lorelum-claude-old-cli-"));
    const lore = join(directory, "lore");
    await writeFile(lore, "#!/bin/sh\nprintf '{\"continue\":true}\\n'\n", "utf8");
    await chmod(lore, 0o755);

    try {
      const child = Bun.spawn([shPath!, "-c", hookCommand(configuration, "PreToolUse")], {
        env: { ...process.env, PATH: directory },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      child.stdin.end();
      const [stdout, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toBe("{}\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test.skipIf(process.platform === "win32" || shPath === null)(
  "forwards the Hook payload and response through the hint Hook wrappers",
  async () => {
    const configuration = await readConfiguration();
    const directory = await mkdtemp(join(tmpdir(), "lorelum-claude-hook-hints-"));
    const lore = join(directory, "lore");
    const payload = '{"hook_event_name":"SubagentStart","session_id":"parent"}';
    await writeFile(
      lore,
      [
        "#!/bin/sh",
        "IFS= read -r input",
        `if [ "$input" != '${payload}' ]; then exit 2; fi`,
        'printf \'{"hookSpecificOutput":{"hookEventName":"SubagentStart"}}\\n\'',
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(lore, 0o755);

    try {
      const child = Bun.spawn([shPath!, "-c", hookCommand(configuration, "SubagentStart")], {
        env: { ...process.env, PATH: directory },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      child.stdin.write(payload);
      child.stdin.end();
      const [stdout, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toBe('{"hookSpecificOutput":{"hookEventName":"SubagentStart"}}\n');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
