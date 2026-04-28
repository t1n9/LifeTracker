# PRD：AI 主动陪伴系统

**版本**：v1.0  
**日期**：2026-04-28  
**状态**：待开发

---

## 一、背景与目标

### 现状
AI 助手目前是纯被动模式——用户发消息，AI 回复。开启今日和晚间复盘是独立的弹窗组件（DayReflection），与 AI 对话完全割裂。

### 目标
将 AI 从"问答工具"升级为"全天陪伴"：
- 在关键节点**主动介入**，引导用户完成开启今日、任务规划、进度推进、晚间复盘
- 用动画提示替代强弹窗，不打扰用户
- 让用户感受到陪伴感，而非被工具服务

---

## 二、功能范围

### 纳入本次（Phase 1）
- 晨间流：开启今日 → 任务规划（接入 AI 对话）
- 番茄结束主动推送
- AgentChatPanel 动画提示状态
- 后端 `/agent/proactive` 接口

### 纳入 Phase 2
- 任务完成推送
- 晚间复盘流
- 冷却控制精细化

### 不做
- 定时推送（不用 cron，只响应用户行为事件）
- 强弹窗，只做 panel 内消息 + 图标动画
- 对话状态机持久化（session 内记录，刷新重置）

---

## 三、删除的旧组件

以下组件和功能将被**移除**，其职能完全由 AI 对话承接：

### 前端删除
| 文件 / 元素 | 说明 |
|------------|------|
| `components/daily/DayReflection.tsx` | 开启今日 + 复盘的双模态弹窗，整体删除 |
| `Dashboard.tsx` — `isDayReflectionOpen` 状态 | 控制弹窗的状态变量 |
| `Dashboard.tsx` — `dayReflectionMode` 状态 | 弹窗模式状态 |
| `Dashboard.tsx` — `dayStarted` 状态 | 已开启标记 |
| `Dashboard.tsx` — `dayStartRefreshTrigger` 状态 | 刷新触发器 |
| `Dashboard.tsx` — 顶栏 Sunrise / Sunset 按钮 | 触发弹窗的两个图标按钮 |
| `Dashboard.tsx` — DayReflection 渲染块 | `{isDayReflectionOpen && <DayReflection .../>}` |
| `PendingTasks.tsx` — `dayStartRefreshTrigger` prop | 接收刷新触发的 prop |
| `PendingTasks.tsx` — `dayStart` 状态和晨间记录 UI | 任务列表顶部的晨间记录展示块 |
| `PendingTasks.tsx` — `loadDayStart()` 及相关 effect | 加载晨间记录的逻辑 |

### 保留不动
| 文件 | 原因 |
|------|------|
| `lib/api.ts` — `dailyAPI` | 后端 AI agent 仍会调用 `start_day` / `update_day_reflection` 工具 |
| `HistoryViewer.tsx` — dayStart / dayReflection 展示 | 历史记录仍需展示这两个字段 |
| `services/historyService.ts` — DayData 接口 | 历史数据结构不变 |
| `lib/agent-events.ts` — `dayStart` 事件域 | AI 工具执行后仍触发此事件刷新界面 |

---

## 四、触发节点设计

### 4.1 晨间流（Morning Flow）

**触发条件**：今日无 `dayStart` 记录 + 用户打开 app  
**触发方式**：AgentChatPanel 图标呼吸动画（持续），panel 展开后显示主动消息  
**退出条件**：用户说"先不管"/"待会" / 流程完成 / 超过 10 分钟无回复

**对话流程**：
```
AI 主动: "早上好 🌅 今天几点起的？"

用户: "7点半"
  → AI 调用 start_day(wakeUpTime: "07:30")

AI: "今天有学习计划吗？"
  [有计划] → "我看备考安排了今天学 [科目]，要按计划来？"
             用户确认 → 注入今日学习槽为任务
  [无计划] → "今天想做什么？说一下我帮你列好"
             用户描述 → create_tasks 批量创建

AI: "好，[任务清单]已经排好了。要开始第一个番茄吗？"
```

**AI 生成消息的 context 数据**：
- `dailyData.dayStart`（是否已开启）
- `studyPlan`（今日学习槽）
- `currentGoal`（当前目标）
- `tasks`（已有任务）

---

### 4.2 番茄结束推送（Pomodoro Done）

**触发条件**：一个 WORK 番茄完成  
**触发方式**：AgentChatPanel 图标快速闪烁 1 次，panel 内插入消息  
**冷却规则**：同一任务连续番茄，间隔至少 2 个才再次主动发

**消息策略**（根据今日第几个番茄选择）：
```
第 1 个: "完成一个 🍅 专注了 25 分钟，[任务名] 进展怎么样？"
第 3 个: "连续 3 个番茄了 💪 要不要起来动一动？"
任务接近完成（估算）: "感觉 [任务名] 快收尾了？完成了告诉我"
```

**AI 生成消息的 context 数据**：
- 绑定任务名
- 今日已完成番茄数
- 今日运动记录（有无）

---

### 4.3 晚间复盘流（Evening Flow）— Phase 2

