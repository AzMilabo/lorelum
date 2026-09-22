## Why

`lore --json` 的失败 envelope 只暴露 `error.code`、`error.message` 和仅服务于 Backend compatibility 的 `error.recovery`,而公共 JSON schema 又以 `additionalProperties: false` 拒绝其他字段。usage 与 config 的具体原因(option 名、config key、允许值/范围)在 owning validator 处已经明确,却在到达顶层 renderer 之前被固定文案压扁;下游调用者只能反复试错、重新阅读 Help,或解析英文 prose。Issue #223 要求为这些已经验证过的诊断事实提供一个小而受约束的公共通道。

## What Changes

本 change 引入新的产品行为:

- 失败 envelope 新增可选 `error.details` 数组,每项是一个固定的 discriminated 形状,不是任意 key-value map:
  - `kind`:封闭枚举 `usage` | `configuration`(后续类别须扩展契约);
  - `subject`:稳定定位符(option flag、config key、位置参数名等);
  - `reason`:封闭枚举(缺失、类型不符、非法值、越界、互斥、未知 option/command/key、YAML 语法等小枚举);
  - 可选 `received`、`expected`(`enum` / `integer-range` / `type` 三种受约束变体)与一条 `hint`。
- JSON schema 显式定义该结构并对每个层级保持 `additionalProperties: false`;schema 不接受未定义属性。
- `CliError` 与 `BackendError` 增加可选 details 字段;顶层 catch、failure envelope 构造器、JSON schema 与 text renderer 无损传递;当错误码因 command allowlist 降级为 `runtime.unexpected` 时,details MUST 被丢弃。
- 结构化事实只由 owning validator 产生(option parser、settings validator、config loader);顶层 catch 与 renderer MUST NOT 从 message 或日志文本反推 detail,未知或未验证原因保持现有简短错误。
- 值回显规则:option 名、config key、路径、enum、数值与非秘密字符串默认保留;协议明确标记为 secret 的值 MUST NOT 回显值本身,但保留字段名与违反的规则;输出体积有明确、可测试的预算(details 数组上限、单字段长度上限与确定性截断)。
- 兼容性策略:`protocolVersion` 维持 `2`。依据既有先例——可选字段 `error.recovery` 在 v1 内加入而未 bump,必填字段 `diagnostics` 加入时才 bump 到 v2——`error.details` 是可选的失败侧字段,属版本内演进;严格校验旧版 schema 副本的 consumer 必须改用随 CLI 版本导出的 schema,该迁移说明 MUST 写入用户文档并由测试固定。
- text 输出把同一事实压缩为每条一行的可行动提示;`--json` 保留完整结构。既有 error code、exit code、`traceId`、`recovery` 语义不变。
- 首批接入两类 owning validator 作为端到端证明:`lore query` 的整数选项校验(`--max-wait-ms`、`--min-coverage-percent`)与 query settings 的整数校验(`query.maxWaitMs`、`query.minCoveragePercent`)。Commander 解析错误、`--mode` enum、互斥选项、Backend config 与 YAML 细节等其余类别分别属于 Issue #226 与 Issue #229,本 change 只交付它们依赖的公共 transport、schema 与兼容性决策。

## Capabilities

### New Capabilities

- `cli-error-details`: 公共失败 envelope 中结构化诊断事实的契约——字段形状与封闭枚举、owning validator 产生边界、降级丢弃规则、秘密回显与输出预算、以及 protocolVersion 兼容策略。

### Modified Capabilities

无。`retrieval-query` 既有 envelope/exit-code 要求不因可选 details 改变语义;`error.recovery` 契约保持不变。

## Impact

- `packages/cli/src/output/`:新增 `error-details.ts`(类型、封闭枚举、长度预算与截断工厂、text 压缩格式器);`protocol.ts`(`ProtocolFailure.error.details`、schema 分支、`createFailureEnvelope`);`render.ts`(failure 结果与双格式传递);schema test helper 增加长度约束支持。
- `packages/cli/src/runtime/errors.ts`:`CliError` 可选 details 字段;`packages/backend/src/protocol/errors.ts`:`BackendError` 可选 details 字段,CLI 侧 BackendError→CliError 映射点透传。
- `packages/cli/src/main.ts`:顶层 catch 把 details 传入渲染结果;`packages/cli/src/query/{query-command.ts,settings.ts}`:两个首批 validator 产生 typed detail。
- 测试:`output/error-details.test.ts`、`output/protocol.test.ts` 与 golden fixture、`main.test.ts` 的 usage/config 全链路矩阵、`query/settings.test.ts`、Backend 映射透传测试;Commander 路径与 allowlist 降级无 details 的负向断言。
- 文档:`docs/cli/README.md`(envelope 与兼容性说明)、`apps/site/content/docs/cli.mdx` 与 `cli.zh.mdx`(字段表与迁移说明)。
- 不新增依赖、不新增监听地址或 MCP 接口、不改变 success envelope、不改变退出码。
