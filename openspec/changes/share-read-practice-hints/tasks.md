## 0. 已有证据，不等于修订方案已实施

- [x] 0.1 当前 worktree 已实现 Backend-owned 候选接口、旧的单文件会话路径及 Practice-hints 私有窗口；相关 Backend/CLI/Plugin 单元与协议测试通过，但这些测试只覆盖改方案前的代码。未发布，也没有真实子 Agent 可见性验收。

## 1. 审查关口

- [x] 1.1 将修订后的 proposal、spec、design、tasks 交用户审查；用户明确同意前，不改生产代码、Plugin、双语用户指南或现有 Backend 文件。用户已明确批准实施并更新现有 PR。
- [x] 1.2 macOS 真实 Codex 命令改写后保持工作目录与退出码 23；Hook 输入只暴露 `command`，没有超时字段。保留其他输入字段（含模拟的超时字段）由单测覆盖，不把未出现的宿主字段说成实测通过。

## 2. 审查通过后调整实现

- [x] 2.1 把会话路径规划为 `~/.lorelum/sessions/<hostKey>/<宿主原始 sessionId>/practice-reads.jsonl`，Codex 会话 ID 原样命名目录，Backend 统一计算并确保文件操作留在用户会话目录内；完整记录继续只由 Backend 追加，且不含 Pack 来源列表。验证权限、长会话、损坏末行、重启和 worktree 删除后仍可读。不迁移或删除未发布原型文件；若实施前发现真实旧文件先重新评估迁移。
- [x] 2.2 将窗口从 Practice-hints 私有服务移到 Backend 的公共 `sessions` 模块，定义唯一会话关联入口，显式身份优先、窗口仅作后备；写 README 说明当前 Windows 使用者、生命周期、近似归属与未来宿主复用规则。不得为新功能另建一套窗口，也不增加无需求的通用状态机。
- [x] 2.3 CLI 成功 `lore get` 后按共同 `SessionRef` 合同筛选成对环境变量；缺失或无效当作没有显式身份，不把坏值交给 Backend，随后仅尝试公共窗口后备。带有效身份时向已运行 Backend 报告候选与实际目录。保持文本/JSON、失败读取、独立终端、Backend 不可达时的结果/退出语义，不启动 Backend、不建备用清单。
- [x] 2.4 当时的方案：Codex macOS 的 Pre Hook 仅对 Bash 保留全部原工具输入并给 `command` 前置安全引用的两个 `export`，不为窗口访问 Backend；非 shell no-op。Linux/Windows 保持现有 Pre/Post 窗口代码路径。此平台差异已由第 4 节的新要求替代。

## 3. 真实验收与文档

- [x] 3.1 测试 Backend 显式身份和窗口后备的隔离、认证、同目录并行会话；确认 Codex 原始会话 ID 直接对应目录、候选与子 Agent 提示不含 Pack 来源；测试环境变量缺失/无效的后备与漏记、Hook 不改其他输入字段、未信任/缺字段降级、Codex/Linux/Windows 配置和上下文预算。此时 Linux/Windows 尚未改写，后续验收见第 4 节。
- [x] 3.2 用与源码匹配的 Backend 和真实 Codex 完成直接、脚本、管道内的成功/失败 `get`、工作区子目录与真实子 Agent 可见性；测无 Lorelum Bash 的 Hook 冷/暖开销及 `get` 报告额外时间。不能拿 Hook JSON 或旧单元测试充当真实子 Agent 收到提示。
- [x] 3.3 当时已同步英文/中文用户指南与 Plugin README，说明会话目录、显式绑定与 Windows 窗口后备的差异；运行相关 CLI/Backend/Plugin 测试、typecheck、格式、lint、OpenSpec 严格校验并审阅完整 diff。新平台方案需要再次同步文档与验收，见第 4 节。

## 4. Codex 三平台显式会话身份

