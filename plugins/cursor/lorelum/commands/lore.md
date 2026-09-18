---
# `$ARGUMENTS` substitution below follows the ZCode command contract and is not
# yet verified for Cursor. If a real-host check shows it is not substituted,
# remove the placeholder and route through the task context instead.
description: Retrieve relevant Lorelum engineering Practices for the current task or question.
---

Use the `lorelum` skill for this request:

$ARGUMENTS

When a question is provided, treat it as the retrieval focus: run one targeted natural-language `lore query` for it, then read the full body of every candidate Practice with `lore get <practice-id>`. Read default text directly; use `--json` only to diagnose an unexpected result or inspect protocol details.

When the command is invoked without arguments, evaluate the current task and retrieve the Practices that can inform its decisions, verification, or recovery using the same sequence. Reuse the Installed Pack Catalog injected by the sessionStart Hook when it is visible in the current context instead of rerunning `lore pack list --details`; when no Catalog is visible, run `lore pack list --details` once for the task and reuse that result.
