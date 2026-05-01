import { Injectable } from '@nestjs/common';
import { TasksService } from '../tasks/tasks.service';
import { PomodoroService } from '../pomodoro/pomodoro.service';
import { ExpenseService } from '../expense/expense.service';
import { ExerciseService } from '../exercise/exercise.service';
import { DailyService } from '../daily/daily.service';
import { StudyService } from '../study/study.service';
import { GoalsService } from '../goals/goals.service';
import { ImportantInfoService } from '../important-info/important-info.service';
import {
  AgentTaskCandidate,
  findBestTaskMatch,
  resolveTaskMatch,
  sanitizeTaskTitle,
  TaskMatchResolution,
  toTaskMatchKey,
} from './agent-intent.utils';

// LLM Function Calling 的 tool 定义
export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_today_summary',
      description: '获取今日概况，包括今日任务、学习时长、番茄钟数量、花费、运动等',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_today_tasks',
      description: '获取今日有效任务列表。包括今天创建、今天到期、今天完成，或今天有学习/番茄记录的任务，返回时要区分已完成和未完成状态',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'start_day',
      description: '开启今日：标记一天开始 + 记录起床时间 + 一句话主题/口号。\n严禁把当日任务列表/时段安排/做了什么塞进 dayStart——任务必须用 create_tasks 单独创建。\n用户说"开启今天"、"新的一天"、"7:30起床"时调用。如果用户同时给出了任务列表/时段安排，你必须先用 create_tasks 把任务建出来，再调用本工具。',
      parameters: {
        type: 'object',
        properties: {
          dayStart: {
            type: 'string',
            description: '一句话主题/口号/心情，最多 30 字。例如："冲刺备考第3天"、"专注 + 早睡"、"考前最后一天"。绝不要写任务清单、时段安排、做了什么——那些必须用 create_tasks 创建为任务',
          },
          wakeUpTime: { type: 'string', description: '起床时间，格式 HH:mm，如 "07:30"' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_task',
      description: '创建一个新任务',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题' },
          subject: { type: 'string', description: '学科/科目' },
          priority: { type: 'number', description: '优先级，0-3，3最高' },
          estimatedHours: { type: 'number', description: '预估耗时（小时）' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_tasks',
      description: '批量创建任务。适合处理"今天任务是A+B+C"、"待办有..."这类明确任务列表；已存在的未完成任务会自动跳过',
      parameters: {
        type: 'object',
        properties: {
          titles: {
            type: 'array',
            items: { type: 'string' },
            description: '任务标题列表',
          },
        },
        required: ['titles'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_task',
      description: '修改一个已有任务的属性（标题、优先级、预估时长等）。用户说"把XX任务改成..."、"调整任务时间"、"XX任务优先级提高"等时调用。需要提供 taskId 或 taskTitle 来定位任务',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '任务ID，优先使用' },
          taskTitle: { type: 'string', description: '任务标题，用于匹配未完成任务（当没有 taskId 时）' },
          newTitle: { type: 'string', description: '新标题' },
          priority: { type: 'number', description: '优先级 0-3，3最高' },
          estimatedHours: { type: 'number', description: '预估耗时（小时）' },
          subject: { type: 'string', description: '学科/科目' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'complete_task',
      description: '将一个任务标记为已完成。优先传 taskId；如果只有任务标题，也可传 taskTitle 或 taskName，工具会自动匹配现有未完成任务。若同时匹配多个未完成任务，会返回歧义错误，不会自动猜测',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '任务ID，优先使用这个字段' },
          taskTitle: { type: 'string', description: '任务标题；当没有 taskId 时用于匹配现有未完成任务' },
          taskName: { type: 'string', description: '兼容旧参数，等同于 taskTitle' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_tasks',
      description: '获取今日未完成任务列表，用于查找番茄钟可绑定候选。全局完成任务不要依赖这个列表，应直接调用 complete_task',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'start_pomodoro',
      description: '开启一个番茄钟计时。duration 单位为分钟，默认25分钟。只能关联今日有效且未完成的任务；如果用户要立刻开始一个尚不存在的新任务，可传 taskTitle 并把 createTaskIfMissing 设为 true，工具会自动创建今日新任务并关联。如果 taskTitle 同时匹配多个今日未完成任务，工具会返回歧义错误，不会自动猜测',
      parameters: {
        type: 'object',
        properties: {
          duration: { type: 'number', description: '时长（分钟），默认25' },
          taskId: { type: 'string', description: '要关联的任务ID，优先使用这个字段' },
          taskTitle: { type: 'string', description: '任务标题；当没有 taskId 时用于匹配现有任务，必要时可自动创建任务' },
          taskName: { type: 'string', description: '兼容旧参数，等同于 taskTitle' },
          createTaskIfMissing: { type: 'boolean', description: '当 taskTitle 未匹配到现有未完成任务时，是否自动创建并关联该任务' },
          isCountUpMode: { type: 'boolean', description: '是否为正计时模式，默认false' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'stop_pomodoro',
      description: '停止当前正在运行的番茄钟',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_pomodoro_status',
      description: '获取当前番茄钟的状态',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'record_meal_expense',
      description: '记录餐饮花费（早餐/午餐/晚餐）',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'], description: '餐饮类别' },
          amount: { type: 'number', description: '金额（元）' },
        },
        required: ['category', 'amount'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'record_other_expense',
      description: '记录其他花费（非餐饮）',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: '花费描述/用途' },
          amount: { type: 'number', description: '金额（元）' },
          notes: { type: 'string', description: '备注' },
        },
        required: ['description', 'amount'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_today_expenses',
      description: '获取今日花费记录',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'record_exercise',
      description: '记录一次运动。AI 自行决定运动名称、emoji 和单位，无需预配置类型。',
      parameters: {
        type: 'object',
        properties: {
          exerciseName: { type: 'string', description: '运动名称，如"俯卧撑"、"跑步"、"深蹲"、"游泳"' },
          emoji: { type: 'string', description: '代表该运动的 emoji，如 💪 🏃 🏊 🚴' },
          value: { type: 'number', description: '数值，如 30（次）、5.2（公里）' },
          unit: { type: 'string', description: '单位，如 次、km、分钟、组' },
          note: { type: 'string', description: '可选备注' },
        },
        required: ['exerciseName', 'value', 'unit'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_today_exercise',
      description: '获取今日运动记录',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_exercise_feeling',
      description: '记录今日运动感受/状态。用户说"今天运动感觉很棒"、"运动状态不错"等时调用',
      parameters: {
        type: 'object',
        properties: {
          feeling: { type: 'string', enum: ['excellent', 'good', 'normal', 'tired'], description: '运动感受：excellent(非常棒)、good(不错)、normal(一般)、tired(疲惫)' },
        },
        required: ['feeling'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_important_info',
      description: '更新重要信息/公告。用户说"添加重要信息"、"设置重要提醒"、"记一下重要的事"等时调用。这会替换当前的重要信息内容',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '重要信息内容' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_day_reflection',
      description: '更新今日复盘/反思。用户要求写复盘或总结今天时调用。注意：查完今日数据后必须调用此工具保存复盘内容，不能只输出文字而跳过保存步骤',
      parameters: {
        type: 'object',
        properties: {
          dayReflection: { type: 'string', description: '今日反思内容' },
          phoneUsage: { type: 'number', description: '今日手机使用时间（分钟）' },
        },
        required: ['dayReflection'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_current_goal',
      description: '获取用户当前活跃的系统目标，包括目标名称、目标日期、描述等',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_goal',
      description: '设置或更新用户的系统目标。用户说"设定目标"、"我的目标是..."、"备考..."等时调用。会自动终止旧目标并创建新目标',
      parameters: {
        type: 'object',
        properties: {
          goalName: { type: 'string', description: '目标名称，如"备考法考"、"雅思7分"' },
          targetDate: { type: 'string', description: '目标截止日期，ISO格式，如"2025-12-01"' },
          description: { type: 'string', description: '目标描述（可选）' },
        },
        required: ['goalName'],
      },
    },
  },
];

interface ResolvedTaskReference {
  taskId?: string;
  taskTitle?: string;
  matchType?: 'taskId' | 'exact' | 'contains' | 'created';
  taskCreated?: boolean;
  error?: string;
}

@Injectable()
export class AgentToolsService {
  constructor(
    private tasksService: TasksService,
    private pomodoroService: PomodoroService,
    private expenseService: ExpenseService,
    private exerciseService: ExerciseService,
    private dailyService: DailyService,
    private studyService: StudyService,
    private goalsService: GoalsService,
    private importantInfoService: ImportantInfoService,
  ) {}

  async executeTool(userId: string, toolName: string, args: Record<string, any>): Promise<any> {
    switch (toolName) {
      case 'get_today_summary':
        return this.getTodaySummary(userId);
      case 'get_today_tasks':
        return this.tasksService.getTodayEffectiveTasks(userId);
      case 'start_day':
        return this.dailyService.updateDayStart(userId, { dayStart: args.dayStart, wakeUpTime: args.wakeUpTime });
      case 'create_task':
        return this.tasksService.create(userId, {
          title: args.title,
          subject: args.subject,
          priority: args.priority,
          estimatedHours: args.estimatedHours,
        } as any);
      case 'create_tasks':
        return this.createTasks(userId, args.titles);
      case 'update_task':
        return this.updateTask(userId, args);
      case 'complete_task':
        return this.completeTask(userId, args);
      case 'get_tasks':
        return this.getTodayPendingTaskCandidates(userId);
      case 'start_pomodoro':
        return this.startPomodoroWithTaskReference(userId, args);
      case 'stop_pomodoro':
        return this.stopActivePomodoro(userId);
      case 'get_pomodoro_status':
        return this.pomodoroService.getActiveSession(userId);
      case 'record_meal_expense':
        return this.expenseService.setTodayMealExpense(userId, { category: args.category, amount: args.amount });
      case 'record_other_expense':
        return this.expenseService.addOtherExpense(userId, { description: args.description, amount: args.amount, notes: args.notes });
      case 'get_today_expenses':
        return this.expenseService.getTodayExpenses(userId);
      case 'record_exercise':
        return this.exerciseService.addLog(userId, {
          exerciseName: args.exerciseName,
          emoji: args.emoji,
          value: args.value,
          unit: args.unit,
          note: args.note,
        });
      case 'get_today_exercise':
        return this.exerciseService.getTodayLogs(userId);
      case 'set_exercise_feeling':
        return this.exerciseService.setTodayExerciseFeeling(userId, args.feeling);
      case 'update_important_info':
        return this.importantInfoService.updateInfo(userId, args.content);
      case 'update_day_reflection':
        return this.dailyService.updateDayReflection(userId, { dayReflection: args.dayReflection, phoneUsage: args.phoneUsage });
      case 'get_current_goal':
        return this.goalsService.getCurrentGoal(userId);
      case 'set_goal':
        return this.goalsService.startNewGoal(userId, {
          goalName: args.goalName,
          targetDate: args.targetDate,
          description: args.description,
        });
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  async getPendingTasksForAgent(userId: string) {
    return this.tasksService.getPendingTasks(userId);
  }

  async getTaskById(userId: string, taskId: string) {
    return this.tasksService.findOne(userId, taskId);
  }

  async resolvePendingTask(userId: string, taskTitle: string) {
    const tasks = await this.tasksService.getPendingTasks(userId);
    return resolveTaskMatch(taskTitle, tasks as AgentTaskCandidate[]);
  }

  async resolveTodayPendingTask(userId: string, taskTitle: string) {
    const tasks = await this.getTodayPendingTaskCandidates(userId);
    return resolveTaskMatch(taskTitle, tasks);
  }

  async previewCompleteTask(userId: string, args: Record<string, any>) {
    return this.resolveCompletionTaskReference(userId, args);
  }

  private async getTodaySummary(userId: string) {
    const [dailyData, todayTasks, todayExpenses, todayExercise, activePomodoro, currentGoal] = await Promise.all([
      this.dailyService.getTodayStatus(userId),
      this.tasksService.getTodayEffectiveTasks(userId),
      this.expenseService.getTodayExpenses(userId),
      this.exerciseService.getTodayLogs(userId),
      this.pomodoroService.getActiveSession(userId),
      this.goalsService.getCurrentGoal(userId),
    ]);

    return {
      daily: dailyData,
      tasks: todayTasks,
      expenses: todayExpenses,
      exercise: todayExercise,
      activePomodoro,
      currentGoal,
    };
  }

  private async createTasks(userId: string, titles: unknown) {
    if (!Array.isArray(titles) || titles.length === 0) {
      return { error: 'titles 必须是非空数组' };
    }

    const pendingTasks = await this.tasksService.getPendingTasks(userId);
    const knownTasks = [...pendingTasks] as AgentTaskCandidate[];
    const created: Array<{ id: string; title: string }> = [];
    const skipped: Array<{ title: string; reason: string; taskId?: string }> = [];
    const seen = new Set<string>();

    for (const rawTitle of titles) {
      const title = sanitizeTaskTitle(String(rawTitle ?? ''));
      const dedupeKey = toTaskMatchKey(title);

      if (!dedupeKey || seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);

      const matched = findBestTaskMatch(title, knownTasks);
      if (matched) {
        skipped.push({
          title,
          reason: 'existing_pending_task',
          taskId: matched.taskId,
        });
        continue;
      }

      const task = await this.tasksService.create(userId, { title } as any);
      created.push({ id: task.id, title: task.title });
      knownTasks.push({ id: task.id, title: task.title });
    }

    return {
      created,
      skipped,
      requestedCount: titles.length,
    };
  }

  private async updateTask(userId: string, args: Record<string, any>) {
    let taskId = typeof args.taskId === 'string' ? args.taskId.trim() : '';

    if (!taskId && args.taskTitle) {
      const resolution = await this.resolvePendingTask(userId, args.taskTitle);
      if (resolution.status === 'none') return { error: `未找到任务"${args.taskTitle}"` };
      if (resolution.status === 'ambiguous') return { error: `"${args.taskTitle}"匹配到多个任务，请提供更精确的标题` };
      taskId = resolution.match!.taskId;
    }

    if (!taskId) return { error: '未找到任务，请提供 taskId 或有效的任务标题' };

    const patch: Record<string, any> = {};
    if (args.newTitle) patch.title = args.newTitle;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.estimatedHours !== undefined) patch.estimatedHours = args.estimatedHours;
    if (args.subject !== undefined) patch.subject = args.subject;

    if (Object.keys(patch).length === 0) return { error: '未提供任何要修改的字段' };

    await this.tasksService.update(userId, taskId, patch as any);
    const updated = await this.tasksService.findOne(userId, taskId);
    return { taskId, title: updated?.title, updated: patch };
  }

  private async completeTask(userId: string, args: Record<string, any>) {
    const taskRef = await this.resolveCompletionTaskReference(userId, args);
    if (taskRef.error) {
      return { error: taskRef.error };
    }

    if (!taskRef.taskId) {
      return { error: '未提供有效的任务ID或任务标题' };
    }

    if (!taskRef.alreadyCompleted) {
      await this.tasksService.update(userId, taskRef.taskId, { isCompleted: true });
    }

    const updatedTask = await this.tasksService.findOne(userId, taskRef.taskId);
    if (!updatedTask?.isCompleted) {
      return { error: `任务"${taskRef.taskTitle || updatedTask?.title || taskRef.taskId}"完成失败，请稍后重试` };
    }

    return {
      taskId: updatedTask.id,
      title: updatedTask.title,
      isCompleted: updatedTask.isCompleted,
      alreadyCompleted: taskRef.alreadyCompleted || false,
    };
  }

  private async resolveCompletionTaskReference(userId: string, args: Record<string, any>) {
    const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : '';
    const rawTaskTitle =
      typeof args.taskTitle === 'string'
        ? args.taskTitle.trim()
        : typeof args.taskName === 'string'
          ? args.taskName.trim()
          : '';
    const taskTitle = sanitizeTaskTitle(rawTaskTitle);

    if (taskId) {
      const existingTask = await this.tasksService.findOne(userId, taskId);
      if (!existingTask) {
        return { error: `找不到任务ID "${taskId}"` };
      }

      return {
        taskId: existingTask.id,
        taskTitle: existingTask.title,
        alreadyCompleted: existingTask.isCompleted,
      };
    }

    if (!taskTitle) {
      return { error: 'taskId 不能为空' };
    }

    const matched = await this.resolvePendingTask(userId, taskTitle);
    if (matched.status === 'matched' && matched.match) {
      return {
        taskId: matched.match.taskId,
        taskTitle: matched.match.taskTitle,
        alreadyCompleted: false,
      };
    }

    if (matched.status === 'ambiguous') {
      return {
        error: this.formatAmbiguousTaskError(taskTitle, matched, 'complete_task'),
      };
    }

    const existingTask = (await this.tasksService.findAll(userId))
      .find((task: any) => task.id && toTaskMatchKey(task.title) === toTaskMatchKey(taskTitle));

    if (existingTask?.isCompleted) {
      return {
        taskId: existingTask.id,
        taskTitle: existingTask.title,
        alreadyCompleted: true,
      };
    }

    return {
      error: `找不到待完成任务"${taskTitle}"。请说得更具体一些，或先确认任务名称后再完成`,
    };
  }

  private async startPomodoroWithTaskReference(userId: string, args: Record<string, any>) {
    const taskRef = await this.resolveTaskReference(userId, args);
    if (taskRef.error) {
      return { error: taskRef.error };
    }

    const duration = Number(args.duration) || 25;

    const result = await this.pomodoroService.startPomodoro(userId, {
      duration,
      taskId: taskRef.taskId,
      isCountUpMode: args.isCountUpMode || false,
    });

    return {
      ...result,
      boundTaskId: taskRef.taskId || null,
      boundTaskTitle: taskRef.taskTitle || null,
      taskCreated: taskRef.taskCreated || false,
      taskMatchedBy: taskRef.matchType || null,
    };
  }

  private async resolveTaskReference(userId: string, args: Record<string, any>): Promise<ResolvedTaskReference> {
    const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : '';
    const rawTaskTitle =
      typeof args.taskTitle === 'string'
        ? args.taskTitle.trim()
        : typeof args.taskName === 'string'
          ? args.taskName.trim()
          : '';
    const taskTitle = sanitizeTaskTitle(rawTaskTitle);

    if (taskId) {
      const existingTask = await this.tasksService.findOne(userId, taskId);
      if (!existingTask) {
        return { error: `找不到任务ID "${taskId}"` };
      }

      if (existingTask.isCompleted) {
        return { error: `任务"${existingTask.title}"已完成，不能绑定新的番茄钟` };
      }

      const todayPendingTasks = await this.getTodayPendingTaskCandidates(userId);
      if (!todayPendingTasks.some((task) => task.id === existingTask.id)) {
        return { error: `任务"${existingTask.title}"不是今日未完成任务，番茄钟只能绑定当天任务` };
      }

      return {
        taskId: existingTask.id,
        taskTitle: existingTask.title,
        matchType: 'taskId',
      };
    }

    if (!taskTitle) {
      return {};
    }

    const matched = await this.resolveTodayPendingTask(userId, taskTitle);
    if (matched.status === 'matched' && matched.match) {
      return {
        taskId: matched.match.taskId,
        taskTitle: matched.match.taskTitle,
        matchType: matched.match.matchType,
      };
    }

    if (matched.status === 'ambiguous') {
      return {
        error: this.formatAmbiguousTaskError(taskTitle, matched, 'start_pomodoro'),
      };
    }

    if (!args.createTaskIfMissing) {
      return {
        error: `找不到今日未完成任务"${taskTitle}"。番茄钟只能绑定今日任务；请先创建今日任务，或传 createTaskIfMissing=true 让系统自动创建`,
      };
    }

    const createdTask = await this.tasksService.create(userId, { title: taskTitle } as any);
    return {
      taskId: createdTask.id,
      taskTitle: createdTask.title,
      taskCreated: true,
      matchType: 'created',
    };
  }

  private formatAmbiguousTaskError(
    taskTitle: string,
    resolution: TaskMatchResolution,
    action: 'complete_task' | 'start_pomodoro',
  ) {
    const candidateLabels = resolution.candidates.map(candidate => `"${candidate.taskTitle}"`).join('、');
    const normalizedActionLabel = action === 'complete_task' ? '完成任务' : '开启番茄钟';
    return `任务"${taskTitle}"匹配到多个未完成任务：${candidateLabels}。请说得更具体一些，或先选择准确任务后再${normalizedActionLabel}`;
  }

  private async getTodayPendingTaskCandidates(userId: string): Promise<AgentTaskCandidate[]> {
    const todayTasks = await this.tasksService.getTodayEffectiveTasks(userId);
    return todayTasks
      .filter((task: any) => !task.isCompleted)
      .map((task: any) => ({
        id: task.id,
        title: task.title,
      }));
  }

  private async stopActivePomodoro(userId: string) {
    const session = await this.pomodoroService.getActiveSession(userId);
    if (session) {
      return this.pomodoroService.stopPomodoro(session.id);
    }
    return { message: '当前没有正在运行的番茄钟' };
  }
}
