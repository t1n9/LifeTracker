# LifeTracker 学习计划系统需求分析书

## 1. 背景

LifeTracker 已具备完整的每日执行层：任务管理、番茄钟、复盘、运动、花费记录，以及 Agent 智能助手。但缺少"目标 → 计划 → 执行"的上游链路。

用户（备考生、自学者）普遍面临的问题：
- 有学习目标但不知道怎么拆解成每天的具体任务
- 有课程资料但不知道怎么安排学习节奏
- 知道考试时间但无法合理分配备考周期

本模块目标：在现有每日执行层之上，建立从**目标设定 → AI 编排 → 每日注入**的完整闭环。

---

## 2. 核心概念

```
StudyPlan（学习计划）
  └── Subject（科目）
        └── Chapter（章节，可由 OCR 导入）
  └── WeeklyPlan（周计划，AI 生成）
        └── DailySlot（每日任务槽）
              └── → Task（注入任务模块执行）
```

---

## 3. 功能需求

### 3.1 引导式建档（首次创建）

分步骤对话式引导，不使用长表单。每步都有跳过/手动填写兜底。

#### 步骤一：选择目标类型

- 内置模板：国考/省考、考研、雅思/托福、职业资格证、自定义
- 选择模板后预填科目列表和默认权重
- 支持完全自定义

#### 步骤二：确认考试信息

- 自动触发网络搜索（见 3.5 节）
- 展示搜索结果：考试名称、报名时间、笔试时间、来源网址
- 用户选择"就是这个"或"不对，我来填"
- 手动填写时只需填：考试名称 + 笔试日期

#### 步骤三：用户情况采集

- 备考状态：全职 / 在职
- 工作日每天可用小时（选项：1/2/3/4/4+）
- 周末每天可用小时（选项：2/4/6/全天）
- 节假日是否正常学习（是/否）
- 当前距考试时间自动计算

#### 步骤四：科目与基础

- 展示该考试模板的默认科目列表
- 用户可增删科目
- 每个科目选择基础程度：零基础 / 有基础 / 较强
- 每个科目可上传课程资料图片（触发 OCR，见 3.4 节）
- 可跳过，使用系统默认权重

#### 步骤五：生成预览与确认

- AI 按周生成学习计划（见 3.3 节）
- 展示计划大纲：每阶段主题 + 时长分配
- 用户可直接确认，或进入调整模式
- 确认后保存计划，侧边栏正式开放

---

### 3.2 侧边栏界面

主页右侧弹出式侧边栏，日常收起（只显示图标），点击展开。

#### 3.2.1 概览 Tab（默认）

```
目标：2025国考
距考试：87天
总体进度：████░░ 42%

本周完成率：60%
上周完成率：75%

今日推荐：
  · 行测 - 数量关系  2h
  · 申论 - 大作文    1h
[加入今日任务]
```

- "加入今日任务"将今日推荐任务写入任务模块
- 如果已开启今日，直接追加；未开启则在开启时提示

#### 3.2.2 科目 Tab

- 每个科目显示进度条（已完成章节/总章节）
- 展开可查看章节列表和每章完成状态
- 支持手动标记某章节完成

#### 3.2.3 周计划 Tab

- 显示当前周和下一周的每日任务槽
- 简单周视图：7格，每格显示当日计划任务量（小时数）
- 点击某天查看当天详细任务列表
- 不支持拖拽编辑（第一版）

#### 3.2.4 设置 Tab

- 修改考试时间
- 修改每日可用时长
- 修改科目权重
- 重新生成计划（保留完成记录）
- 暂停/归档计划

---

### 3.3 AI 计划编排

#### 输入参数

```json
{
  "examDate": "2025-11-30",
  "totalDays": 87,
  "dailyHoursWeekday": 3,
  "dailyHoursWeekend": 6,
  "subjects": [
    {
      "name": "行测",
      "weight": 0.6,
      "level": "有基础",
      "chapters": ["数量关系", "言语理解", "资料分析", "判断推理"]
    },
    {
      "name": "申论",
      "weight": 0.4,
      "level": "零基础",
      "chapters": ["归纳概括", "综合分析", "大作文"]
    }
  ]
}
```

