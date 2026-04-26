# LifeTracker Agent 系统需求分析书

## 1. 背景

当前 LifeTracker 已经具备基础 AI 助手能力：用户可以通过自然语言创建任务、完成任务、开启番茄钟、记录运动、记录花费、更新复盘等。现有实现主要集中在 `backend/src/agent`，通过最近对话历史、系统提示词、工具调用和确认卡片完成交互。

随着后续长期迭代，Agent 需要从“能调用工具的聊天助手”升级为“可追踪、可记忆、可评测、可扩展的个人生活管理代理”。本需求分析书用于确定下一阶段架构改造范围，重点打好后续长期演进的基础。

## 2. 建设目标

### 2.1 核心目标

- 建立可长期迭代的 Agent 运行架构，避免所有逻辑继续堆在单个 service 中。
- 引入 Agent 运行记录和步骤追踪，方便排查“为什么这次调用错了”。
- 将任务确认卡片从聊天消息模型中解耦，形成独立确认队列。
- 引入长期记忆和用户画像，为个性化建议、偏好识别和长期目标管理做准备。
- 建立基础评测机制，减少每次改 Agent 后只能人工反复测试的问题。

### 2.2 非目标

- 本阶段不做复杂多 Agent 架构。
- 本阶段不引入向量数据库。
- 本阶段不让 Agent 自动修改系统提示词或业务规则。
- 本阶段不做完全自主执行，写操作仍保留确认模式。
- 本阶段不重写所有业务模块，只围绕 Agent 层做架构升级。

## 3. 当前问题分析

### 3.1 已有能力

- `AgentMessage` 保存用户消息、助手消息、确认消息和执行结果。
- `AGENT_TOOLS` 定义了可被模型调用的工具。
- `AgentToolsService` 执行任务、番茄钟、运动、花费、复盘等业务操作。
- `AgentService.chat()` 支持模型调用、工具调用、确认模式和 fallback。
- 前端 `AgentChatPanel` 已支持流式回复、Markdown 渲染和独立任务确认区域。

### 3.2 主要问题

- `AgentMessage` 同时承担聊天历史、确认卡片、执行结果、上下文记忆等多种职责，边界不清。
- 缺少 `AgentRun` 级别追踪，无法完整复盘一次请求经历了哪些模型调用和工具调用。
- 缺少长期记忆，Agent 只能依赖最近对话和业务数据，无法稳定记住用户偏好和长期目标。
- 缺少用户画像摘要，每轮对话无法稳定注入“这个用户是谁、最近在做什么”。
- fallback 和工具规划逻辑集中在 `AgentService`，后续继续扩展会变得难以维护。
- 缺少系统化评测用例，改 prompt、工具或确认逻辑后容易出现回归。

## 4. 目标架构

### 4.1 分层设计

```text
AgentController
  -> AgentRuntimeService
      -> ContextBuilder
      -> MemoryService
      -> ProfileService
      -> Planner
      -> ToolExecutor
      -> ConfirmationService
      -> TraceService
      -> EvaluationHooks
```

### 4.2 核心流程

```text
用户输入
  -> 创建 AgentRun
  -> 保存用户消息
  -> 加载短期对话上下文
  -> 检索长期记忆
  -> 加载用户画像摘要
  -> 构造模型上下文
  -> LLM 生成回复和工具意图
  -> 只读工具直接执行
  -> 写操作进入 AgentConfirmation
  -> 前端展示任务确认区
  -> 用户确认或取消
  -> ToolExecutor 执行写操作
  -> TraceService 记录结果
  -> MemoryService 后台沉淀长期记忆
```

## 5. 功能需求

### 5.1 Agent 运行追踪

系统需要记录每一次 Agent 请求的完整运行过程，包括输入、模型、提示词版本、工具版本、状态、耗时、错误和每一步详情。

#### 需求点

- 每次用户发送消息时创建一条 `AgentRun`。
- 每次模型调用、工具调用、确认生成、确认执行、记忆读取、记忆写入都创建 `AgentRunStep`。
- 出错时记录错误类型和错误信息。
- 支持通过 runId 查询本轮完整执行链路。
- 后台日志和数据库记录都应能定位同一轮请求。

### 5.2 独立确认队列

写操作确认不应继续依附在 `AgentMessage.role = confirm` 上，应拆成独立模型。

#### 需求点

