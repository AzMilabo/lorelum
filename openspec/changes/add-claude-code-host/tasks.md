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
- [ ] 4.5 真实宿主冒烟（Claude Desktop 2.9939.2.0 本地会话，Windows）：探针确认 `/plugin marketplace add` 与 Update 入口（不可用则临时装 CLI 执行该步）；clean install（marketplace add → install → scope 选择）→ 新会话 Catalog 注入且被模型引用 → `/lorelum:lorelum` 可发现 → 临时改名 `lore.cmd` 验证非阻塞启动失败 → uninstall 恢复干净
- [ ] 4.6 `claude plugin validate ./plugins/claude/lorelum --strict` 通过（无 CLI 时以桌面端安装成功 + 配置测试替代，并在 PR 中如实注明）
- [x] 4.7 Checker 独立复跑全部验收并出具 verdict