#### 编排逻辑

1. 计算总可用学习小时数
2. 按科目权重分配总时长
3. 按章节数量和难度分配各科时长
4. 按阶段划分：基础期 → 专项期 → 强化期 → 冲刺期
5. 以周为粒度生成 WeeklyPlan，以天为粒度生成 DailySlot
6. 冲刺期最后2周固定为真题练习

#### 重排逻辑（执行偏差处理）

- 每周结束时统计完成率
- 完成率 < 70%：下周自动补排未完成内容，压缩后续阶段
- 完成率 >= 70%：正常推进
- 用户手动跳过某天：该天任务顺延到下一个可用天
- 不自动删除任何任务，只顺延

---

### 3.4 OCR 课程识别

#### 流程

```
用户上传图片
  → 调用 OCR API 提取文字
  → AI 结构化解析（识别章节名、序号）
  → 展示可编辑表格
      | 章节名        | 预计时长 |
      | 数量关系       |  ____h  |  ← 用户填写
      | 言语理解       |  ____h  |
  → 用户确认后写入 Chapter 表
```

#### 技术选型

- OCR：腾讯云通用文字识别（按量计费，极低成本）或百度 OCR
- 结构化解析：调用 LLM，prompt 提取章节列表
- 支持多张图片上传（分章节拍照）

#### 边界情况

- 识别结果为空：提示用户手动输入
- 识别结果混乱：展示原始文字，让用户自行整理
- 时长字段：OCR 不尝试识别时长，全部由用户手动填写

---

### 3.5 网络搜索 + 众包确认

#### 搜索流程

```
用户选择考试类型
  → 构造搜索关键词（如"2025国家公务员考试时间"）
  → 优先查询 TrustedSource 表
      → 有匹配且未过期 → 直接抓取该页面内容展示
      → 无匹配或已过期 → 调用搜索引擎 API
  → 展示结果给用户确认
  → 用户确认 → 写入/更新 TrustedSource
```

#### 可信源记录（TrustedSource）

- 每条记录绑定 query（搜索意图）和 url
- 任何用户确认的 url 都会被记录
- 有效期：6个月（超期自动降级，需用户重新确认）
- useCount 统计引用次数，用于排序

#### 搜索 API 选型

- 优先：Bing Search API（结构化，适合官方公告检索）
- 备选：SerpApi（Google 结果）
- 搜索结果只展示标题 + 摘要 + 来源，不自动信任

#### 用户确认界面

```
找到以下信息，请确认是否正确：

2025年国家公务员考试公告
报名时间：10月15日 - 10月24日
笔试时间：11月30日
来源：国家公务员局 (scs.acs.gov.cn)

[✓ 信息正确，使用这个] [✗ 不对，手动填写]
```

---

### 3.6 每日开启联动

用户点击"开启今日"时（现有 DailyData 模块）：

- 检查今天是否有学习计划任务
- 如有，在开启今日流程中新增一个区块：
  ```
  📚 今日学习计划
  · 行测 - 数量关系  2h
  · 申论 - 归纳概括  1h
  [全部加入任务] [选择加入] [今天跳过]
  ```
- 选择"今天跳过"：该天 DailySlot 标记为 skipped，触发重排
- 加入任务后，任务模块显示这些任务（带"来自学习计划"标签）

---

### 3.7 完成追踪与进度反馈

- 任务完成时，如果该任务来自学习计划（taskSourceId 关联 DailySlot），自动更新 DailySlot 状态
- 每周统计完成率，在概览 Tab 展示
- 完成率低于 70% 时，概览 Tab 显示提示：
  ```
  ⚠️ 上周完成率 55%，本周需追回 4.5h
  建议本周适当延长每日学习时间
  ```
- Agent 可读取计划进度，在日常对话中提醒

---

## 4. 数据库设计

### 4.1 StudyPlan（学习计划）

