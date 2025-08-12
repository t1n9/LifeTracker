import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  // 获取健康记录
  async getHealthRecords(userId: string, limit = 30) {
    return this.prisma.healthRecord.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  // 获取运动记录
  async getExerciseRecords(userId: string, limit = 30) {
    return this.prisma.exerciseRecord.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        exercise: true,
      },
    });
  }

  // 获取支出记录
  async getExpenseRecords(userId: string, limit = 30) {
    const records = await this.prisma.expenseRecord.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });

    // 按日期分组并转换为旧格式以保持兼容性
    const groupedByDate = new Map();

    records.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0];
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, {
          id: `${userId}-${dateKey}`,
          userId,
          date: record.date,
          breakfast: 0,
          lunch: 0,
          dinner: 0,
          customCategories: {},
          other: [],
          total: 0,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });
      }

      const dayData = groupedByDate.get(dateKey);

      if (record.type === 'MEAL') {
        if (record.category === 'breakfast') dayData.breakfast += record.amount;
        else if (record.category === 'lunch') dayData.lunch += record.amount;
        else if (record.category === 'dinner') dayData.dinner += record.amount;
      } else if (record.type === 'OTHER') {
        dayData.other.push({
          id: record.id,
          description: record.description || record.category,
          amount: record.amount,
        });
      }

      dayData.total += record.amount;
    });

    return Array.from(groupedByDate.values()).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  // 获取健康统计
  async getHealthStats(userId: string) {
    const [healthRecords, exerciseRecords, expenseRecords] = await Promise.all([
      this.prisma.healthRecord.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      this.prisma.exerciseRecord.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 30,
        include: {
          exercise: true,
        },
      }),
      this.getExpenseRecords(userId, 30),
    ]);

    // 计算平均值
    const avgWeight = healthRecords.length > 0 
      ? healthRecords.reduce((sum, record) => sum + (record.weight || 0), 0) / healthRecords.length
      : 0;

    const avgSleep = healthRecords.length > 0
      ? healthRecords.reduce((sum, record) => sum + (record.sleepHours || 0), 0) / healthRecords.length
      : 0;

    const totalExpense = expenseRecords.reduce((sum, record) => sum + record.total, 0);

    return {
      avgWeight: Math.round(avgWeight * 100) / 100,
      avgSleep: Math.round(avgSleep * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      recordCount: {
        health: healthRecords.length,
        exercise: exerciseRecords.length,
        expense: expenseRecords.length,
      },
    };
  }
}
