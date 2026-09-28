# Tasks: add-claude-code-host

## 1. CLI Hook ABI

- [x] 1.1 扩展 `packages/cli/src/hook/host-hook.ts`：`HostHookName` 联合加入 `"claude"`，`hostLabel` 返回 `"Claude Code"`
- [x] 1.2 新增 `packages/cli/src/hook/claude.ts`（与 `workbuddy.ts` 同构的薄包装，复用 `buildHostHookResponse`）
- [x] 1.3 新增 `packages/cli/src/hook/claude.test.ts`（Catalog envelope、三类降级、`--store-root` 解析、宿主互斥）
- [x] 1.4 `packages/cli/src/main.ts` 注册 `hook claude` 分发与 `claudeHookServices` 覆盖项
- [x] 1.5 新增 `packages/cli/integration/scenarios/hook-claude.ts`（含多 Pack 下 Catalog 渲染尺寸有界）并挂入 `process.integration.ts`

## 2. Claude Code Plugin

- [x] 2.1 新增 `plugins/claude/lorelum/.claude-plugin/plugin.json`（版本 `0.1.0-alpha.4`，极简字段 + `displayName: "Lorelum"`，无路径指针、无 `hooks` 字段）
- [x] 2.2 新增 `plugins/claude/lorelum/hooks/hooks.json`（顶层 `description`；SessionStart，matcher `startup|resume|clear|compact|fork`，shell 字符串 `lore hook claude || lore.cmd hook claude`，`timeout: 10`；不含 `commandWindows`/`additionalContextLimit`）
- [x] 2.3 新增 `plugins/claude/lorelum/skills/lorelum/SKILL.md` 宿主化副本（以 zcode 版为底）与 `references/semantic-query-recovery.md`，满足 skill-guidance-fixtures 全部场景
- [x] 2.4 新增 `plugins/claude/lorelum/assets/lorelum-icon.svg` 与 `README.md`（不建 `commands/`）
- [x] 2.5 新增 `plugins/claude/lorelum/scripts/hooks-config.test.ts` 与 `marketplace-config.test.ts`（断言命令形态、matcher、不含非 Claude schema 字段）
- [x] 2.6 新增仓库根 `.claude-plugin/marketplace.json`（`lorelum-plugins` + 必填 `owner`，单一 `lorelum` 条目，version 与 manifest 一致）

## 3. 布局与文档

- [x] 3.1 扩展 `plugins/scripts/plugin-layout.test.ts`：claude 身份/source/版本断言，并移除 `.claude-plugin/marketplace.json` 不存在的过渡守卫断言
- [x] 3.2 更新 `plugins/README.md` 宿主表；更新 `docs/development/plugin-conventions.md` 的 hostKey 枚举、Windows `|| lore.cmd` 命令理据与新增宿主清单
- [x] 3.3 更新 `docs/development/plugins.md`：Claude Code 行与 `claude plugin validate ./plugins/claude/lorelum --strict` 验证命令
- [x] 3.4 新增 `apps/site/content/docs/claude.mdx` + `claude.zh.mdx`（安装、首次使用、更新、移除、恢复），更新 `meta.json` / `meta.zh.json` 导航，并把 `agent-setup.mdx` / `agent-setup.zh.mdx` 的 Claude Code 行与手动 curl 安装段改为 Plugin 安装指引

## 4. 验证

- [x] 4.1 `openspec validate add-claude-code-host --strict` 通过；若 `add-workbuddy-host` 已 archive，重读本 delta 涉及的当前 spec 并重新同步两侧文本
- [x] 4.2 `bun test plugins/scripts plugins/claude/lorelum/scripts packages/cli/src/hook` 通过
- [x] 4.3 `bun test` 全量、`bun run typecheck`、`bun run lint` 通过——注：Windows 上全量 `bun test` 有 2 个基线既有失败（`scripts/ci/typecheck.test.ts`、`packages/config/src/registry-catalog.test.ts`），经 `git stash` 对照确认在基线 commit d133066 即失败，与本变更无关；其余 1059 项全部通过
- [x] 4.4 隔离 Store 冒烟：`lore hook claude` 正常输出 Catalog envelope、异常降级 `{"continue":true}` 且退出码 0（源入口冒烟 + 编译二进制的集成场景 `verifyClaudeHookScenario` 双路通过）
- [x] 4.5 真实宿主冒烟（Claude Desktop 2.9939.2.0 本地会话，Windows，2026-09-28 完成）：探针 1 阳性——桌面提示框接受带参 `/plugin marketplace add <本地路径>`，弹原生 Add marketplace 对话框并成功注册；桌面 Directory UI 对 directory 源 marketplace 的插件列表恒为空（最小化官方风格探针市场同样为空，判定为该桌面构建的 UI 缺陷），按既定退路改用桌面内嵌 CLI 2.1.281 完成 `plugin install lorelum@lorelum-plugins`（user scope，enabled）；新本地会话 SessionStart Hook 实测：`lore hook claude || lore.cmd hook claude` 在 Git Bash 中经 `||` 回退命中 `lore.cmd`（lorelum trace 证实 `hook.catalog.rendered`），注入的 Catalog 被模型原句引用（agentic-coding 0.3.1 + azmilabo-engineering 0.1.0 及两个 packRoot，未运行任何命令）；技能发现经会话转录 skill_listing 证实（`lorelum:lorelum`）；非阻塞失败获直接证据——发布版 CLI 不识别 `hook claude` 时 hook 以 exit 2 失败，转录记录 `hook_non_blocking_error` 附件且会话照常启动应答；桌面 UI 的 Update 入口无法经无障碍路径到达（菜单不暴露），按退路记录 CLI `claude plugin update` 为可用路径；冒烟后已恢复干净（卸载插件、移除两份 marketplace、还原 lore.cmd shim）
- [x] 4.6 `claude plugin validate ./plugins/claude/lorelum --strict` 通过（经桌面内嵌 CLI 2.1.281 执行，exit 0）
- [x] 4.7 Checker 独立复跑全部验收并出具 verdict