- 写操作进入 `AgentConfirmation`。
- 前端任务确认区从确认队列读取当前轮 pending confirmations。
- 进入下一轮对话时，上一轮未处理确认项自动标记为 `expired` 或 `superseded`。
- 用户点击执行后，状态变为 `approved`，执行成功后变为 `executed`。
- 用户点击取消后，状态变为 `rejected`。
- 执行失败后，状态变为 `failed`，保存错误信息。

### 5.3 长期记忆

系统需要保存跨会话长期有效的信息，包括用户偏好、事实、目标、习惯和约束。

#### 记忆类型

- `preference`：用户偏好。例如“我喜欢 60 分钟番茄”。
- `fact`：用户事实。例如“我正在备考事业单位”。
- `goal`：长期目标。例如“本月完成申论复习”。
- `habit`：行为习惯。例如“用户经常晚上复盘”。
- `constraint`：约束。例如“不要自动执行写操作”。
- `procedure`：流程规则。初期只允许开发者写入，不允许 Agent 自动写入。

#### 写入原则

- 用户明确表达长期偏好或事实时可以写入。
- Agent 推断出来的记忆必须低置信度。
- 每条记忆保留来源、置信度和状态。
- 支持用户删除或修改记忆。
- 不将日常流水账全部写入长期记忆。

### 5.4 用户画像摘要

系统需要维护一份面向 Agent 的用户画像摘要，用于稳定注入上下文。

#### 画像内容

- 当前主要目标
- 学习或工作状态
- 常见任务类型
- 番茄钟偏好
- 运动习惯
- 回复风格偏好
- 重要约束和注意事项

#### 更新策略

- 初期由后台任务或手动触发更新。
- 后续可在每 N 轮对话后异步更新。
- 更新时应基于长期记忆、近期行为和用户明确表达的信息。

### 5.5 上下文构造

上下文构造需要从 `AgentService` 中拆出，形成独立 `ContextBuilder`。

#### 上下文来源

- 系统提示词
- 结构化意图提示
- 最近短期对话
- 用户画像摘要
- 相关长期记忆
- 当前业务数据摘要
- 重要工具执行结果

#### 约束

- 不应无脑塞入所有历史。
- 上下文必须可解释和可追踪。
- 每次构造上下文时记录使用了哪些 memory 和 profile 信息。

### 5.6 工具层规范化

所有 Agent 工具需要具备统一元数据和返回格式。

#### 工具元数据

```text
name
description
inputSchema
outputSchema
type: read | write
confirmationPolicy
idempotencyPolicy
examples
errorShape
```

#### 返回格式

建议逐步统一为：

```json
{
  "ok": true,
  "data": {},
  "message": "已创建任务",
  "error": null
}
```

失败时：

```json
{
  "ok": false,
  "data": null,
  "message": "任务存在歧义",
  "error": {
    "code": "AMBIGUOUS_TASK",
    "detail": "匹配到多个未完成任务"
  }
}
```

### 5.7 评测机制

建立基础 Agent 回归测试集，用于覆盖常见自然语言输入和期望工具行为。

#### 测试内容

- 创建任务
- 批量创建任务
- 完成任务
- 创建任务后开启番茄
- 完成任务后开启番茄
- 运动记录和运动感受
- 餐饮花费和其他花费
- 今日概况查询
- 任务歧义处理
- 不能出现 `任务ID undefined`
- 写操作不能直接进入聊天区

#### 用例格式

```json
{
  "name": "创建任务并开启番茄",
  "input": "创建测试任务A，并开启1小时番茄绑定测试任务A",
  "confirmMode": true,
  "expectedTools": ["create_task", "start_pomodoro"],
  "expectedConfirmationCount": 2,
  "mustNotContain": ["任务ID undefined"],
  "mustContain": ["测试任务A"]
}
```

## 6. 数据库设计草案

### 6.1 AgentRun

```prisma
model AgentRun {
  id               String   @id @default(uuid())
  userId           String   @map("user_id")
  input            String
  status           String   @default("running")
  model            String?
  promptVersion    String?  @map("prompt_version")
  toolsetVersion   String?  @map("toolset_version")
  confirmMode      Boolean  @default(true) @map("confirm_mode")
  errorCode        String?  @map("error_code")
  errorMessage     String?  @map("error_message")
  startedAt        DateTime @default(now()) @map("started_at") @db.Timestamptz(6)
  completedAt      DateTime? @map("completed_at") @db.Timestamptz(6)
  latencyMs        Int?     @map("latency_ms")

  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  steps            AgentRunStep[]
  confirmations    AgentConfirmation[]

  @@index([userId, startedAt])
  @@index([status])
  @@map("agent_runs")
}
```

