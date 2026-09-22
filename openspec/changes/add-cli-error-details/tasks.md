# Tasks: add-cli-error-details

## 1. 契约基础模块

- [x] 1.1 新建 `packages/cli/src/output/error-details.ts`:`ErrorDetailKind`/`ErrorDetailReason` 封闭枚举、`ErrorDetailExpected` 三变体、`ErrorDetail` 类型、长度预算常量、确定性截断工厂 `createErrorDetail`(entry ≤5、subject/received ≤120、hint ≤200、enum 值 ≤16×64、超限截断加 `...`)。验证:`bun test packages/cli/src/output/error-details.test.ts`(枚举封闭、预算、确定性截断、空可选字段省略)。
- [x] 1.2 扩展 `packages/cli/src/output/protocol.ts` 的 `JsonSchema` 类型与 `packages/cli/src/output/protocol-schema.test-helper.ts` 校验器,支持 `minLength`/`maxLength`。验证:`bun test packages/cli/src/output/protocol.test.ts`(既有 schema 拒绝用例不回归,新长度约束生效)。

## 2. 传输通道

- [x] 2.1 `protocol.ts`:`ProtocolFailure.error` 增加可选 `details`;failure schema 分支增加 `details`(数组 1..5、entry 与 `expected` 变体全部 `additionalProperties: false`、封闭枚举、长度约束);`createFailureEnvelope` 增加可选 details 参数。验证:`bun test packages/cli/src/output/protocol.test.ts`。
- [x] 2.2 `render.ts`:`RenderableResult` failure 变体增加可选 `details`;JSON 路径透传,text 路径经 `formatErrorDetail` 压缩为字符串数组交给 `renderStructuredText`。验证:`bun test packages/cli/src/output/render.test.ts`。
- [x] 2.3 `runtime/errors.ts`:`CliError` 增加第 4 个可选 `details` 构造参数;确认 `toVisibleCliError` 降级路径与 Commander 转换不携带 details。验证:errors 相关单测(降级丢弃、Commander 无 details)。
- [x] 2.4 `packages/backend/src/protocol/errors.ts`:`BackendError` 增加可选 `details` 参数(backend 侧结构相同类型);CLI 侧 BackendError→CliError 映射点透传 details(`query-command.ts`、`backend/control-commands.ts`、`backend/common.ts`、`index/index-commands.ts`)。验证:对应映射单测 + CLI/backend 类型结构兼容断言。

## 3. 首批 owning validator

- [x] 3.1 `query-command.ts`:`parseIntegerOption` 增加 option 定位参数,非法/越界时产生 `kind: "usage"` detail(subject=option flag、reason=invalid-type|out-of-range、received、expected=integer-range、hint);调用点传入 `--max-wait-ms`、`--min-coverage-percent`。验证:`bun test packages/cli/src/query/query-command.test.ts`。
- [x] 3.2 `query/settings.ts`:`integer()` 增加 config key 参数,失败时产生 `kind: "configuration"` detail(subject=`query.maxWaitMs` 等、received 为 YAML 值的规范表示、expected=integer-range、hint);`document.query` 形状错误与 `ConfigError` 路径保持 detail-less。验证:`bun test packages/cli/src/query/settings.test.ts`。

## 4. 端到端与兼容性测试

- [x] 4.1 `main.test.ts` usage fixture:`--min-coverage-percent 101` 的 JSON envelope(exit 2、`usage.invalid`、details[0] 完整断言、schema 校验通过)与 text stderr 压缩提示。验证:`bun test packages/cli/src/main.test.ts`。
- [x] 4.2 `main.test.ts` config fixture:隔离 HOME(`USERPROFILE`)写入 `query.maxWaitMs: nope`,`lore query ... --json` 返回 `query.config-invalid` + details;text 路径同样断言。验证:同上。
- [x] 4.3 负向与兼容性:Commander 错误路径无 details;allowlist 降级丢 details;无 details 失败 envelope 与既有形状一致且 `protocolVersion` 仍为 2。验证:`bun test packages/cli/src/main.test.ts` 与 errors 单测。
- [x] 4.4 golden fixture `protocol-envelope.fixture.json` 增加 details failure 条目;schema 拒绝 detail 内未知属性、非法 kind/reason、未知 expected 变体、空数组。验证:`bun test packages/cli/src/output/protocol.test.ts`。

