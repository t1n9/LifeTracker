import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTodayStart, getDaysAgoStart, getTodayEnd, getCurrentTimeString, formatDateString, parseDateString } from '../common/utils/date.util';

// 定义枚举常量，避免运行时undefined问题
const ExpenseTypeEnum = {
  MEAL: 'MEAL',
  OTHER: 'OTHER'
} as const;

type ExpenseTypeEnum = typeof ExpenseTypeEnum[keyof typeof ExpenseTypeEnum];

@Injectable()
export class ExpenseService {
  constructor(private prisma: PrismaService) {}

  // 获取今日消费记录
  async getTodayExpenses(userId: string, timezone: string = 'Asia/Shanghai') {
    // 获取用户时区的今天日期
    const todayDate = parseDateString(formatDateString(getTodayStart(timezone), timezone));

    const records = await this.prisma.expenseRecord.findMany({
      where: {
        userId,
        date: todayDate,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 按类型分组
    const mealExpenses = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
    };

    const otherExpenses: Array<{
      id: string;
      description: string;
      amount: number;
      createdAt: Date;
    }> = [];

    // 为每种餐饮类型找到最新的记录（按更新时间排序）
    const mealRecords = records.filter(r => r.type === ExpenseTypeEnum.MEAL);

    // 获取每种餐饮的最新记录
    ['breakfast', 'lunch', 'dinner'].forEach(category => {
      const categoryRecords = mealRecords
        .filter(r => r.category === category)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      if (categoryRecords.length > 0) {
        mealExpenses[category as keyof typeof mealExpenses] = categoryRecords[0].amount;
      }
    });

    // 其他消费记录保持不变
    records.forEach(record => {
      if (record.type === ExpenseTypeEnum.OTHER) {
        otherExpenses.push({
          id: record.id,
          description: record.description || '其他消费',
          amount: record.amount,
          createdAt: record.createdAt,
        });
      }
    });

    return {
      meals: mealExpenses,
      others: otherExpenses,
      totalMeal: mealExpenses.breakfast + mealExpenses.lunch + mealExpenses.dinner,
      totalOther: otherExpenses.reduce((sum, item) => sum + item.amount, 0),
    };
  }

  // 设置今日餐饮消费
  async setTodayMealExpense(userId: string, data: {
    category: 'breakfast' | 'lunch' | 'dinner';
    amount: number;
  }, timezone: string = 'Asia/Shanghai') {
    // 获取用户时区的今天日期
    const todayDateStr = formatDateString(getTodayStart(timezone), timezone);
    const todayDate = parseDateString(todayDateStr);

    // 查找今日该餐的现有记录（只查找第一条主记录）
    const existingRecord = await this.prisma.expenseRecord.findFirst({
      where: {
        userId,
        date: todayDate,
        type: ExpenseTypeEnum.MEAL,
        category: data.category,
      },
      orderBy: { createdAt: 'asc' }, // 获取最早的记录作为主记录
    });

    if (existingRecord) {
      // 如果金额没有变化，不需要更新
      if (existingRecord.amount === data.amount) {
        return null;
      }

      // 直接更新现有记录
      return this.prisma.expenseRecord.update({
        where: { id: existingRecord.id },
        data: {
          amount: data.amount,
          time: getCurrentTimeString(), // 更新时间
        },
      });
    } else {
      // 创建新记录
      return this.prisma.expenseRecord.create({
        data: {
          userId,
          date: todayDate,
          type: ExpenseTypeEnum.MEAL,
          category: data.category,
          amount: data.amount,
          time: getCurrentTimeString(), // 添加当前时间
        },
      });
    }
  }

  // 添加其他消费记录
  async addOtherExpense(userId: string, data: {
    description: string;
    amount: number;
    notes?: string;
  }) {
    const today = getTodayStart();

    return this.prisma.expenseRecord.create({
      data: {
        userId,
        date: today,
        type: ExpenseTypeEnum.OTHER,
        category: 'other',
        description: data.description,
        amount: data.amount,
        notes: data.notes,
        time: getCurrentTimeString(), // 添加当前时间
      },
    });
  }

  // 清理重复的餐饮记录（保留最新的记录，删除旧的）
  async cleanupDuplicateMealRecords(userId: string) {
    const today = getTodayStart();

    // 获取今日所有餐饮记录
    const mealRecords = await this.prisma.expenseRecord.findMany({
      where: {
        userId,
        date: today,
        type: ExpenseTypeEnum.MEAL,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 按类别分组
    const recordsByCategory = new Map();
    mealRecords.forEach(record => {
      if (!recordsByCategory.has(record.category)) {
        recordsByCategory.set(record.category, []);
      }
      recordsByCategory.get(record.category).push(record);
    });

    // 对每个类别，保留最新的记录，删除其他的
    const deletePromises = [];
    for (const [category, records] of recordsByCategory) {
      if (records.length > 1) {
        // 保留第一个（最新的），删除其他的
        const [latest, ...toDelete] = records;
        // 清理重复记录（仅保留最新），移除冗余日志
        for (const record of toDelete) {
          deletePromises.push(
            this.prisma.expenseRecord.delete({
              where: { id: record.id }
            })
          );
        }
      }
    }

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      // 重复清理数量在返回值中体现
    }

    return { deletedCount: deletePromises.length };
  }

  // 删除其他消费记录
  async deleteOtherExpense(userId: string, expenseId: string) {
    return this.prisma.expenseRecord.delete({
      where: {
        id: expenseId,
        userId, // 确保只能删除自己的记录
      },
    });
  }

  // 获取消费统计
  async getExpenseStats(userId: string, days = 7) {
    const endDate = getTodayEnd();
    const startDate = getDaysAgoStart(days);

    const records = await this.prisma.expenseRecord.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'desc' },
    });

    // 按日期统计
    const dailyStats = new Map();
    const categoryStats = new Map();

    records.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0];
      
      // 日期统计
      if (!dailyStats.has(dateKey)) {
        dailyStats.set(dateKey, { date: dateKey, meal: 0, other: 0, total: 0 });
      }
      const dayData = dailyStats.get(dateKey);
      if (record.type === ExpenseTypeEnum.MEAL) {
        dayData.meal += record.amount;
      } else {
        dayData.other += record.amount;
      }
      dayData.total += record.amount;

      // 类别统计
      const categoryKey = record.type === ExpenseTypeEnum.MEAL ? record.category : 'other';
      if (!categoryStats.has(categoryKey)) {
        categoryStats.set(categoryKey, { category: categoryKey, amount: 0, count: 0 });
      }
      const categoryData = categoryStats.get(categoryKey);
      categoryData.amount += record.amount;
      categoryData.count += 1;
    });

    return {
      dailyStats: Array.from(dailyStats.values()),
      categoryStats: Array.from(categoryStats.values()),
      totalAmount: records.reduce((sum, record) => sum + record.amount, 0),
      totalRecords: records.length,
    };
  }
}
