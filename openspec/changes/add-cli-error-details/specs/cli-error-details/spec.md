## Purpose

为公共 `lore` 失败响应提供一个小而受约束的结构化诊断通道:由 owning validator 验证过的事实(option、config key、reason、允许值/范围、修正 hint)能够无损到达 `--json` envelope 与 text 输出,而不是在固定文案处丢失,同时不暴露未验证的猜测、任意内部对象或被协议标记为 secret 的值。

## ADDED Requirements

### Requirement: Failure envelope carries validator-owned structured details

失败 envelope SHALL 支持可选的 `error.details` 数组,每项是一个固定的 discriminated 对象,不是任意 key-value map。每个 entry MUST 提供:

- `kind`:封闭枚举 `usage` 或 `configuration`;新增类别 MUST 先扩展本契约。
- `subject`:非空的稳定定位符,例如 option flag、位置参数名或 config key。
- `reason`:封闭枚举,至少覆盖缺失、类型不符、非法值、越界、互斥、未知 option、未知 command、未知 key 与 YAML 语法。
- 可选 `received`:调用者提交值的规范字符串表示,受输出预算约束。
- 可选 `expected`:受约束的三种变体之一——`enum`(允许值列表)、`integer-range`(含上下界的整数范围)或 `type`(期望类型名)。
- 可选 `hint`:一条可直接执行的修正提示。

公共 JSON schema MUST 显式定义该结构,且 `error`、每个 detail entry、每个 `expected` 变体都保持 `additionalProperties: false`;schema MUST 拒绝未定义属性、未列出的 `kind`/`reason` 值、未知 `expected` 变体与空 details 数组。没有已验证事实的失败 MUST 整体省略 `error.details`,而不是输出空数组。

#### Scenario: An out-of-range query option returns structured facts

- **WHEN** 调用者执行 `lore query "release validation" --min-coverage-percent 101 --json`
- **THEN** 失败 envelope MUST 仍以 `usage.invalid` 与 exit code 2 返回,且 `error.details[0]` MUST 包含 `kind: "usage"`、`subject: "--min-coverage-percent"`、稳定 reason、收到的值与整数范围;该 envelope MUST 通过公共 schema 校验

#### Scenario: An invalid query setting returns structured facts

- **WHEN** 用户的 `~/.lorelum/config.yaml` 含 `query.maxWaitMs: nope`,且调用者执行 `lore query "release validation" --json`
- **THEN** 失败 envelope MUST 仍以 `query.config-invalid` 与 exit code 2 返回,且 `error.details[0]` MUST 定位 `query.maxWaitMs`、指明类型/范围事实与修正 hint;detail 由该 setting 的 owning validator 产生

#### Scenario: A failure without verified facts omits details

- **WHEN** 一个失败没有 owning validator 验证过的结构化事实
- **THEN** envelope MUST 省略 `error.details` 并且保持既有最小形状;它 MUST NOT 输出空数组或占位 entry

### Requirement: Details originate from owning validators only

结构化事实 MUST 只由真正拥有被违反规则的组件在该事实仍然已知的边界产生,例如 option 校验器、query settings 校验器或 config loader。顶层错误转换、allowlist 过滤与 renderer MUST 只做无损传递、文本压缩与协议一致性处理,并 MUST NOT 从固定 message、Commander message 或日志文本反推或虚构 detail。当错误码因 command allowlist 不包含而被降级为 `runtime.unexpected` 时,原 details MUST 被丢弃;`CliError` 与 `BackendError` 之间的既有错误映射 MUST 无损透传双方都携带的 details。

#### Scenario: A Commander parse failure stays detail-free

- **WHEN** 调用者提交 Commander 在解析阶段拒绝的输入(例如未知 flag)
- **THEN** 命令 MUST 返回不带 `error.details` 的 `usage.invalid`;框架 MUST NOT 通过解析 Commander 的 message 文本来构造 detail

#### Scenario: An allowlist downgrade drops details

- **WHEN** 一个携带 details 的错误码不在所选 command 的公开 allowlist 中
- **THEN** 顶层 MUST 返回不带 details 的 `runtime.unexpected`,而不是把不属于该命令契约的定位事实暴露给调用者

### Requirement: Non-secret diagnostic facts stay bounded and secrets stay redacted

本机排障事实——option 名、config key、路径、普通 enum、数值与非秘密字符串——默认不是 secret,detail MUST NOT 以泛化的"安全"理由抹掉它们;当它们能直接帮助修正时,`subject`、`received` 与 `expected` SHOULD 保留。被协议明确标记为 secret 的值 MUST NOT 出现在 `received` 中,但 detail 仍 MUST 保留 `subject`、`reason` 与修正方向。输出体积 MUST 有明确、确定性的预算:details entry 数量有上限,`subject`、`received`、`hint` 与 enum 值有长度上限,超限值 MUST 按稳定规则截断,使相同输入总是产生相同输出。

#### Scenario: A long free-text value is truncated deterministically

- **WHEN** 被拒绝的选项值超过 received 的输出预算
- **THEN** detail MUST 保留可定位的截断表示,同一次输入在重复调用下 MUST 产生字节相同的截断结果

#### Scenario: A secret-marked value is not echoed

- **WHEN** 拥有规则的组件拒绝一个协议标记为 secret 的参数值
- **THEN** detail MUST 保留该参数的 subject、reason 与修正 hint,而 `received` MUST 不包含该值本身

### Requirement: Error-details compatibility preserves the failure contract

`error.details` 是失败 envelope 在 `protocolVersion: 2` 内的可选演进:依据既有先例(v1 内新增可选 `error.recovery` 未 bump 版本;新增必填 `diagnostics` 才 bump 到 v2),本次变更 MUST NOT 改变 `protocolVersion`、既有 error code、exit code、`traceId`、`recovery` 语义或 success envelope。不带 details 的失败 MUST 与既有 envelope 逐字节同形;带 details 的失败 MUST 通过随 CLI 导出的公共 schema。用户文档 MUST 说明严格校验固定 schema 副本的 consumer 需要改用随版本导出的 schema 这一迁移路径。text 模式 MUST 把同一 details 事实压缩为人可直接采取行动的提示并写到 stderr,不要求 `--json` 才能获得修正方向。

#### Scenario: An old-shape failure remains valid

- **WHEN** 任何不产生 details 的既有失败路径执行
- **THEN** 其 JSON envelope MUST 不包含新必需字段、保持 `protocolVersion: 2`,并通过导出的公共 schema 校验

#### Scenario: Text output compresses the same facts

- **WHEN** 一个携带 details 的失败以 text 模式输出
- **THEN** stderr MUST 在既有 `error.code`、`message`、`recovery` 呈现之外,包含每条 detail 的事实压缩(定位符、期望与收到的关键事实、hint),且 exit code 与 error code 不变
