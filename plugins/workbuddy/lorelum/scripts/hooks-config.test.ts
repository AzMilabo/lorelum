/* eslint-disable no-await-in-loop -- Exercise and assert each Hook process before starting the next. */
import { expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("restores the Pack Catalog through SessionStart after compaction", async () => {
  const configuration = JSON.parse(
    await readFile(join(import.meta.dir, "../hooks/hooks.json"), "utf8"),
  ) as {
    readonly description?: unknown;
    readonly hooks: {
      readonly SessionStart?: readonly {
        readonly matcher: string;
        readonly hooks: readonly {
          readonly additionalContextLimit?: number;
          readonly command?: string;
          readonly commandWindows?: string;
          readonly timeout?: number;
          readonly type?: string;
        }[];
      }[];
      readonly PostCompact?: unknown;
    };
  };

  expect(configuration.hooks.SessionStart).toEqual([
    {
      // WorkBuddy compiles the matcher as a regular expression, so the plain
      // alternation covers all four SessionStart sources. WorkBuddy has no
      // `commandWindows` or `additionalContextLimit` field: Hook commands run
      // through Git Bash on Windows, which is why the `|| lore.cmd` chain
      // lives in the shared POSIX command itself.
      matcher: "startup|resume|clear|compact",
      hooks: [expect.objectContaining({ timeout: 10, type: "command" })],
    },
  ]);
  expect(configuration.hooks.PostCompact).toBeUndefined();
  const hook = configuration.hooks.SessionStart?.[0]?.hooks[0];
  expect(hook?.command).toContain("lore hook workbuddy || lore.cmd hook workbuddy");
  expect(hook?.command).toContain('{"continue":true}');
  expect(hook?.command).not.toContain("bun");
  expect(hook?.commandWindows).toBeUndefined();
  expect(hook?.additionalContextLimit).toBeUndefined();
});

test("routes only the Bash tool through PreToolUse and registers no SubagentStart Hook", async () => {
  const configuration = JSON.parse(
    await readFile(join(import.meta.dir, "../hooks/hooks.json"), "utf8"),
  ) as {
    readonly hooks: Record<
      string,
      readonly {
        readonly matcher?: string;
        readonly hooks: readonly { readonly command: string; readonly timeout?: number }[];
      }[]
    >;
  };

  expect(configuration.hooks.PreToolUse?.[0]?.matcher).toBe("^Bash$");
  const hook = configuration.hooks.PreToolUse?.[0]?.hooks[0];
  expect(hook?.command).toContain("lore hook workbuddy || lore.cmd hook workbuddy");
  expect(hook?.command).toContain("printf '%s\\n' '{}'");
  expect(hook?.command).not.toContain("bun");
  expect(hook?.timeout).toBe(10);
  // WorkBuddy dispatches SubagentStart but discards Hook stdout, so a hint
  // envelope cannot reach the subagent and no Hook entry is registered.
  expect(configuration.hooks.SubagentStart).toBeUndefined();
  expect(configuration.hooks.PostToolUse).toBeUndefined();
});

test.skipIf(process.platform === "win32")(
  "forwards the Hook payload to lore hook workbuddy without a Bun runtime",
  async () => {
    const configuration = JSON.parse(
      await readFile(join(import.meta.dir, "../hooks/hooks.json"), "utf8"),
    ) as {
      readonly hooks: {
        readonly SessionStart?: readonly {
          readonly hooks: readonly { readonly command?: string }[];
        }[];
      };
    };
    const command = configuration.hooks.SessionStart?.[0]?.hooks[0]?.command;
    if (command === undefined) throw new Error("Missing WorkBuddy Hook command.");

    const directory = await mkdtemp(join(tmpdir(), "lorelum-workbuddy-hook-cli-"));
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
  "uses a single continue envelope when an older CLI rejects the Hook ABI",
  async () => {
    const configuration = JSON.parse(
      await readFile(join(import.meta.dir, "../hooks/hooks.json"), "utf8"),
    ) as {
      readonly hooks: {
        readonly SessionStart?: readonly {
          readonly hooks: readonly { readonly command?: string }[];
        }[];
      };
    };
    const command = configuration.hooks.SessionStart?.[0]?.hooks[0]?.command;
    if (command === undefined) throw new Error("Missing WorkBuddy Hook command.");

    const directory = await mkdtemp(join(tmpdir(), "lorelum-workbuddy-old-cli-"));
    const oldLore = join(directory, "lore");
    await writeFile(oldLore, "#!/bin/sh\nprintf '{\"ok\":false}\\n'\nexit 2\n", "utf8");
    await chmod(oldLore, 0o755);

    try {
      const child = Bun.spawn(["sh", "-c", command], {
        env: { ...process.env, PATH: `${directory}:${process.env.PATH ?? ""}` },
        stdout: "pipe",
        stderr: "pipe",
      });
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

test.skipIf(Bun.which("sh") === null)(
  "new PreToolUse commands allow an old CLI to fail open as an empty object",
  async () => {
    const configuration = JSON.parse(
      await readFile(join(import.meta.dir, "../hooks/hooks.json"), "utf8"),
    ) as {
      readonly hooks: Record<string, readonly { readonly hooks: readonly { command: string }[] }[]>;
    };
    const command = configuration.hooks.PreToolUse?.[0]?.hooks[0]?.command;
    if (command === undefined) throw new Error("Missing WorkBuddy PreToolUse command.");

    const directory = await mkdtemp(join(tmpdir(), "lorelum-workbuddy-pretool-"));
    const lore = join(directory, "lore");
    await writeFile(lore, "#!/bin/sh\nexit 2\n", "utf8");
    await chmod(lore, 0o755);

    try {
      for (const payload of [
        '{"hook_event_name":"PreToolUse","tool_name":"Bash","session_id":"parent","tool_input":{"command":"lore get sample.read"}}',
      ]) {
        const child = Bun.spawn(["sh", "-c", command], {
          env: { ...process.env, PATH: `${directory}:${process.env.PATH ?? ""}` },
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        });
        child.stdin.write(payload);
        child.stdin.end();
        expect(await child.exited).toBe(0);
        expect(await new Response(child.stdout).text()).toBe("{}\n");
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test.skipIf(Bun.which("sh") === null)(
  "the PreToolUse wrapper normalizes an old CLI continue envelope and hides a missing CLI",
  async () => {
    const configuration = JSON.parse(
      await readFile(join(import.meta.dir, "../hooks/hooks.json"), "utf8"),
    ) as {
      readonly hooks: Record<string, readonly { readonly hooks: readonly { command: string }[] }[]>;
    };
    const command = configuration.hooks.PreToolUse?.[0]?.hooks[0]?.command;
    if (command === undefined) throw new Error("Missing WorkBuddy PreToolUse command.");

    const directory = await mkdtemp(join(tmpdir(), "lorelum-workbuddy-pretool-legacy-"));
    const lore = join(directory, "lore");
    await writeFile(lore, "#!/bin/sh\nprintf '{\"continue\":true}\\n'\n", "utf8");
    await chmod(lore, 0o755);

    try {
      const legacy = Bun.spawn(["sh", "-c", command], {
        env: { ...process.env, PATH: `${directory}:${process.env.PATH ?? ""}` },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [legacyOut, legacyCode] = await Promise.all([
        new Response(legacy.stdout).text(),
        legacy.exited,
      ]);
      expect(legacyCode).toBe(0);
      expect(legacyOut).toBe("{}\n");

      const empty = await mkdtemp(join(tmpdir(), "lorelum-workbuddy-pretool-empty-"));
      try {
        const shPath = Bun.which("sh");
        if (shPath === null) throw new Error("Missing sh executable.");
        const missing = Bun.spawn([shPath, "-c", command], {
          env: { PATH: empty },
          stdout: "pipe",
          stderr: "pipe",
        });
        const [missingOut, missingCode] = await Promise.all([
          new Response(missing.stdout).text(),
          missing.exited,
        ]);
        expect(missingCode).toBe(0);
        expect(missingOut).toBe("{}\n");
      } finally {
        await rm(empty, { recursive: true, force: true });
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
