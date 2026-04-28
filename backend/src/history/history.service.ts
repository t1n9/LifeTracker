import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toBeijingTime, getTodayStart, getTodayEnd, getDateStart, getDateEnd, formatDateString, parseDateString } from '../common/utils/date.util';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async getAvailableDates(userId: string): Promise<string[]> {
    try {
      // 获取用户时区信息
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      const timezone = user?.timezone || 'Asia/Shanghai';

      const uniqueDates = new Set<string>();

      // 从任务表获取日期 - 包含创建日期和完成日期，使用用户时区
      const tasks = await this.prisma.task.findMany({
        where: { userId },
        select: {
          createdAt: true,
          updatedAt: true,
          isCompleted: true
        },
      });
      tasks.forEach(task => {
        // 添加创建日期（使用用户时区）
        const createdDate = formatDateString(task.createdAt, timezone);
        uniqueDates.add(createdDate);

        // 如果任务已完成，也添加完成日期（更新日期，使用用户时区）
        if (task.isCompleted) {
          const completedDate = formatDateString(task.updatedAt, timezone);
          uniqueDates.add(completedDate);
        }
      });

      // 从学习记录表获取日期（使用用户时区）
      const studyRecords = await this.prisma.studyRecord.findMany({
        where: { userId },
        select: { startedAt: true },
      });
      studyRecords.forEach(record => {
        const date = formatDateString(record.startedAt, timezone);
        uniqueDates.add(date);
      });

      // 从番茄钟表获取日期（使用用户时区）
      const pomodoroSessions = await this.prisma.pomodoroSession.findMany({
        where: { userId },
        select: { startedAt: true },
      });
      pomodoroSessions.forEach(session => {
        const date = formatDateString(session.startedAt, timezone);
        uniqueDates.add(date);
      });

      // 从每日数据表获取日期（使用用户时区）
      const dailyData = await this.prisma.dailyData.findMany({
        where: { userId },
        select: { date: true },
      });
      dailyData.forEach(data => {
        const date = formatDateString(data.date, timezone);
        uniqueDates.add(date);
      });

      // 从运动日志表获取日期（date 字段已是 YYYY-MM-DD 字符串）
      const exerciseLogs = await this.prisma.exerciseLog.findMany({
        where: { userId },
        select: { date: true },
        distinct: ['date'],
      });
      exerciseLogs.forEach(log => {
        uniqueDates.add(log.date);
      });

      // 从消费记录表获取日期（使用用户时区）
      const expenseRecords = await this.prisma.expenseRecord.findMany({
        where: { userId },
        select: { date: true },
        distinct: ['date'],
      });
      expenseRecords.forEach(record => {
        const date = formatDateString(record.date, timezone);
        uniqueDates.add(date);
      });

      console.log(`📅 用户 ${userId} 的历史数据: 找到 ${tasks.length} 个任务, ${studyRecords.length} 个学习记录, ${pomodoroSessions.length} 个番茄钟, ${dailyData.length} 个每日数据, ${exerciseLogs.length} 个运动记录, ${expenseRecords.length} 个消费记录, 共 ${uniqueDates.size} 个不同日期`);

      return Array.from(uniqueDates).sort((a, b) => b.localeCompare(a));
    } catch (error) {
      console.error('获取可用日期失败:', error);
      return [];
    }
  }

  async getDayData(userId: string, date: string) {
    try {
      // 获取用户时区信息
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      const timezone = user?.timezone || 'Asia/Shanghai';

      // 计算时间范围 - 修复时区问题
      // 使用用户时区的今天日期，而不是UTC日期
      const todayInUserTz = formatDateString(new Date(), timezone);
      let startDate: Date, endDate: Date;

      if (date === todayInUserTz) {
        startDate = getTodayStart(timezone);
        endDate = getTodayEnd(timezone);
      } else {
        startDate = getDateStart(date, timezone);
        endDate = getDateEnd(date, timezone);
      }



      // 获取任务数据 - 显示在该日期范围内有活动的任务
      const tasks = await this.prisma.task.findMany({
        where: {
          userId,
          updatedAt: {  // 改为使用更新时间，这样能看到完成的任务
            gte: startDate,
            lt: endDate,
          },
        },
        select: {
          id: true,
          title: true,
          isCompleted: true,
        },
      });

      // 获取学习记录数据
      const studyRecords = await this.prisma.studyRecord.findMany({
        where: {
          userId,
          startedAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        select: {
          duration: true,
          subject: true,
        },
      });

      // 获取番茄钟数据
      const pomodoroSessions = await this.prisma.pomodoroSession.findMany({
        where: {
          userId,
          startedAt: {
            gte: startDate,
            lt: endDate,
          },
          status: 'COMPLETED',
          type: 'WORK',
        },
        select: {
          duration: true,
          taskId: true,
        },
      });

      // 获取运动数据 - 使用具体日期匹配（解析为UTC日期）
      const targetDate = parseDateString(date);

      // 获取每日数据（复盘等）- 使用具体日期匹配
      const dailyData = await this.prisma.dailyData.findFirst({
        where: {
          userId,
          date: targetDate,
        },
        select: {
          dayStart: true,
          dayReflection: true,
          reflectionTime: true,
          wakeUpTime: true,
        },
      });
      const exerciseLogs = await this.prisma.exerciseLog.findMany({
        where: { userId, date },
        orderBy: { loggedAt: 'asc' },
      });

      // 将运动日志按名称分组汇总
      const exerciseData: {
        exercises: Array<{ id: string; name: string; value: number; unit: string }>;
        feeling: string | null;
      } = { exercises: [], feeling: null };

      const exerciseMap = new Map<string, { name: string; emoji: string | null; value: number; unit: string }>();
      exerciseLogs.forEach(log => {
        const key = log.exerciseName;
        if (exerciseMap.has(key)) {
          exerciseMap.get(key)!.value += log.value;
        } else {
          exerciseMap.set(key, { name: log.exerciseName, emoji: log.emoji, value: log.value, unit: log.unit });
        }
      });

      exerciseData.exercises = Array.from(exerciseMap.entries()).map(([key, data]) => ({
        id: key,
        name: `${data.emoji ?? ''}${data.name}`,
        value: data.value,
        unit: data.unit,
      }));

      // 获取运动感受 - 使用具体日期匹配
      const dailyDataForFeeling = await this.prisma.dailyData.findFirst({
        where: {
          userId,
          date: targetDate,
        },
        select: {
          exerciseFeeling: true,
        },
      });

      if (dailyDataForFeeling?.exerciseFeeling) {
        // 将英文感受翻译为中文
        const feelingMap: Record<string, string> = {
          'excellent': '非常好',
          'good': '好',
          'fair': '一般',
          'poor': '不好',
          'terrible': '很差',
        };
        exerciseData.feeling = feelingMap[dailyDataForFeeling.exerciseFeeling.toLowerCase()] || dailyDataForFeeling.exerciseFeeling;
      }

      // 获取消费数据 - 使用具体日期匹配
      const expenseRecords = await this.prisma.expenseRecord.findMany({
        where: {
          userId,
          date: targetDate,
        },
        select: {
          type: true,
          category: true,
          amount: true,
          description: true,
        },
      });

      // 调试信息
      console.log('🔍 消费记录查询结果:', {
        userId,
        date: date,
        targetDate: targetDate.toISOString(),
        recordCount: expenseRecords.length,
        records: expenseRecords.map(r => ({
          type: r.type,
          category: r.category,
          amount: r.amount,
          description: r.description
        }))
      });

      // 将消费记录按类型分组
      const expenseData = {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        total: 0,
        customCategories: {} as Record<string, number>,
        other: [] as Array<{ name?: string; description?: string; amount: number }>,
      };

      expenseRecords.forEach(record => {
        if (record.type === 'MEAL') {
          // 餐饮类消费 - 应该显示在早午晚餐区域
          if (record.category === 'breakfast' || record.category === '早餐') {
            expenseData.breakfast += record.amount;
          } else if (record.category === 'lunch' || record.category === '午餐') {
            expenseData.lunch += record.amount;
          } else if (record.category === 'dinner' || record.category === '晚餐') {
            expenseData.dinner += record.amount;
          }
        } else if (record.type === 'OTHER') {
          // 其他消费 - 应该显示在其他消费区域，显示项目名称和花费
          // 项目名称优先使用description，如果没有则使用category
          const itemName = record.description || record.category || '其他';
          expenseData.other.push({
            name: itemName,
            description: record.description,
            amount: record.amount,
          });
        }
        expenseData.total += record.amount;
      });

      console.log(`📅 ${date}: 找到数据 - 任务:${tasks.length}, 学习:${studyRecords.length}, 番茄钟:${pomodoroSessions.length}, 运动:${exerciseLogs.length}, 消费:${expenseRecords.length}条, 复盘:${dailyData ? '有' : '无'}`);

      // 调试消费数据
      if (expenseRecords.length > 0) {
        const customCategoriesCount = Object.keys(expenseData.customCategories).length;
        const otherItemsCount = expenseData.other.length;
        console.log(`💰 ${date}: 消费详情 - 总计:${expenseData.total}, 早餐:${expenseData.breakfast}, 午餐:${expenseData.lunch}, 晚餐:${expenseData.dinner}, 自定义类别:${customCategoriesCount}个, 其他项目:${otherItemsCount}个`);
      }

      // 计算学习统计
      const totalMinutes = studyRecords.reduce((sum, record) => sum + record.duration, 0);
      const pomodoroCount = pomodoroSessions.length;

      // 计算每个任务的番茄钟数量
      const taskPomodoroMap = new Map<string, number>();
      pomodoroSessions.forEach(session => {
        if (session.taskId) {
          const current = taskPomodoroMap.get(session.taskId) || 0;
          taskPomodoroMap.set(session.taskId, current + 1);
        }
      });

      // 如果没有任何数据，返回null
      if (tasks.length === 0 && studyRecords.length === 0 && pomodoroSessions.length === 0 && !dailyData && exerciseLogs.length === 0 && !expenseData) {
        console.log(`📅 ${date}: 没有找到任何数据`);
        return null;
      }

      // 构建返回数据
      const dayDataResult = {
        date,
        dayStart: dailyData?.dayStart || null,
        dayReflection: dailyData?.dayReflection || null,
        reflectionTime: dailyData?.reflectionTime ? String(dailyData.reflectionTime) : null,
        wakeUpTime: dailyData?.wakeUpTime || null,
        study: {
          totalMinutes,
          pomodoroCount,
        },
        tasks: tasks.map(task => ({
          id: task.id,
          text: task.title,
          completed: task.isCompleted,
          pomodoroCount: taskPomodoroMap.get(task.id) || 0,
        })),
        exercise: exerciseData,
        expenses: {
          total: Number(expenseData?.total || 0),
          breakfast: Number(expenseData?.breakfast || 0),
          lunch: Number(expenseData?.lunch || 0),
          dinner: Number(expenseData?.dinner || 0),
          customCategories: expenseData?.customCategories || {},
          other: Array.isArray(expenseData?.other) ? expenseData.other : [],
        },
      };

      return dayDataResult;
    } catch (error) {
      console.error('获取日期数据失败:', error);
      throw error;
    }
  }

  // 获取目标时间段的数据概况
  async getGoalOverview(userId: string, goalId?: string) {
    try {
      // 获取用户时区信息
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      const timezone = user?.timezone || 'Asia/Shanghai';

      let startDate: Date, endDate: Date;

      if (goalId) {
        // 获取特定目标的时间范围
        const goal = await this.prisma.userGoal.findUnique({
          where: { id: goalId, userId },
        });

        if (!goal) {
          throw new Error('目标不存在');
        }

        startDate = goal.startDate;
        endDate = goal.endDate || new Date(); // 如果目标还在进行中，使用当前时间
      } else {
        // 获取所有时间的数据
        const firstRecord = await this.prisma.task.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        });

        startDate = firstRecord?.createdAt || new Date();
        endDate = new Date();
      }

      // 获取时间段内的所有数据
      const [tasks, studyRecords, pomodoroSessions, exerciseRecords, expenseRecords] = await Promise.all([
        // 任务数据
        this.prisma.task.findMany({
          where: {
            userId,
            createdAt: { gte: startDate, lte: endDate },
          },
          select: {
            id: true,
            title: true,
            isCompleted: true,
            createdAt: true,
            updatedAt: true,
          },
        }),

        // 学习记录
        this.prisma.studyRecord.findMany({
          where: {
            userId,
            startedAt: { gte: startDate, lte: endDate },
          },
          select: {
            duration: true,
            subject: true,
            startedAt: true,
          },
        }),

        // 番茄钟记录
        this.prisma.pomodoroSession.findMany({
          where: {
            userId,
            startedAt: { gte: startDate, lte: endDate },
            status: 'COMPLETED',
            type: 'WORK',
          },
          select: {
            duration: true,
            startedAt: true,
          },
        }),

        // 运动日志
        this.prisma.exerciseLog.findMany({
          where: {
            userId,
            date: {
              gte: formatDateString(startDate, timezone),
              lte: formatDateString(endDate, timezone),
            },
          },
        }),

        // 消费记录
        this.prisma.expenseRecord.findMany({
          where: {
            userId,
            date: { gte: startDate, lte: endDate },
          },
          select: {
            amount: true,
            type: true,
            date: true,
          },
        }),


      ]);

      // 计算统计数据
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(task => task.isCompleted).length;
      const totalStudyMinutes = studyRecords.reduce((sum, record) => sum + record.duration, 0);
      const totalPomodoroCount = pomodoroSessions.length;
      const totalExpense = expenseRecords.reduce((sum, record) => sum + record.amount, 0);

      // 按运动名称汇总
      const exerciseStats = new Map<string, { name: string; total: number; unit: string }>();
      exerciseRecords.forEach((log: any) => {
        const key = log.exerciseName;
        if (exerciseStats.has(key)) {
          exerciseStats.get(key)!.total += log.value;
        } else {
          exerciseStats.set(key, {
            name: `${log.emoji ?? ''}${log.exerciseName}`,
            total: log.value,
            unit: log.unit,
          });
        }
      });

      return {
        period: {
          startDate: formatDateString(startDate, timezone),
          endDate: formatDateString(endDate, timezone),
          totalDays,
        },
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        },
        study: {
          totalMinutes: totalStudyMinutes,
          totalHours: Math.round(totalStudyMinutes / 60 * 100) / 100,
          averageMinutesPerDay: totalDays > 0 ? Math.round(totalStudyMinutes / totalDays) : 0,
          pomodoroCount: totalPomodoroCount,
          averagePomodoroPerDay: totalDays > 0 ? Math.round(totalPomodoroCount / totalDays * 100) / 100 : 0,
        },
        exercise: {
          totalRecords: exerciseRecords.length,
          exerciseTypes: Array.from(exerciseStats.values()),
        },
        expense: {
          total: totalExpense,
          averagePerDay: totalDays > 0 ? Math.round(totalExpense / totalDays * 100) / 100 : 0,
          recordCount: expenseRecords.length,
        },
      };
    } catch (error) {
      console.error('获取目标概况失败:', error);
      throw error;
    }
  }
}
