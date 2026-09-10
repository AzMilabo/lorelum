# Lorelum Codex Plugin

This is the first Codex integration for Lorelum. It uses a progressive-disclosure flow:

1. `SessionStart` and `PostCompact` inject a small Pack Index.
2. The Lorelum Skill tells Codex to decide whether a Pack is relevant.
3. Codex calls the Lorelum query command only for a matching task and work moment.
4. Codex retrieves a full Practice only when the compact query result makes it necessary.

Codex discovers the default `hooks/hooks.json` bundled in the Plugin. The hook currently calls the provisional command `lore list packs`. The command name is intentionally isolated in `scripts/inject-pack-index.ts` until the CLI command tree is reviewed. Set `LORELUM_CLI_COMMAND` to test with a custom executable; pass a custom source in unit tests.

Hooks are metadata-only. They do not run `lore query`, access the network, modify the Store, or read full Practice bodies. If the CLI is unavailable or returns malformed data, the hook writes a diagnostic to stderr and lets the host continue without additional context.

## Local validation

From the repository root:

```powershell
python "$env:USERPROFILE\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" plugins\lorelum-codex
bun test plugins/lorelum-codex/scripts
```

The dynamic CLI and Store integration will be connected after the Pack metadata command contract is finalized.
