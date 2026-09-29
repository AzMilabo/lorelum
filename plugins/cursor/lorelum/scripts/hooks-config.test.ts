import { expect, test } from "bun:test";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface ShellHook {
  readonly type?: unknown;
  readonly command?: string;
  readonly matcher?: unknown;
  readonly timeout?: unknown;
  readonly loop_limit?: unknown;
  readonly failClosed?: unknown;
  readonly commandWindows?: unknown;
  readonly additionalContextLimit?: unknown;
  readonly timeoutMs?: unknown;
}

interface HookConfiguration {
  readonly version?: number;
  readonly hooks: {
    readonly sessionStart?: readonly ShellHook[];
    readonly SessionStart?: unknown;
    readonly preToolUse?: readonly ShellHook[];
    readonly subagentStart?: unknown;
    readonly postToolUse?: unknown;
    readonly PreToolUse?: unknown;
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

test("restores the Pack Catalog through a bare PATH command in the Cursor Hook schema", async () => {
  const configuration = await readHookConfiguration();

  expect(configuration.version).toBe(1);
  expect(configuration.hooks.sessionStart).toEqual([
    {
      command: "lore hook cursor",
      timeout: 10,
    },
  ]);
  expect(configuration.hooks.SessionStart).toBeUndefined();

  const hook = configuration.hooks.sessionStart?.[0];
  expect(hook?.type).toBeUndefined();
  expect(hook?.matcher).toBeUndefined();
  expect(hook?.loop_limit).toBeUndefined();
  expect(hook?.failClosed).toBeUndefined();
  expect(hook?.commandWindows).toBeUndefined();
  expect(hook?.additionalContextLimit).toBeUndefined();
  expect(hook?.timeoutMs).toBeUndefined();
});

test("keeps the Hook command a PATH dependency without plugin scripts or variables", async () => {
  const configuration = await readHookConfiguration();
  const command = configuration.hooks.sessionStart?.[0]?.command;
  expect(command).toBe("lore hook cursor");
  expect(command).not.toContain("${CURSOR_PLUGIN_ROOT}");
  expect(command).not.toMatch(/[/\\]/);

  const hooksDirectory = join(import.meta.dir, "../hooks");
  expect(await exists(join(hooksDirectory, "run-hook.cmd"))).toBe(false);
  expect(await exists(join(hooksDirectory, "session-start"))).toBe(false);
  expect(await exists(join(hooksDirectory, "session-start.sh"))).toBe(false);
});

test("routes only the Shell tool through preToolUse and registers no subagent Hook", async () => {
  const configuration = await readHookConfiguration();

  // Cursor names its terminal tool "Shell" and applies a flat updated_input
  // response. The command stays bare: Cursor runs Hook commands fail-open by
  // default, and an older CLI answers preToolUse with a harmless no-op
  // envelope, so no output-filtering wrapper is required.
  expect(configuration.hooks.preToolUse).toEqual([
    {
      matcher: "^Shell$",
      command: "lore hook cursor",
      timeout: 10,
    },
  ]);
  expect(configuration.hooks.PreToolUse).toBeUndefined();
  // Cursor's subagentStart response cannot carry additional context, so no
  // Hook entry is registered for it.
  expect(configuration.hooks.subagentStart).toBeUndefined();
  expect(configuration.hooks.postToolUse).toBeUndefined();
});

test.skipIf(process.platform === "win32")(
  "forwards the Hook payload to lore through a shell command string",
  async () => {
    const configuration = await readHookConfiguration();
    const command = configuration.hooks.sessionStart?.[0]?.command;
    if (command === undefined) {
      throw new Error("Missing Cursor shell Hook command.");
    }

    const directory = await mkdtemp(join(tmpdir(), "lorelum-cursor-hook-cli-"));
    const lore = join(directory, "lore");
    const payload = '{"hook_event_name":"sessionStart"}';
    await writeFile(
      lore,
      [
        "#!/bin/sh",
        'input="$(cat)"',
        `if [ "$input" != '${payload}' ]; then exit 2; fi`,
        "printf '%s\\n' '{\"additional_context\":\"Lorelum Installed Pack Catalog\"}'",
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(lore, 0o755);

    try {
      const child = Bun.spawn(["sh", "-c", command], {
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
      expect(stdout).toBe('{"additional_context":"Lorelum Installed Pack Catalog"}\n');
      expect(stderr).toBe("");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test.skipIf(Bun.which("sh") === null)(
  "forwards a preToolUse payload to lore through the bare command",
  async () => {
    const configuration = await readHookConfiguration();
    const command = configuration.hooks.preToolUse?.[0]?.command;
    if (command === undefined) {
      throw new Error("Missing Cursor preToolUse Hook command.");
    }

    const directory = await mkdtemp(join(tmpdir(), "lorelum-cursor-pretool-cli-"));
    const lore = join(directory, "lore");
    const payload =
      '{"hook_event_name":"preToolUse","tool_name":"Shell","conversation_id":"parent","tool_input":{"command":"lore get sample.read"}}';
    await writeFile(
      lore,
      [
        "#!/bin/sh",
        'input="$(cat)"',
        `if [ "$input" != '${payload}' ]; then exit 2; fi`,
        `printf '%s\\n' '${JSON.stringify({
          updated_input: { command: "export LORELUM_HOST_KEY=cursor; lore get sample.read" },
        })}'`,
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(lore, 0o755);

    try {
      const child = Bun.spawn(["sh", "-c", command], {
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
      expect(stdout).toContain("updated_input");
      expect(stdout).toContain("LORELUM_HOST_KEY");
      expect(stderr).toBe("");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
