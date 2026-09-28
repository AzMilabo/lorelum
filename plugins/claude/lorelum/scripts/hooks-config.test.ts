import { expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface ClaudeHookEntry {
  readonly additionalContextLimit?: number;
  readonly commandWindows?: string;
  readonly command?: string;
  readonly timeout?: number;
  readonly type?: string;
}

function readConfiguration() {
  return readFile(join(import.meta.dir, "../hooks/hooks.json"), "utf8").then(
    (content) =>
      JSON.parse(content) as {
        readonly description?: unknown;
        readonly hooks: {
          readonly SessionStart?: readonly {
            readonly matcher: string;
            readonly hooks: readonly ClaudeHookEntry[];
          }[];
          readonly PostCompact?: unknown;
        };
      },
  );
}

function hookCommand(configuration: Awaited<ReturnType<typeof readConfiguration>>): string {
  const command = configuration.hooks.SessionStart?.[0]?.hooks[0]?.command;
  if (command === undefined) throw new Error("Missing Claude Code Hook command.");
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

test.skipIf(process.platform === "win32")(
  "forwards the Hook payload to lore hook claude without a Bun runtime",
  async () => {
    const command = hookCommand(await readConfiguration());
    const directory = await mkdtemp(join(tmpdir(), "lorelum-claude-hook-cli-"));
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
      const child = Bun.spawn(["sh", "-c", command], {
        env: { ...process.env, PATH: `${directory}:${process.env.PATH ?? ""}` },
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
  "resolves the lore.cmd shim when a bare lore executable is absent",
  async () => {
    const command = hookCommand(await readConfiguration());
    const directory = await mkdtemp(join(tmpdir(), "lorelum-claude-hook-shim-"));
    const loreCmd = join(directory, "lore.cmd");
    const payload = '{"hook_event_name":"SessionStart"}';
    await writeFile(
      loreCmd,
      [
        "#!/bin/sh",
        'input="$(cat)"',
        `if [ "$input" != '${payload}' ]; then exit 2; fi`,
        'printf \'{"hookSpecificOutput":{"hookEventName":"SessionStart"}}\\n\'',
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(loreCmd, 0o755);

    try {
      const child = Bun.spawn(["sh", "-c", command], {
        env: { ...process.env, PATH: `${directory}:${process.env.PATH ?? ""}` },
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

test.skipIf(process.platform === "win32")(
  "keeps an unlaunchable CLI visible instead of swallowing the failure",
  async () => {
    const command = hookCommand(await readConfiguration());
    const directory = await mkdtemp(join(tmpdir(), "lorelum-claude-hook-missing-"));
    const emptyPath = join(directory, "empty");

    try {
      await writeFile(emptyPath, "", "utf8");
      const child = Bun.spawn(["sh", "-c", command], {
        env: { ...process.env, PATH: emptyPath },
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