- [x] 4.1 Linux 与 macOS 共用 Unix shell `export` 注入；Windows 原生 PowerShell 使用 `$env:` 注入。保留 Bash 原始输入字段，非 Bash 或缺字段 no-op，Codex Plugin 不再安装空跑的 `PostToolUse` Hook。平台化单测覆盖转义和原输入；Unix shell 子进程继承与退出码有实际进程测试，Windows 实际执行留待 4.3。
- [x] 4.2 同步双语用户指南、Plugin README、Backend sessions README 与本变更的 proposal/spec/design；说明三个平台的写法差异、公共窗口仍供其他宿主复用，且不把 Mac 实测说成 Linux/Windows 实测。
- [ ] 4.3 运行相关测试、typecheck、格式/lint 和严格 OpenSpec 校验；在正常运行的真实 Linux/Windows Codex 宿主分别检查改写、命令语义与子 Agent 链路，不能运行时如实记录未验收边界。

## 5. 可配置的 shell 会话身份注入范围

- [x] 5.1 在现有用户级 `config.yaml` 增加 `shellSessionInjection: lore-only | all-shell` 读取与校验，缺省 `lore-only`，无效配置对该次 Hook fail-open。默认只用外层命令文本的独立 `lore` 字样判定，不读脚本、不解析 shell；`all-shell` 保持当前所有 Bash 命令注入。覆盖三平台、非 shell、直接/组合命令、脚本间接调用和配置错误。
- [x] 5.2 同步双语 Codex 用户指南、配置入口和 Plugin/CLI 维护说明：明确默认只匹配外层文本，脚本内部可能漏记，`all-shell` 只涵盖 shell tool，不是每种工具；两种模式都不改变 `lore get` 结果。校验并更新现有 PR。
- [x] 5.3 将配置从 Codex 专属的 `codex.shellSessionInjection` 收敛到 Agent 共用的 `agent.shellSessionInjection`，不保留未发布旧字段的兼容层；修改读取、测试、双语文档与本变更合同。其他宿主尚无 shell 身份改写能力时不增加空跑 Hook；验证并更新现有 PR。

## 本轮验证记录

- macOS 实测与单测分别确认改写后原命令保持退出码 23、Hook 保留其余工具输入字段。真实 Hook 输入未包含超时字段，不把单测模拟字段当成宿主实测。
- 已将当前工作区 Plugin 安装为本地 `lorelum@lorelum-plugins`，用临时 PATH 让 Hook 调工作区编译的 CLI；Codex 登录 shell 内的 `get` 使用该 CLI 的绝对路径。与源码匹配的 Backend 写入原始会话 ID 对应目录；子目录中的直接、脚本、管道 `get` 各留一条候选，失败读取未新增。正常持久 Codex 会话里的真实子 Agent 在未收到 ID/标题的委派任务下，返回了候选 ID 和标题。未信任 Hook 的另一次真实会话未改写命令。macOS 实测不代表 Linux/Windows 通过。
- 本机 8 次进程样本：无 Lorelum 命令的 Mac Pre Hook 首次 131 毫秒，后续中位数约 117 毫秒；`get` 无显式会话中位数约 227 毫秒，显式会话约 218 毫秒。不同次序且样本少，不据此声称提升。Backend 停止时，带显式身份的成功 `get --json` 仍返回同一 Practice digest 和成功退出码。测试后已恢复原来的全局 Backend 构建和已加载模型；全局 `lore` 链接与用户配置没有改动。
- 最终相关 Backend、CLI、Codex Plugin 测试为 535 通过、3 项 Windows 平台跳过、0 失败；typecheck、格式检查、lint（已有警告，退出码 0）、Plugin 校验器（隔离安装 PyYAML）、`build:cli`、OpenSpec 严格校验与 diff 检查通过。安装测试使用的 Plugin cachebuster 已从仓库文件撤回，不进入 PR。

## 2026-09-29 平台统一的本轮验证

- Codex `PreToolUse` 在 macOS/Linux 返回相同 Unix `export`，Windows 返回 PowerShell `$env:`；三平台的引用转义、保留工具输入、非 Bash/缺字段 no-op 单测通过。macOS 上用真实 `sh` 进程分别执行两条 Unix 分支，子进程收到会话身份，原命令仍以 23 退出；编译 CLI 的 Mac Pre Hook smoke 也返回了预期的 `updatedInput`。
- CLI 与 Codex Plugin 共 327 项测试通过，1 项 Windows PowerShell 进程测试在 macOS 跳过；typecheck、lint（仓库已有警告，退出码 0）、格式检查、Plugin validator、站点构建及 OpenSpec 严格校验通过。更新后的本地 Codex Plugin 已安装，cachebuster 只存在于安装缓存，仓库 manifest 恢复原样。
- 本轮 Windows 虚拟机需要解锁口令，无法启动；当前宿主也没有 PowerShell 解释器。Linux/Windows 的真实 Codex 宿主、Windows 子进程继承与批准链路尚未验收，不能将静态测试或 macOS shell 测试说成跨平台实测。

