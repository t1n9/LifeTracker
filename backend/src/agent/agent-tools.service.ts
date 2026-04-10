import { Injectable } from '@nestjs/common';
import { TasksService } from '../tasks/tasks.service';
import { PomodoroService } from '../pomodoro/pomodoro.service';
import { ExpenseService } from '../expense/expense.service';
import { ExerciseService } from '../exercise/exercise.service';
import { DailyService } from '../daily/daily.service';
import { StudyService } from '../study/study.service';
import { GoalsService } from '../goals/goals.service';
import { ImportantInfoService } from '../important-info/important-info.service';

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
      name: 'start_day',
      description: '开启今日，设置今日开启语/计划。用户说"开启今天"、"新的一天"等时调用',
      parameters: {
        type: 'object',
        properties: {
          dayStart: { type: 'string', description: '今日开启语或计划' },
          wakeUpTime: { type: 'string', description: '起床时间，格式 HH:mm，如 "07:30"' },
        },
        required: ['dayStart'],
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
      name: 'complete_task',
      description: '将一个任务标记为已完成。需要先调用 get_tasks 获取任务列表找到任务ID',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '任务ID' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_tasks',
      description: '获取当前所有任务列表',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'start_pomodoro',
      description: '开启一个番茄钟计时。duration 单位为分钟，默认25分钟。如果用户提到了某个任务，用 taskName 按名称自动关联任务',
      parameters: {
        type: 'object',
        properties: {
          duration: { type: 'number', description: '时长（分钟），默认25' },
          taskName: { type: 'string', description: '要关联的任务名称（系统会自动按名称匹配任务ID）' },
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
      description: '记录运动数据。用运动名称（如"跑步"、"俯卧撑"、"深蹲"、"引体向上"、"游泳"、"骑行"）来指定运动类型，系统会自动匹配',
      parameters: {
        type: 'object',
        properties: {
          exerciseName: { type: 'string', description: '运动名称，如"跑步"、"俯卧撑"、"深蹲"、"引体向上"、"游泳"、"骑行"' },
          value: { type: 'number', description: '运动量（次数或距离，如公里数）' },
          notes: { type: 'string', description: '备注' },
        },
        required: ['exerciseName', 'value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_exercise_types',
      description: '获取用户的运动类型列表（如俯卧撑、跑步等），返回每种运动的ID和名称',
      parameters: { type: 'object', properties: {}, required: [] },
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
      description: '更新今日复盘/反思。仅在用户明确要求写复盘、总结今天时调用',
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
];

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
      case 'start_day':
        return this.dailyService.updateDayStart(userId, { dayStart: args.dayStart, wakeUpTime: args.wakeUpTime });
      case 'create_task':
        return this.tasksService.create(userId, {
          title: args.title,
          subject: args.subject,
          priority: args.priority,
          estimatedHours: args.estimatedHours,
        } as any);
      case 'complete_task':
        return this.tasksService.update(userId, args.taskId, { isCompleted: true });
      case 'get_tasks':
        return this.tasksService.getPendingTasks(userId);
      case 'start_pomodoro':
        return this.startPomodoroWithTaskName(userId, args);
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
        return this.recordExerciseByName(userId, args.exerciseName, args.value, args.notes);
      case 'get_exercise_types':
        return this.exerciseService.getExerciseTypes(userId);
      case 'get_today_exercise':
        return this.exerciseService.getTodayRecords(userId);
      case 'set_exercise_feeling':
        return this.exerciseService.setTodayExerciseFeeling(userId, args.feeling);
      case 'update_important_info':
        return this.importantInfoService.updateInfo(userId, args.content);
      case 'update_day_reflection':
        return this.dailyService.updateDayReflection(userId, { dayReflection: args.dayReflection, phoneUsage: args.phoneUsage });
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  private async getTodaySummary(userId: string) {
    const [dailyData, todayTasks, todayExpenses, todayExercise, activePomodoro] = await Promise.all([
      this.dailyService.getTodayStatus(userId),
      this.tasksService.getTodayTasks(userId),
      this.expenseService.getTodayExpenses(userId),
      this.exerciseService.getTodayRecords(userId),
      this.pomodoroService.getActiveSession(userId),
    ]);

    return {
      daily: dailyData,
      tasks: todayTasks,
      expenses: todayExpenses,
      exercise: todayExercise,
      activePomodoro,
    };
  }

  private async startPomodoroWithTaskName(userId: string, args: Record<string, any>) {
    let taskId: string | undefined;

    // 如果提供了 taskName，按名称自动匹配任务
    if (args.taskName) {
      const tasks = await this.tasksService.findAll(userId);
      const matched = tasks.find((t: any) =>
        t.title.includes(args.taskName) || args.taskName.includes(t.title)
      );
      if (matched) {
        taskId = matched.id;
      }
    }

    return this.pomodoroService.startPomodoro(userId, {
      duration: args.duration || 25,
      taskId,
      isCountUpMode: args.isCountUpMode || false,
    });
  }

  private async recordExerciseByName(userId: string, exerciseName: string, value: number, notes?: string) {
    const types = await this.exerciseService.getExerciseTypes(userId);

    // 模糊匹配：包含关系
    const matched = types.find((t: any) =>
      t.name.includes(exerciseName) || exerciseName.includes(t.name)
    );

    if (!matched) {
      return { error: `找不到运动类型"${exerciseName}"，可用的类型有: ${types.map((t: any) => t.name).join('、')}` };
    }

    return this.exerciseService.setTodayExerciseValue(userId, {
      exerciseId: matched.id,
      totalValue: value,
      notes,
    });
  }

  private async stopActivePomodoro(userId: string) {
    const session = await this.pomodoroService.getActiveSession(userId);
    if (session) {
      return this.pomodoroService.stopPomodoro(session.id);
    }
    return { message: '当前没有正在运行的番茄钟' };
  }
}