```prisma
model StudyPlan {
  id               String    @id @default(uuid())
  userId           String    @map("user_id")
  title            String
  examType         String    @map("exam_type")        // national_exam / postgraduate / ielts / custom
  examName         String    @map("exam_name")        // "2025国家公务员考试"
  examDate         DateTime  @map("exam_date") @db.Date
  status           String    @default("active")       // active / paused / archived / completed
  employmentType   String    @map("employment_type")  // fulltime / employed
  weekdayHours     Float     @map("weekday_hours")
  weekendHours     Float     @map("weekend_hours")
  holidayEnabled   Boolean   @default(true) @map("holiday_enabled")
  promptVersion    String?   @map("prompt_version")
  generatedAt      DateTime? @map("generated_at") @db.Timestamptz(6)
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  subjects         StudySubject[]
  weeklyPlans      WeeklyPlan[]

  @@index([userId, status])
  @@map("study_plans")
}
```

### 4.2 StudySubject（科目）

```prisma
model StudySubject {
  id          String   @id @default(uuid())
  planId      String   @map("plan_id")
  name        String
  weight      Float    @default(0.5)     // 0-1，各科权重之和=1
  level       String   @default("beginner") // beginner / intermediate / advanced
  totalHours  Float?   @map("total_hours")  // AI 分配的总时长
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  plan        StudyPlan      @relation(fields: [planId], references: [id], onDelete: Cascade)
  chapters    StudyChapter[]

  @@index([planId])
  @@map("study_subjects")
}
```

### 4.3 StudyChapter（章节）

```prisma
model StudyChapter {
  id            String    @id @default(uuid())
  subjectId     String    @map("subject_id")
  title         String
  estimatedHours Float   @map("estimated_hours")
  actualHours   Float     @default(0) @map("actual_hours")
  status        String    @default("pending")  // pending / in_progress / completed
  sortOrder     Int       @default(0) @map("sort_order")
  source        String    @default("manual")   // manual / ocr
  completedAt   DateTime? @map("completed_at") @db.Timestamptz(6)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  subject       StudySubject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  dailySlots    DailyStudySlot[]

  @@index([subjectId, status])
  @@map("study_chapters")
}
```

### 4.4 WeeklyPlan（周计划）

```prisma
model WeeklyPlan {
  id              String   @id @default(uuid())
  planId          String   @map("plan_id")
  weekNumber      Int      @map("week_number")   // 第几周（从1开始）
  weekStart       DateTime @map("week_start") @db.Date
  weekEnd         DateTime @map("week_end") @db.Date
  phase           String                          // foundation / specialized / intensive / sprint
  targetHours     Float    @map("target_hours")
  actualHours     Float    @default(0) @map("actual_hours")
  completionRate  Float    @default(0) @map("completion_rate")
  status          String   @default("upcoming")  // upcoming / active / completed / skipped
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  plan            StudyPlan        @relation(fields: [planId], references: [id], onDelete: Cascade)
  dailySlots      DailyStudySlot[]

  @@unique([planId, weekNumber])
  @@index([planId, weekStart])
  @@map("weekly_plans")
}
```

### 4.5 DailyStudySlot（每日任务槽）

```prisma
model DailyStudySlot {
  id            String    @id @default(uuid())
  weeklyPlanId  String    @map("weekly_plan_id")
  planId        String    @map("plan_id")
  userId        String    @map("user_id")
  chapterId     String?   @map("chapter_id")
  date          DateTime  @db.Date
  subjectName   String    @map("subject_name")
  chapterTitle  String    @map("chapter_title")
  plannedHours  Float     @map("planned_hours")
  actualHours   Float     @default(0) @map("actual_hours")
  status        String    @default("pending")  // pending / injected / completed / skipped / rescheduled
  taskId        String?   @map("task_id")      // 注入任务模块后关联的 Task.id
  injectedAt    DateTime? @map("injected_at") @db.Timestamptz(6)
  completedAt   DateTime? @map("completed_at") @db.Timestamptz(6)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  weeklyPlan    WeeklyPlan    @relation(fields: [weeklyPlanId], references: [id], onDelete: Cascade)
  chapter       StudyChapter? @relation(fields: [chapterId], references: [id])
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date])
  @@index([planId, date])
  @@index([weeklyPlanId])
  @@map("daily_study_slots")
}
```

