import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toBeijingTime, getTodayStart, getTodayEnd, getDateStart, getDateEnd } from '../common/utils/date.util';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async getAvailableDates(userId: string): Promise<string[]> {
    try {
      const uniqueDates = new Set<string>();

      // 从任务表获取日期
      const tasks = await this.prisma.task.findMany({
        where: { userId },
        select: { createdAt: true },
      });
      tasks.forEach(task => {
        const date = task.createdAt.toISOString().split('T')[0];
        uniqueDates.add(date);
      });

      // 从学习记录表获取日期
      const studyRecords = await this.prisma.studyRecord.findMany({
        where: { userId },
        select: { startedAt: true },
      });
      studyRecords.forEach(record => {
        const date = record.startedAt.toISOString().split('T')[0];
        uniqueDates.add(date);
      });

      // 从番茄钟表获取日期
      const pomodoroSessions = await this.prisma.pomodoroSession.findMany({
        where: { userId },
        select: { startedAt: true },
      });
      pomodoroSessions.forEach(session => {
        const date = session.startedAt.toISOString().split('T')[0];
        uniqueDates.add(date);
      });

      // 从每日数据表获取日期
      const dailyData = await this.prisma.dailyData.findMany({
        where: { userId },
        select: { date: true },
      });
      dailyData.forEach(data => {
        const date = data.date.toISOString().split('T')[0];
        uniqueDates.add(date);
      });

      // 从运动记录表获取日期
      const exerciseRecords = await this.prisma.exerciseRecord.findMany({
        where: { userId },
        select: { date: true },
        distinct: ['date'],
      });
      exerciseRecords.forEach(record => {
        const date = record.date.toISOString().split('T')[0];
        uniqueDates.add(date);
      });

      // 从消费记录表获取日期
      const expenseRecords = await this.prisma.expenseRecord.findMany({
        where: { userId },
        select: { date: true },
        distinct: ['date'],
      });
      expenseRecords.forEach(record => {
        const date = record.date.toISOString().split('T')[0];
        uniqueDates.add(date);
      });

      console.log(`📅 用户 ${userId} 的历史数据: 找到 ${tasks.length} 个任务, ${studyRecords.length} 个学习记录, ${pomodoroSessions.length} 个番茄钟, ${dailyData.length} 个每日数据, ${exerciseRecords.length} 个运动记录, ${expenseRecords.length} 个消费记录, 共 ${uniqueDates.size} 个不同日期`);

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

      // 计算时间范围
      const today = new Date().toISOString().split('T')[0];
      let startDate: Date, endDate: Date;

      if (date === today) {
        startDate = getTodayStart(timezone);
        endDate = getTodayEnd(timezone);
      } else {
        startDate = getDateStart(date, timezone);
        endDate = getDateEnd(date, timezone);
      }

      // 获取任务数据
      const tasks = await this.prisma.task.findMany({
        where: {
          userId,
          createdAt: {
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

      // 获取运动数据 - 使用具体日期匹配
      const targetDate = new Date(date);

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
      const exerciseRecords = await this.prisma.exerciseRecord.findMany({
        where: {
          userId,
          date: targetDate,
        },
        include: {
          exercise: true,
        },
      });

      // 调试信息
      console.log('🔍 运动记录查询结果:', {
        userId,
        date: date,
        targetDate: targetDate.toISOString(),
        recordCount: exerciseRecords.length,
        records: exerciseRecords.map(r => ({
          exerciseName: r.exercise.name,
          value: r.value,
          date: r.date.toISOString()
        }))
      });

      // 将运动记录按类型分组，并转换为前端期望的格式
      const exerciseData = {
        running: 0,
        pushUps: 0,
        pullUps: 0,
        squats: 0,
        cycling: 0,
        swimming: 0,
        feeling: null,
      };

      exerciseRecords.forEach(record => {
        const exerciseName = record.exercise.name.toLowerCase();
        // 映射运动名称到前端期望的字段
        if (exerciseName.includes('跑步') || exerciseName.includes('running')) {
          exerciseData.running += record.value;
        } else if (exerciseName.includes('俯卧撑') || exerciseName.includes('pushup')) {
          exerciseData.pushUps += record.value;
        } else if (exerciseName.includes('单杠') || exerciseName.includes('pullup') || exerciseName.includes('引体向上')) {
          exerciseData.pullUps += record.value;
        } else if (exerciseName.includes('深蹲') || exerciseName.includes('squat')) {
          exerciseData.squats += record.value;
        } else if (exerciseName.includes('骑车') || exerciseName.includes('cycling') || exerciseName.includes('骑行')) {
          exerciseData.cycling += record.value;
        } else if (exerciseName.includes('游泳') || exerciseName.includes('swimming')) {
          exerciseData.swimming += record.value;
        }
      });

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

      console.log(`📅 ${date}: 找到数据 - 任务:${tasks.length}, 学习:${studyRecords.length}, 番茄钟:${pomodoroSessions.length}, 运动:${exerciseRecords.length}, 消费:${expenseRecords.length}条, 复盘:${dailyData ? '有' : '无'}`);

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
      if (tasks.length === 0 && studyRecords.length === 0 && pomodoroSessions.length === 0 && !dailyData && exerciseRecords.length === 0 && !expenseData) {
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
}