**触发条件**：用户手动点击复盘入口，或所有任务完成后 AI 引导  
**对话目标**：收集复盘内容 → 记录运动感受 → 生成今日总结

```
AI: "今天收工了，来复盘一下——
     学了 X 小时，完成 N 个任务。[有运动] 还记录了运动。
     今天最有收获的是什么？"

用户: 随意描述
  → AI 调用 update_day_reflection

AI: "记下来了。明天继续，好好休息 🌙"
```

---

### 4.4 任务完成推送（Task Done）— Phase 2

**触发条件**：标记任务完成  
**触发方式**：panel 内插入消息，无图标动画

```
AI: "[任务名] ✓ 今天还有 N 个待完成，继续还是休息一下？"
全部完成时: "今天的任务全清了 🎉 要开始复盘吗？"
```

---

## 五、技术方案

### 5.1 前端事件系统（扩展 agent-events.ts）

```typescript
// 新增主动触发事件常量
export const PROACTIVE_TRIGGER_EVENT = 'agent:proactive_trigger';

export type ProactiveTrigger =
  | 'morning'        // 晨间流
  | 'pomodoro_done'  // 番茄结束
  | 'task_done'      // 任务完成（Phase 2）
  | 'evening'        // 晚间复盘（Phase 2）

export interface ProactiveTriggerPayload {
  trigger: ProactiveTrigger;
  context?: {
    taskId?: string;
    taskTitle?: string;
    pomodoroCount?: number;   // 今日第几个番茄
  };
}
```

### 5.2 AgentChatPanel 动画状态

```typescript
type PanelHintState = 'idle' | 'breathing' | 'flash'
// idle:      无提示
// breathing: 晨间流待触发（持续呼吸灯，直到用户打开 panel）
// flash:     番茄/任务事件（闪烁 1 次后回 idle）
```

动画实现：CSS animation，breathing 用 `box-shadow` pulse，flash 用 `opacity` keyframe。

### 5.3 后端新接口

**`POST /agent/proactive`**

```typescript
// Request
{
  trigger: 'morning' | 'pomodoro_done' | 'task_done' | 'evening';
  context?: {
    taskId?: string;
    pomodoroCount?: number;
  };
}

// Response：与现有 /agent/chat streaming 相同格式
// 直接将 AI 生成的消息存入 agent_messages 表并 streaming 返回
```

后端逻辑：
1. 根据 trigger 类型拼装专用 system prompt（简短、有情绪、针对节点）
2. 并行拉取必要 context（今日数据、任务、计划等）
3. 调用 AI 生成一条消息
4. 存入 `agent_messages`，streaming 返回给前端

### 5.4 触发时序

```
PomodoroTimer 番茄完成
  → dispatch(PROACTIVE_TRIGGER_EVENT, { trigger: 'pomodoro_done', context: { taskId, pomodoroCount } })
  → AgentChatPanel 监听到事件
  → 图标 flash 动画
  → 调用 POST /agent/proactive
  → streaming 消息插入对话列表

Dashboard 初始化
  → 检查 dailyAPI.getTodayStatus()
  → 若无 dayStart → dispatch(PROACTIVE_TRIGGER_EVENT, { trigger: 'morning' })
  → AgentChatPanel 进入 breathing 状态
  → 用户打开 panel → 自动调用 POST /agent/proactive
  → streaming 消息开启晨间流
```

### 5.5 冷却控制（Phase 1 简化版）

前端 session 内维护一个 Map：
```typescript
const cooldownMap = new Map<string, number>();
// key: `${trigger}:${taskId}`
// value: 上次触发时的 pomodoroCount

// 检查：当前 count - lastCount >= 2 才允许触发
```

不持久化，刷新重置，Phase 2 再改为后端控制。

---

## 六、删除工作清单（开始编码前确认）

- [ ] 删除 `components/daily/DayReflection.tsx`
- [ ] `Dashboard.tsx`：删除 DayReflection import、4 个相关状态、2 个顶栏按钮、渲染块；删除 Sunrise/Sunset 图标 import
- [ ] `PendingTasks.tsx`：删除 `dayStartRefreshTrigger` prop、`dayStart` 状态、`loadDayStart()`、晨间记录 UI 块、`dailyAPI` import（若无其他使用）
- [ ] 确认 `agent-events.ts` 的 `dayStart` 事件域保留（AI 工具仍使用）
- [ ] 确认 `HistoryViewer.tsx` 的 dayStart/dayReflection 展示保留

---

## 七、验收标准

### Phase 1
- [ ] 用户首次打开 app（无 dayStart）→ AgentChatPanel 图标呼吸动画
- [ ] 打开 panel → AI 自动发出晨间问候，引导起床时间 → 任务规划
- [ ] 通过 AI 对话完成的任务规划，任务正确出现在任务列表
- [ ] 番茄结束 → 图标闪烁 1 次 → panel 内出现主动消息
- [ ] 同一任务连续番茄，第 2 个不重复推送
- [ ] 旧的 Sunrise/Sunset 按钮不再出现
- [ ] 历史记录中仍能查看 dayStart/dayReflection 内容