### 6.2 AgentRunStep

```prisma
model AgentRunStep {
  id          String   @id @default(uuid())
  runId       String   @map("run_id")
  userId      String   @map("user_id")
  type        String
  status      String   @default("success")
  input       Json?
  output      Json?
  error       Json?
  durationMs  Int?     @map("duration_ms")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  run         AgentRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId, createdAt])
  @@index([userId, createdAt])
  @@index([type])
  @@map("agent_run_steps")
}
```

### 6.3 AgentConfirmation

```prisma
model AgentConfirmation {
  id             String   @id @default(uuid())
  runId          String   @map("run_id")
  userId         String   @map("user_id")
  toolName       String   @map("tool_name")
  args           Json
  summary        String
  status         String   @default("pending")
  result         Json?
  error          Json?
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  resolvedAt     DateTime? @map("resolved_at") @db.Timestamptz(6)
  executedAt     DateTime? @map("executed_at") @db.Timestamptz(6)

  run            AgentRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status, createdAt])
  @@index([runId])
  @@map("agent_confirmations")
}
```

### 6.4 AgentMemory

```prisma
model AgentMemory {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  type         String
  content      String
  data         Json?
  source       String
  confidence   Float    @default(1)
  status       String   @default("active")
  lastUsedAt   DateTime? @map("last_used_at") @db.Timestamptz(6)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type, status])
  @@index([userId, lastUsedAt])
  @@map("agent_memories")
}
```

### 6.5 UserAgentProfile

```prisma
model UserAgentProfile {
  id          String   @id @default(uuid())
  userId      String   @unique @map("user_id")
  summary     String?
  goals       Json     @default("[]")
  preferences Json     @default("{}")
  routines    Json     @default("{}")
  constraints Json     @default("[]")
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_agent_profiles")
}
```

## 7. API 设计草案

### 7.1 聊天接口

保留现有接口，内部改造为基于 `AgentRun`：

```text
POST /agent/chat/stream
```

请求：

```json
{
  "message": "创建任务A，开启1小时番茄",
  "confirmMode": true
}
```

流式事件建议：

```text
start
progress
reply_start
reply_delta
reply_done
confirmations
run_done
error
```

### 7.2 确认队列

```text
GET /agent/confirmations?status=pending
POST /agent/confirmations/:id/approve
POST /agent/confirmations/:id/reject
POST /agent/confirmations/:id/retry
```

### 7.3 运行追踪

```text
GET /agent/runs?limit=20
GET /agent/runs/:id
GET /agent/runs/:id/steps
```

初期可以只做后端接口，不急着做前端页面。

### 7.4 长期记忆

```text
GET /agent/memories
POST /agent/memories
PATCH /agent/memories/:id
DELETE /agent/memories/:id
```

### 7.5 用户画像

```text
GET /agent/profile
POST /agent/profile/rebuild
PATCH /agent/profile
```

## 8. 后端模块拆分建议

### 8.1 当前模块

```text
backend/src/agent
  agent.controller.ts
  agent.service.ts
  agent-tools.service.ts
  agent-intent.utils.ts
```

### 8.2 目标模块

```text
backend/src/agent
  agent.controller.ts
  agent.module.ts
  runtime/
    agent-runtime.service.ts
    context-builder.service.ts
    trace.service.ts
  tools/
    agent-tools.registry.ts
    agent-tools.service.ts
    tool-executor.service.ts
  confirmations/
    confirmation.service.ts
  memory/
    memory.service.ts
    profile.service.ts
  evals/
    agent-eval.runner.ts
  utils/
    agent-intent.utils.ts
```

第一阶段不需要一次性拆完，但新代码应尽量按这个方向落位。

## 9. 前端需求

### 9.1 聊天区

- 继续显示用户消息和 AI 总结。
- 支持 Markdown 渲染。
- 不显示确认卡片和执行卡片。
- 不显示内部上下文、工具 JSON 或 UUID。

### 9.2 任务确认区

- 独立显示当前轮 pending confirmations。
- 下一轮对话开始时自动替换为当前轮确认项。
- 执行或取消后移除对应卡片。
- 执行失败时显示错误状态，但不污染聊天区。

### 9.3 后续可选页面

- Agent 记忆管理页。
- Agent 运行日志调试页。
- 用户画像查看和编辑页。

## 10. 安全与权限

