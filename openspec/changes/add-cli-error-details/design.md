# Design: add-cli-error-details

## 观察到的现状(evidence)

以下均为当前 worktree(`ba0edcc`)可复核的事实:

- 失败 envelope 与 schema:`packages/cli/src/output/protocol.ts:50-64` 的 `ProtocolFailure.error` 只有 `code`、`message`、可选 `recovery`;`protocol.ts:87-123` 的 failure schema 分支对 `error` 使用 `additionalProperties: false`;`createFailureEnvelope`(`protocol.ts:143-158`)是唯一构造入口。
- `CliError`(`packages/cli/src/runtime/errors.ts:29-40`)只持有 `code`、`message`、可选 `recovery`;`toVisibleCliError`(`errors.ts:47-50`)在错误码不在 command allowlist 时整体替换为 `runtime.unexpected`;`isCommanderError` 分支(`errors.ts:57-59`)直接折叠为无事实的 `invalidInvocationError()`。
- 顶层 catch(`packages/cli/src/main.ts:269-304`)只把 `code`、`message`、`recovery`、`diagnostics.traceId` 交给 `renderResult`;`packages/cli/src/output/render.ts:62-88` 按格式输出 JSON 或 structured text。
- Query 整数选项校验:`packages/cli/src/query/query-command.ts:105-111` 的 `parseIntegerOption` 在 throw 时拥有 option 名、上下界与收到值(调用点 `:291-296`),但折叠为固定 `usage.invalid`;query settings 校验:`packages/cli/src/query/settings.ts:23-28` 的 `integer()` 同样丢弃 field 名、界与收到值。
- Backend 侧事实丢失:`packages/backend/src/config/load.ts:33-40` 丢弃 Zod `issues`;`BackendError`(`packages/backend/src/protocol/errors.ts:43-52`)没有 details 通道;CLI 映射点(`query-command.ts:191-197`、`backend/control-commands.ts:127-130`)只透传 code/message/recovery。
- 版本先例:`error.recovery` 在 `protocolVersion: 1` 期间加入(commit `6d4da47`,#184)未 bump;必填字段 `diagnostics` 加入时才 bump 1→2(commit `0a0267b`,#213),该 commit 同时把 `diagnostics` 列入两个 envelope 分支的 `required`。
- 测试基线:`packages/cli/src/output/protocol-schema.test-helper.ts` 的手写校验器已支持 `additionalProperties`/`minItems`/`maxItems`,不支持字符串长度约束;golden fixture `protocol-envelope.fixture.json` 与 `protocol.test.ts`、`main.test.ts:191-239` 固定了当前失败形状。

## Goals

- 失败 envelope 获得一个受 schema 约束、可选的结构化 detail 通道,JSON consumer 不解析英文 message 即可获得类别、定位符、reason、期望与收到的事实。
- 同一事实在 text 模式压缩为人可执行的提示;既有 code、exit code、`traceId`、`recovery` 语义逐项不变。
- 两个 owning validator 首批接入,端到端证明链路;其余类别延后到对应 issue。

## Non-Goals

- 不实现 Issue #226 的完整 usage 类别(Commander 集成、`--mode` enum、互斥、缺失位置参数、dotted nested command)。
- 不实现 Issue #229 的 backend config 细节(Zod issues、YAML 行列、environment override);不改动 `packages/config` 的 `ConfigError` 形状。
- 不改变 error code 目录、退出码、success envelope、Backend 内部 protocol;不新增依赖或 MCP 面。

## 决策

1. **Detail 形状:扁平 entry + 封闭枚举 + 三变体 `expected`。** `kind`(`usage` | `configuration`)、`subject`(非空有界字符串)、`reason`(封闭枚举:`missing`、`invalid-type`、`invalid-value`、`out-of-range`、`conflicting-options`、`unknown-option`、`unknown-command`、`unknown-key`、`syntax`)为必有;`received`(有界字符串)、`expected`、`hint`(有界字符串)可选。`expected` 是 `enum { values[] }` | `integer-range { min, max }` | `type { name }` 的封闭 oneOf,数值范围用结构化 min/max 而非 prose。理由:足够表达两个首批消费者与 #226/#229 已列举的事实,同时每个字段都有封闭词表,不是逃生口。
2. **容器:数组,1..5 个 entry。** 多数首批场景只有一条事实;数组允许一个 validator 报告多个已验证问题(Zod issues 的自然形状),上限 5 控制输出体积;无事实时整体省略字段,不输出空数组。
3. **命名:envelope 字段 `error.details`,与 issue 提案一致;CLI 内部类型 `ErrorDetail`,模块 `packages/cli/src/output/error-details.ts`。** 该模块拥有:封闭枚举常量、长度预算常量、确定性截断工厂 `createErrorDetail`、text 压缩格式器。所有 producer 只经由工厂构造 entry,保证预算恒成立、schema 恒通过。
4. **预算与截断(确定性、可测试):** entry ≤5;`subject` ≤120、`received` ≤120、`hint` ≤200、enum 值 ≤16 个且每个 ≤64、type name ≤64(码位计)。超限字符串截断为前 `budget-3` 个码位 + `"..."`;enum 值超数取前 16。相同输入必须产生字节相同输出。
5. **秘密与回显:** `received` 只承载非秘密值;协议标记为 secret 的参数由 producer 不传值(仍传 `subject`/`reason`/`hint`)。路径、option 名、config key、enum、数值默认非秘密。本 change 的两个首批 validator 均不涉及 secret 值;规则由契约与工厂文档固定,#226/#229 落地具体 secret 参数时遵循。
6. **传输路径:** `CliError` 增加第 4 个可选构造参数 `details`;`BackendError` 增加第 4 个可选参数 `details`,类型为 backend 侧结构相同定义(沿用 `ErrorRecovery` / `BackendCompatibilityRecovery` 的结构性重复先例,避免 backend 依赖 CLI);CLI 侧 BackendError→CliError 映射点全部透传。`ProtocolFailure.error`、`createFailureEnvelope`、`RenderableResult` failure 变体、schema failure 分支同步增加可选 `details`。allowlist 降级路径已经构造全新 `runtime.unexpected`,自然丢弃 details;`isCommanderError` 转换继续不产生 details(不从 Commander message 反推)。
7. **`protocolVersion` 维持 2。** 先例划分清晰:可选加字段(`recovery`)版本内演进,新增必填字段(`diagnostics`)才 bump。rejected alternative:bump 到 3——会让固定 `protocolVersion === 2` 的 consumer 在包括 success 在内的所有响应上立即失败,比可选字段本身造成更大破坏。迁移说明写入 `docs/cli/README.md` 与站点双语页:严格校验冻结 schema 副本的 consumer 须改用随 CLI 导出的 `protocolResponseSchema`。测试固定:不带 details 的失败与既有形状一致、`protocolVersion` 不变、带 details 的失败通过导出 schema。
8. **Text 压缩:** `render.ts` 的 failure 分支在 text 模式把每条 detail 经格式器压成一行(`subject`、期望、received、hint 的确定性拼接),以字符串数组交给既有 `renderStructuredText`;JSON 模式保留完整结构。不新增第二种 text 渲染机制。
9. **Schema 能力扩展:** `JsonSchema` 类型与 `protocol-schema.test-helper.ts` 增加 `minLength`/`maxLength` 支持,使 detail 字符串预算在 schema 层自证;这也是公共 schema 对外声明预算的方式。
10. **首批 producer:** `parseIntegerOption`(增加 option 参数,覆盖 `--max-wait-ms`、`--min-coverage-percent`;`--top-k` 的 digits-only 解析与其 engine 侧范围校验不在本次范围)与 query settings 的 `integer()`(增加 config key 参数,覆盖 `query.maxWaitMs`、`query.minCoveragePercent`);`document.query` 形状错误与 `ConfigError` 路径保持 detail-less。未知路径一律不虚构 detail。

## Risks / Trade-offs

- **封闭枚举的演进成本:** 新 reason/kind 需要 schema 与文档同步扩展;这是有意为之(防止 detail 变成自由文本),扩展点集中在 `error-details.ts`。
- **两个包的类型重复:** CLI 与 backend 各定义一次结构相同的 detail 类型;以结构化类型系统桥接,测试中用赋值兼容断言防漂移(先例:`ErrorRecovery` 与 `BackendCompatibilityRecovery` 亦无单一 owner)。
- **details 数组截断顺序:** 多条事实超过 5 条时保留 producer 顺序的前 5 条;首批两个 producer 都只产生单条,规则在工厂内固定并测试。

## 延后工作(Deferred)

- Issue #226:Commander 错误的结构化提取(需在 Commander 边界拥有事实,而非解析 message)、`--mode` enum、互斥选项、缺失 query 文本、dotted nested command。
- Issue #229:backend config 的 Zod issues 映射、`packages/config` YAML 行列/来源事实(需要单独扩展 `ConfigError`)、environment override 定位。
- 未来类别(如 `retrieval`、`store`)与新 expected 变体:须扩展本契约的枚举与 schema,并保持 `additionalProperties: false`。
- 将 engine 既有结构化错误(如 `ValidationReport`)映射为 details:待对应命令的 owning 边界明确后评估。