### 4.6 OcrUpload（OCR 上传记录）

```prisma
model OcrUpload {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  subjectId     String?  @map("subject_id")
  imageUrl      String   @map("image_url")
  rawText       String   @map("raw_text")
  parsedResult  Json     @map("parsed_result")  // AI 结构化结果
  status        String   @default("pending")    // pending / confirmed / discarded
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("ocr_uploads")
}
```

### 4.7 TrustedSource（众包可信网站库）

```prisma
model TrustedSource {
  id              String    @id @default(uuid())
  query           String                        // 搜索意图，如"2025国考时间"
  url             String
  title           String
  summary         String?
  useCount        Int       @default(1) @map("use_count")
  lastConfirmedAt DateTime  @map("last_confirmed_at") @db.Timestamptz(6)
  expiresAt       DateTime  @map("expires_at") @db.Timestamptz(6)  // lastConfirmedAt + 6个月
  status          String    @default("active")  // active / expired
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  confirmations   TrustedSourceConfirmation[]

  @@unique([query, url])
  @@index([query, status])
  @@map("trusted_sources")
}

model TrustedSourceConfirmation {
  id        String   @id @default(uuid())
  sourceId  String   @map("source_id")
  userId    String   @map("user_id")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  source    TrustedSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([sourceId, userId])
  @@map("trusted_source_confirmations")
}
```

### 4.8 User 模型新增关联

```prisma
// 在 User 模型中新增
studyPlans              StudyPlan[]
dailyStudySlots         DailyStudySlot[]
ocrUploads              OcrUpload[]
trustedSourceConfirmations TrustedSourceConfirmation[]
```

---

## 5. API 设计

### 5.1 学习计划 CRUD

```
POST   /study-plans                    创建学习计划（引导完成后调用）
GET    /study-plans                    获取当前用户所有计划
GET    /study-plans/active             获取当前激活计划（含今日槽、本周进度）
GET    /study-plans/:id                获取单个计划详情
PATCH  /study-plans/:id                修改计划基本信息
DELETE /study-plans/:id                归档计划
POST   /study-plans/:id/regenerate     重新生成计划（保留完成记录）
POST   /study-plans/:id/pause          暂停计划
POST   /study-plans/:id/resume         恢复计划
```

### 5.2 科目与章节

```
POST   /study-plans/:id/subjects               新增科目
PATCH  /study-plans/:id/subjects/:subjectId    修改科目
DELETE /study-plans/:id/subjects/:subjectId    删除科目

POST   /study-plans/:id/subjects/:subjectId/chapters         新增章节
PATCH  /study-plans/:id/subjects/:subjectId/chapters/:chId   修改章节
DELETE /study-plans/:id/subjects/:subjectId/chapters/:chId   删除章节
POST   /study-plans/:id/subjects/:subjectId/chapters/:chId/complete  标记完成
```

### 5.3 周计划与每日槽

```
GET    /study-plans/:id/weekly                     获取全部周计划列表
GET    /study-plans/:id/weekly/:weekNumber         获取某周详情（含每日槽）
GET    /study-plans/:id/today                      获取今日任务槽
POST   /study-plans/:id/slots/:slotId/inject       将槽注入任务模块
POST   /study-plans/:id/slots/:slotId/skip         跳过今日（触发重排）
POST   /study-plans/:id/slots/:slotId/complete     手动标记完成
GET    /study-plans/:id/stats                      计划统计（完成率、进度等）
```

### 5.4 OCR

```
POST   /study-plans/ocr/upload     上传图片，返回 OCR 原始文字 + AI 结构化结果
POST   /study-plans/ocr/:uploadId/confirm    用户确认结构化结果，写入章节
DELETE /study-plans/ocr/:uploadId            丢弃 OCR 结果
```