## 2026-09-29 注入范围配置的本轮验证

- 默认模式以外层命令文本匹配独立 `lore`；实际读取用户级 YAML 的 `all-shell` 测试覆盖了无 `lore` 的脚本外层调用。三平台默认分支、组合命令、非 shell、坏配置 no-op 和原输入保留均有单测；编译 CLI 在用户原有自定义配置下的 `git status` 返回 `{}`、`lore get` 返回带会话身份的改写命令。没有修改用户配置。
- CLI/Plugin 完整相关测试 346 通过、1 项 Windows PowerShell 进程测试在 macOS 跳过；typecheck、lint（已有警告）、站点构建及 OpenSpec 严格校验通过。仓库级格式检查被本次范围外的 11 个旧文件挡住；本次变更的 TypeScript 文件另行检查。Linux/Windows 真实宿主链路仍属 4.3 的未完成边界。

## 2026-09-29 Agent 共用配置收敛

- `agent.shellSessionInjection` 替代未合并 PR 中的 Codex 专属字段。只改共享配置读取和当前消费它的 Codex Hook，不给其他宿主增加 Hook。测试确认旧 `codex` 字段不改变默认行为；编译 CLI 在隔离 HOME 读取 `agent: { shellSessionInjection: all-shell }` 时会改写外层 `sh read-practice.sh`，在用户现有配置下仍只改写带 `lore` 的命令。用户现有配置未修改，隔离测试配置已清理。
- CLI/Plugin 测试 346 通过、1 项 Windows PowerShell 进程测试在 macOS 跳过；typecheck、lint（已有警告）、站点构建、编译 CLI、Plugin 校验器、变更 TypeScript 文件格式检查及 OpenSpec 严格校验通过。Linux/Windows 真实宿主链路依旧没有验收。

## 2026-09-29 Linux 宿主验收记录

- 用户提供的 Arch x64 / Codex CLI 0.156.1 实测使用隔离的 HOME/CODEX_HOME、本地 Plugin 和与 PR `161c59a` 匹配的编译 CLI；未修改真实用户配置。在正常宿主运行环境，PreToolUse 改写与字段保留、`lore-only` / `all-shell` / 坏配置 / 非 Bash 分支、直接命令与本地子进程继承、原退出码均通过。
- 同一环境中，成功 `lore get` 将候选写入真实会话 ID 对应的 Backend 文件；`SubagentStart` 的短提示出现在真实子 Agent 上下文，未自动 `get` 或注入正文。失败 `get` 的退出码保持为 2。上述为用户提供的实测证据，本 worktree 未独立复跑 Linux；4.3 仍需 Windows 真实宿主验收。

## 6. ZCode 宿主接入（#254）

- [x] 6.1 `lore hook zcode` 处理 `PreToolUse`：仅 `Bash` tool 返回前置 Unix `export` 的 `updatedInput`（全平台，含 Windows Git Bash），不返回 `permissionDecision`（ZCode 中该字段的 `allow` 会放行待确认调用），沿用 `agent.shellSessionInjection` 判定并保留其余工具输入字段；非 Bash、缺会话 ID 或命令非字符串输出 no-op。单测覆盖三平台前缀、lore-only 文本判定、all-shell 真实配置、无效配置降级、非 Bash no-op 与真实 shell 子进程继承。
- [x] 6.2 ZCode Plugin `hooks.json` 增加匹配 `^Bash$` 的 `PreToolUse` process Hook；不注册 ZCode 不存在的 `SubagentStart`，不保留空跑 `PostToolUse`；插件测试覆盖配置形状、旧 CLI 的 `{"continue":true}` 降级透传与 payload 转发。
- [x] 6.3 同步双语 ZCode 用户指南、配置入口、Plugin README 与 `docs/cli/hook.md`：说明已读候选记录、注入范围配置、无子 Agent 提示的宿主边界、CMD 方言漏记与更新要求（更新 CLI 与 Plugin 后需新会话加载 Hook）。
- [ ] 6.4 在正常运行的 ZCode 宿主内完成真实链路验收：Hook 改写在真实 Bash 调用生效、成功 `get` 记录到正确会话、失败或 Backend 不可达不改 `get` 结果；当前交付以宿主产品 Hook schema 静态核对、真实 Git Bash 子进程执行与真实 Backend 集成测试替代，应用内会话级验收待具备新会话条件后补记。