- 所有 Agent 数据必须按 `userId` 隔离。
- 用户只能读取和修改自己的 memory、profile、run、confirmation。
- 写操作必须继续支持确认模式。
- 记忆写入需要避免保存敏感信息。
- 长期记忆应支持删除，用户要求“忘掉”时必须可执行。
- 对外部链接和 Markdown 渲染保持安全限制。

## 11. 迁移策略

### 11.1 兼容原则

- 不一次性删除 `AgentMessage`。
- 先新增表和服务，再逐步迁移逻辑。
- 前端接口尽量保持兼容，减少联动风险。

### 11.2 分阶段迁移

#### 阶段一：Trace 地基

- 新增 `AgentRun` 和 `AgentRunStep`。
- `chat/stream` 创建 run。
- LLM 调用和工具调用写入 step。
- 不改变前端行为。

#### 阶段二：Confirmation 解耦

- 新增 `AgentConfirmation`。
- 写操作确认从 `AgentMessage` 迁移到 `AgentConfirmation`。
- 前端任务区读取新结构。
- 旧 `confirm` 消息保留兼容一段时间。

#### 阶段三：Memory 和 Profile

- 新增 `AgentMemory` 和 `UserAgentProfile`。
- 实现记忆 CRUD。
- `ContextBuilder` 注入 profile 和相关 memory。
- 初期只保存用户明确表达的长期信息。

#### 阶段四：评测集

- 新增 `backend/src/agent/evals` 或 `backend/agent-evals`。
- 建立基础 JSON 用例。
- 支持本地命令运行评测。

#### 阶段五：服务拆分

- 将 `AgentService` 中的上下文构造、确认、trace、memory 逐步拆出。
- 保持接口行为稳定。

## 12. 验收标准

### 12.1 Trace

- 每次聊天请求都有对应 `AgentRun`。
- 每次工具调用都有对应 `AgentRunStep`。
- 出错时可通过 runId 查到错误步骤。

### 12.2 Confirmation

- 聊天消息中不再保存新的确认卡片。
- 当前轮确认项只显示在任务确认区。
- 执行或取消不会向聊天区追加任务卡片文本。
- 下一轮对话开始时上一轮 pending 项不再展示。

### 12.3 Memory

- 用户明确说“以后番茄默认 60 分钟”后，系统能保存偏好。
- 后续用户说“开一个番茄”时，Agent 能参考该偏好。
- 用户说“忘掉番茄默认 60 分钟”后，记忆被删除或归档。

### 12.4 Profile

- 用户画像能展示当前目标、偏好和约束。
- Agent 回复能利用画像，但不直接暴露内部画像文本。

### 12.5 Evals

- 至少覆盖 20 条 Agent 用例。
- 改动 Agent prompt 或工具逻辑后能本地运行评测。
- 核心用例不能出现 `任务ID undefined`、重复确认卡片、写操作进入聊天区等问题。

## 13. 明日实施建议

如果计划一天内推进，建议按以下顺序：

1. 新增 Prisma 模型：`AgentRun`、`AgentRunStep`、`AgentConfirmation`、`AgentMemory`、`UserAgentProfile`。
2. 生成并应用数据库迁移。
3. 实现 `TraceService`，先让现有聊天流程写入 run 和 step。
4. 实现 `ConfirmationService`，把新确认项写入 `AgentConfirmation`。
5. 修改前端任务区数据结构，兼容新 confirmation 返回。
6. 实现最小版 `MemoryService`：手动 CRUD + ContextBuilder 读取 active memories。
7. 新增 10-20 条 agent eval JSON 用例。
8. 跑通一次端到端测试：聊天、确认、执行、刷新、下一轮对话。

## 14. 风险

- 一天内同时做建表、迁移、服务拆分和前端联动，范围较大，需要控制优先级。
- Confirmation 解耦会影响现有聊天历史和前端展示，需要保留兼容逻辑。
- Memory 自动写入如果过早放开，可能产生错误记忆或隐私问题。
- 工具返回格式统一会牵涉较多业务模块，建议逐步改，不要一次性全部重构。
- Agent eval 如果直接调用真实数据库，需要准备测试用户和清理策略。

## 15. 推荐优先级

必须做：

- `AgentRun`
- `AgentRunStep`
- `AgentConfirmation`
- `TraceService`
- `ConfirmationService`

应该做：

- `AgentMemory`
- `UserAgentProfile`
- `ContextBuilder`
- 基础 eval 用例

可以后做：

- 向量检索
- 多 Agent
- 记忆自动后台总结
- Agent 调试前端页面
- 自动 prompt 优化