### 5.5 网络搜索

```
POST   /study-plans/search/exam-info         搜索考试信息
  Body: { query: "2025国考时间" }
  返回: { trusted?: TrustedSource, results: SearchResult[] }

POST   /study-plans/search/confirm           用户确认搜索结果
  Body: { sourceId?: string, url: string, title: string, query: string }
  返回: 确认后的 TrustedSource
```

### 5.6 每日开启联动

```
GET    /study-plans/today-suggestion         给每日开启模块调用，返回今日推荐任务
POST   /study-plans/inject-today             将今日推荐任务批量注入任务模块
```

---

## 6. 后端模块结构

```
backend/src/study-plan/
  study-plan.module.ts
  study-plan.controller.ts
  study-plan.service.ts          主服务：CRUD、状态管理
  study-plan-generator.service.ts  AI 计划编排
  study-plan-scheduler.service.ts  重排逻辑、每日槽管理
  study-plan-ocr.service.ts        OCR 上传与解析
  study-plan-search.service.ts     网络搜索 + TrustedSource 管理
  study-plan-stats.service.ts      进度统计
  dto/
    create-study-plan.dto.ts
    update-study-plan.dto.ts
    create-subject.dto.ts
    create-chapter.dto.ts
    inject-today.dto.ts
  templates/
    exam-templates.ts              内置考试模板（科目+权重预设）
```

---

## 7. 前端模块结构

```
frontend/src/
  app/
    study-plan/                    独立页面（日历完整视图，可选）
      page.tsx
  components/
    StudyPlanSidebar.tsx           主侧边栏容器（弹出式）
    StudyPlanOnboarding.tsx        引导式建档流程（分步）
    StudyPlanOverview.tsx          概览 Tab
    StudyPlanSubjects.tsx          科目 Tab
    StudyPlanWeekly.tsx            周计划 Tab
    StudyPlanSettings.tsx          设置 Tab
    StudyPlanOcrUpload.tsx         OCR 上传组件
    StudyPlanSearchConfirm.tsx     搜索结果确认组件
    StudyPlanTodayWidget.tsx       每日开启嵌入组件
```

---

## 8. 考试模板

内置模板预设科目列表和默认权重，用户可修改。

```typescript
// exam-templates.ts

export const EXAM_TEMPLATES = {
  national_exam: {
    label: '国考/省考',
    subjects: [
      { name: '行测', weight: 0.6, level: 'beginner',
        defaultChapters: ['数量关系', '言语理解', '资料分析', '判断推理', '常识判断'] },
      { name: '申论', weight: 0.4, level: 'beginner',
        defaultChapters: ['归纳概括', '综合分析', '提出对策', '大作文'] },
    ],
  },
  postgraduate: {
    label: '考研',
    subjects: [
      { name: '数学', weight: 0.3, level: 'beginner',
        defaultChapters: ['高数', '线代', '概率论'] },
      { name: '英语', weight: 0.25, level: 'beginner',
        defaultChapters: ['词汇', '阅读', '翻译', '写作'] },
      { name: '政治', weight: 0.2, level: 'beginner',
        defaultChapters: ['马原', '毛中特', '史纲', '思修'] },
      { name: '专业课', weight: 0.25, level: 'beginner',
        defaultChapters: [] }, // 用户自定义
    ],
  },
  ielts: {
    label: '雅思/托福',
    subjects: [
      { name: '听力', weight: 0.25, level: 'beginner', defaultChapters: [] },
      { name: '阅读', weight: 0.25, level: 'beginner', defaultChapters: [] },
      { name: '写作', weight: 0.25, level: 'beginner', defaultChapters: [] },
      { name: '口语', weight: 0.25, level: 'beginner', defaultChapters: [] },
    ],
  },
  custom: {
    label: '自定义目标',
    subjects: [],
  },
};
```

---

## 9. AI 编排 Prompt 设计