## 2026-09-29 ZCode 宿主接入本轮验证

- 宿主合同静态核对：从 ZCode 产品安装的 `zcode.cjs` 提取 Hook 实现——`PreToolUse` stdin payload 含 `hook_event_name`、`session_id`、`tool_name`、`tool_input`（与 Codex 同形）；顶层输出 schema 为严格对象，`continue` 在所有事件上合法，`hookSpecificOutput.PreToolUse` 接受 `updatedInput` 且其应用独立于 `permissionDecision`，而 Hook `allow` 决定会把原本 `ask` 的调用直接放行——因此 ZCode 分支不返回权限决定。产品代码还确认 Hook（插件与工作区配置）只在会话启动时注册，应用内中途无法激活新 Hook，无头 CLI 不存在，这是 6.4 保持未勾的原因。
- 真实 ZCode Bash 工具（Windows、MINGW64 Git Bash）内执行源码 CLI 产出的改写后命令原文：直接命令、`sh -c` 脚本、管道与命令替换均继承 `zcode/e2e-zcode-session-1` 身份，退出码 23 与工作目录保持不变；外层文本不含 `lore` 时 Hook 返回 `{}`。
- 真实 Backend 集成：隔离 HOME 下从本 worktree 源码启动 Backend（ready、model unloaded），带成对身份的成功 `lore get`（项目 Pack）由 Backend 写入 `sessions/zcode/e2e-zcode-session-1/practice-reads.jsonl`，仅含 ID、digest、title、appliesWhen 与实际 cwd；会话 ID 为空串时 get 退出码 0 且不新增记录；停止 Backend 后同命令输出逐字节一致、退出码 0、无新文件。旧版已安装 CLI（0.1.0-alpha.3）对 `PreToolUse` 输出 `{"continue":true}` 且退出码 0。验证后已清理隔离目录并停止 Backend，真实用户 `~/.lorelum` 无 sessions 目录。
- 本轮 `bun test packages/cli`：375 通过、2 项进程测试在 Windows 跳过、0 失败（另 2 项失败为本机环境既有限制：无符号链接权限的 symlink 用例与 main.test.ts 超时用例，均已在干净 main 上复现，与本变更无关）；`bun run typecheck`、`bun run lint`（0 warning）、变更文件 `oxfmt --check`、`bun run build:site`、`openspec validate share-read-practice-hints --strict` 通过。

## 2026-09-29 ZCode 接入复审（对照被淘汰的 shell 包装方案）

- 复查 `570327f fix(plugins): run ZCode hooks without shell wrappers`（PR #193）：当时淘汰的是 Hook 调用本身走 `type: "command"` + 探测 Git Bash 的 polyglot wrapper（bash 缺失时 Hook 整体静默 no-op）。本次接入未重现该模式：新增的 `PreToolUse` Hook 同为 `process` 形式 argv 直调，插件目录无新增脚本，「不 ship shell 或 Git Bash Hook wrappers」测试仍通过；POSIX 语法只位于宿主自身 Bash tool 执行的命令前缀，bash 缺失时仅漏记可选读取，Hook 与 Catalog 不受影响。design.md、`docs/cli/hook.md`、Plugin README 与双语用户指南已补充分界说明与非 POSIX 方言的漏记行为。
- 补充权限语义精确性：ZCode 对改写后命令文本走正常权限规则评估；由于不返回权限决定，改写只会使行首锚定的规则少命中（更保守方向），不会放行原本需要确认的调用。
