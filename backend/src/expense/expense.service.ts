import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTodayStart, getDaysAgoStart, getTodayEnd, getCurrentTimeString, getCurrentBeijingTime } from '../common/utils/date.util';

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
  async getTodayExpenses(userId: string) {
    const today = getTodayStart();

    const records = await this.prisma.expenseRecord.findMany({
      where: {
        userId,
        date: today,
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

    records.forEach(record => {
      if (record.type === ExpenseTypeEnum.MEAL) {
        switch (record.category) {
          case 'breakfast':
            mealExpenses.breakfast += record.amount;
            break;
          case 'lunch':
            mealExpenses.lunch += record.amount;
            break;
          case 'dinner':
            mealExpenses.dinner += record.amount;
            break;
        }
      } else if (record.type === ExpenseTypeEnum.OTHER) {
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
  }) {
    const today = getTodayStart();

    // 获取今日该餐的现有记录
    const existingRecords = await this.prisma.expenseRecord.findMany({
      where: {
        userId,
        date: today,
        type: ExpenseTypeEnum.MEAL,
        category: data.category,
      },
    });

    const currentTotal = existingRecords.reduce((sum, record) => sum + record.amount, 0);
    const difference = data.amount - currentTotal;

    if (difference !== 0) {
      // 添加差值记录
      return this.prisma.expenseRecord.create({
        data: {
          userId,
          date: today,
          type: ExpenseTypeEnum.MEAL,
          category: data.category,
          amount: difference,
          time: getCurrentTimeString(), // 添加当前时间
          createdAt: getCurrentBeijingTime(), // 使用北京时间
          updatedAt: getCurrentBeijingTime(), // 使用北京时间
        },
      });
    }

    return null; // 没有变化
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
        createdAt: getCurrentBeijingTime(), // 使用北京时间
        updatedAt: getCurrentBeijingTime(), // 使用北京时间
      },
    });
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