```
系统角色：你是一个专业的学习计划编排助手。

输入：
- 考试类型、考试时间
- 科目列表（含权重、基础程度、章节列表）
- 总可用天数、每日可用小时数（工作日/周末分开）

输出格式（JSON）：
{
  "phases": [
    {
      "name": "基础期",
      "weekRange": [1, 4],
      "focus": "夯实各科基础知识"
    }
  ],
  "weeklyPlans": [
    {
      "weekNumber": 1,
      "phase": "foundation",
      "targetHours": 21,
      "dailySlots": [
        {
          "dayOfWeek": 1,  // 1=周一
          "subjectName": "行测",
          "chapterTitle": "数量关系",
          "plannedHours": 2
        }
      ]
    }
  ]
}

规则：
1. 最后2周固定为冲刺期（真题练习为主）
2. 每日任务不超过用户声明的可用时长
3. 基础差的科目在基础期分配更多时间
4. 单日不要只安排一个科目，保持多样性
5. 冲刺期不新增新章节
```

---

## 10. 关键交互流程

### 10.1 首次创建完整流程

```
用户点击侧边栏图标（无计划状态）
  → 全屏引导弹窗打开
  → Step 1: 选考试类型
  → Step 2: 搜索/确认考试信息
  → Step 3: 填写个人情况
  → Step 4: 科目设置 + OCR（可选）
  → Step 5: AI 生成计划预览
  → 用户确认 → POST /study-plans
  → 侧边栏展示概览 Tab
```

### 10.2 每日执行流程

```
用户点击"开启今日"
  → GET /study-plans/today-suggestion
  → 如有今日槽，在开启今日界面追加学习计划区块
  → 用户选择[全部加入/选择加入/跳过]
  → POST /study-plans/inject-today（加入任务模块）
  → 用户执行任务（番茄钟）
  → 任务完成 → 自动更新 DailyStudySlot.status = completed
```

### 10.3 任务完成回写

```
Task 标记完成时（TasksService.update isCompleted=true）
  → 检查该 Task 是否有关联的 DailyStudySlot（通过 taskId）
  → 有关联 → StudyPlanSchedulerService.onTaskCompleted(slotId)
  → 更新 DailyStudySlot.status = completed
  → 更新 StudyChapter.actualHours
  → 更新 WeeklyPlan.completionRate
```

---

## 11. 安全与权限

- 所有接口必须 JWT 鉴权
- 所有数据库操作按 userId 隔离
- OCR 上传图片存储在对象存储（腾讯云 COS / 阿里云 OSS），不存在本地
- TrustedSource 是全局共享的，但 TrustedSourceConfirmation 是用户级别的
- 网络搜索结果不能直接信任，必须展示给用户确认后才能使用

---

## 12. 非目标（本阶段不做）

- 日历拖拽编辑
- 多计划同时激活
- 计划分享给他人
- 自动识别视频目录（只做图片 OCR）
- 学习时间统计图表（后续迭代）
- 番茄钟与计划章节的精确绑定（任务级别已足够）

---

## 13. 验收标准

### 13.1 引导建档

- 用户可以在5步内完成建档并看到生成的计划
- 每步都有跳过路径，不强制填写所有字段
- OCR 识别失败时有手动兜底

### 13.2 计划生成

- 生成的计划覆盖从今天到考试前最后一周
- 每日任务时长不超过用户设定的可用时长
- 最后2周为冲刺期

### 13.3 每日联动

- 开启今日时能看到今日学习计划任务
- 注入后任务列表中显示对应任务（带"来自学习计划"标签）
- 任务完成后自动回写计划进度

### 13.4 OCR

- 上传图片后10秒内返回识别结果
- 识别结果以可编辑表格展示
- 用户确认后章节正确写入对应科目

### 13.5 网络搜索

- 搜索结果展示来源网址
- 用户确认前不自动使用任何搜索结果
- 同一 query 的已确认来源会被优先推荐

### 13.6 重排

- 用户跳过某天后，该天任务自动顺延
- 每周完成率低于70%时，下周显示补排提示