## 5. 文档

- [x] 5.1 `docs/cli/README.md`:失败 envelope 形状、`error.details` 契约摘要与 v2 内可选演进的兼容性说明(链接站点页,不重述)。验证:人工核对与站点页不重复。
- [x] 5.2 `apps/site/content/docs/cli.mdx` 与 `cli.zh.mdx`:envelope 字段表新增 `error.details` 行、结构示例与迁移说明(英文/中文同步)。验证:两页 diff 对应。

## 6. 集成验证

- [x] 6.1 `bun test packages/cli` 全绿;`bun test packages/backend` 不回归。
- [x] 6.2 `bun run typecheck`、`bun run lint` 通过。
- [x] 6.3 `openspec validate add-cli-error-details --strict` 通过。

## 验证记录(执行过的命令与结果)

- 1.1/1.2:`bun test packages/cli/src/output/error-details.test.ts` — 10/10 pass(截断确定性、封闭枚举、schema 拒绝未定义属性/非法枚举/超预算);helper minLength/maxLength 以码位计数。
- 2.1–2.4:`bun test packages/cli/src/output/protocol.test.ts` + `render.test.ts` + `runtime/errors.test.ts` + `backend/common.test.ts` — 全部 pass;BackendError→CliError 透传由 common.test.ts 行为断言 + `BackendErrorDetail`→`ErrorDetail` 结构镜像赋值(编译期)双重覆盖,query/index/control 三个映射点为同一模式。
- 3.1/3.2:`bun test packages/cli/src/query/settings.test.ts` 与 `main.test.ts` 的两条全链路 fixture — pass。usage 链路由 main.test.ts 覆盖(query-command.test.ts 现有 harness 不直接调用 handler)。
- 4.1–4.4:`bun test packages/cli` — 296 pass / 0 fail(含 golden fixture 第三条 details entry、Commander 无 details、allowlist 降级丢 details、protocolVersion 仍为 2)。
- 5.1/5.2:docs/cli/README.md 与 apps/site/content/docs/cli.{mdx,zh.mdx} 已同步更新且互不重述(站点含示例与迁移说明,维护者文档链接站点)。
- 6.1:`bun test packages/cli` 296 pass;`bun test packages/backend` 197 pass / 4 skip / 0 fail。
- 6.2:`bun run typecheck` 通过;`bun run lint` 0 errors(仓库既有 33 warnings,本变更文件 0 warnings / 0 errors)。
- 6.3:`openspec validate add-cli-error-details --strict` 通过。
- 对抗性复核(独立 checker,以 thermo-nuclear-code-quality-review 方法论试图反驳 PR 完成说辞,严重度按"维护者会行动"校准):10 条说辞初判 8 条存活,2 条(C2/C5"每条 detail 一行")被真实反例部分驳倒——`received` 含真实 CR/LF 时(YAML block scalar / 含换行 CLI 参数可达)text 输出退化为多行 `- |` 块。修复:`truncate()` 在计量预算前将 CR/LF 转义为字面 `\r`/`\n`(覆盖全部受预算字符串)并新增回归测试;checker 增量复核 RESOLVED,`bun test packages/cli` 298 pass / 0 fail。两条 minor(transport 层运行时校验缺失、空数组守卫三处重复)记录为非阻塞改进项。
- CI 修复:config fixture 在 Linux 上失败——运行中修改 `HOME` 环境变量不影响已启动进程的 `os.homedir()` 解析,导致 CLI 读到真实 HOME、未命中临时 config 而走到 `backend.failed`。改为 `Bun.spawn` 以隔离 HOME 启动真实入口进程(跨平台一致的启动期环境),断言不变;`bun test packages/cli/src/main.test.ts` 10/10、全包 298/0。
