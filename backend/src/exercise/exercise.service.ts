import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExerciseTypeEnum } from '@prisma/client';
import { getTodayStart, getDaysAgoStart, getTodayEnd } from '../common/utils/date.util';

@Injectable()
export class ExerciseService {
  constructor(private prisma: PrismaService) {}

  // 获取用户的运动类型
  async getExerciseTypes(userId: string) {
    return this.prisma.exerciseType.findMany({
      where: { 
        userId,
        isActive: true 
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // 创建运动类型
  async createExerciseType(userId: string, data: {
    name: string;
    type: ExerciseTypeEnum;
    unit: string;
    increment?: number;
    icon?: string;
    color?: string;
  }) {
    const maxOrder = await this.prisma.exerciseType.findFirst({
      where: { userId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.prisma.exerciseType.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        unit: data.unit,
        increment: data.increment,
        icon: data.icon,
        color: data.color,
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
      },
    });
  }

  // 更新运动类型
  async updateExerciseType(userId: string, exerciseId: string, data: {
    name?: string;
    type?: ExerciseTypeEnum;
    unit?: string;
    increment?: number;
    icon?: string;
    color?: string;
    isActive?: boolean;
  }) {
    return this.prisma.exerciseType.update({
      where: { 
        id: exerciseId,
        userId, // 确保只能更新自己的运动类型
      },
      data,
    });
  }

  // 删除运动类型
  async deleteExerciseType(userId: string, exerciseId: string) {
    return this.prisma.exerciseType.update({
      where: { 
        id: exerciseId,
        userId,
      },
      data: { isActive: false },
    });
  }

  // 获取今日运动记录
  async getTodayRecords(userId: string) {
    const today = getTodayStart();

    const records = await this.prisma.exerciseRecord.findMany({
      where: {
        userId,
        date: today,
      },
      include: {
        exercise: true,
      },
    });

    // 按运动类型分组
    const recordMap = new Map();
    records.forEach(record => {
      const key = record.exerciseId;
      if (!recordMap.has(key)) {
        recordMap.set(key, {
          exerciseId: record.exerciseId,
          exerciseName: record.exercise.name,
          exerciseType: record.exercise.type,
          unit: record.exercise.unit,
          totalValue: 0,
          records: [],
        });
      }
      const group = recordMap.get(key);
      group.totalValue += record.value;
      group.records.push(record);
    });

    return Array.from(recordMap.values());
  }

  // 添加运动记录
  async addExerciseRecord(userId: string, data: {
    exerciseId: string;
    value: number;
    notes?: string;
  }) {
    const today = getTodayStart();

    // 获取运动类型信息
    const exerciseType = await this.prisma.exerciseType.findUnique({
      where: { id: data.exerciseId },
      select: { unit: true },
    });

    return this.prisma.exerciseRecord.create({
      data: {
        userId,
        exerciseId: data.exerciseId,
        date: today,
        value: data.value,
        unit: exerciseType?.unit || '',
        notes: data.notes,
      },
      include: {
        exercise: true,
      },
    });
  }

  // 设置今日运动总值（用于里程型运动）
  async setTodayExerciseValue(userId: string, data: {
    exerciseId: string;
    totalValue: number;
    notes?: string;
  }) {
    const today = getTodayStart();

    // 获取运动类型信息
    const exerciseType = await this.prisma.exerciseType.findUnique({
      where: { id: data.exerciseId },
      select: { unit: true, type: true },
    });

    if (!exerciseType) {
      throw new Error('运动类型不存在');
    }

    // 获取今日现有记录的总值
    const existingRecords = await this.prisma.exerciseRecord.findMany({
      where: {
        userId,
        exerciseId: data.exerciseId,
        date: today,
      },
    });

    const currentTotal = existingRecords.reduce((sum, record) => sum + record.value, 0);
    const difference = data.totalValue - currentTotal;

    if (difference !== 0) {
      // 添加差值记录
      return this.prisma.exerciseRecord.create({
        data: {
          userId,
          exerciseId: data.exerciseId,
          date: today,
          value: difference,
          unit: exerciseType.unit,
          notes: data.notes,
        },
        include: {
          exercise: true,
        },
      });
    }

    return null; // 没有变化
  }

  // 获取运动统计
  async getExerciseStats(userId: string, days = 7) {
    const endDate = getTodayEnd();
    const startDate = getDaysAgoStart(days);

    const records = await this.prisma.exerciseRecord.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        exercise: true,
      },
      orderBy: { date: 'desc' },
    });

    // 按日期和运动类型统计
    const dailyStats = new Map();
    const exerciseStats = new Map();

    records.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0];
      const exerciseKey = record.exerciseId;

      // 日期统计
      if (!dailyStats.has(dateKey)) {
        dailyStats.set(dateKey, { date: dateKey, exercises: new Map() });
      }
      const dayData = dailyStats.get(dateKey);
      if (!dayData.exercises.has(exerciseKey)) {
        dayData.exercises.set(exerciseKey, {
          name: record.exercise.name,
          type: record.exercise.type,
          unit: record.exercise.unit,
          value: 0,
        });
      }
      dayData.exercises.get(exerciseKey).value += record.value;

      // 运动类型统计
      if (!exerciseStats.has(exerciseKey)) {
        exerciseStats.set(exerciseKey, {
          exerciseId: exerciseKey,
          name: record.exercise.name,
          type: record.exercise.type,
          unit: record.exercise.unit,
          totalValue: 0,
          recordCount: 0,
        });
      }
      const exerciseData = exerciseStats.get(exerciseKey);
      exerciseData.totalValue += record.value;
      exerciseData.recordCount += 1;
    });

    return {
      dailyStats: Array.from(dailyStats.values()).map(day => ({
        date: day.date,
        exercises: Array.from(day.exercises.values()),
      })),
      exerciseStats: Array.from(exerciseStats.values()),
      totalRecords: records.length,
    };
  }

  // 初始化默认运动类型
  async initializeDefaultExerciseTypes(userId: string) {
    const existingTypes = await this.prisma.exerciseType.count({
      where: { userId },
    });

    if (existingTypes > 0) {
      return; // 已有运动类型，不需要初始化
    }

    const defaultTypes = [
      {
        name: '单杠',
        type: ExerciseTypeEnum.COUNT,
        unit: '次',
        increment: 5,
        icon: '🏋️',
        color: '#3b82f6',
        sortOrder: 1,
      },
      {
        name: '深蹲',
        type: ExerciseTypeEnum.COUNT,
        unit: '次',
        increment: 20,
        icon: '🦵',
        color: '#10b981',
        sortOrder: 2,
      },
      {
        name: '俯卧撑',
        type: ExerciseTypeEnum.COUNT,
        unit: '次',
        increment: 10,
        icon: '💪',
        color: '#f59e0b',
        sortOrder: 3,
      },
      {
        name: '跑步',
        type: ExerciseTypeEnum.DISTANCE,
        unit: '公里',
        icon: '🏃',
        color: '#ef4444',
        sortOrder: 4,
      },
      {
        name: '骑行',
        type: ExerciseTypeEnum.DISTANCE,
        unit: '公里',
        icon: '🚴',
        color: '#8b5cf6',
        sortOrder: 5,
      },
      {
        name: '游泳',
        type: ExerciseTypeEnum.DISTANCE,
        unit: '公里',
        icon: '🏊',
        color: '#06b6d4',
        sortOrder: 6,
      },
    ];

    await this.prisma.exerciseType.createMany({
      data: defaultTypes.map(type => ({
        userId,
        ...type,
      })),
    });
  }

  // 设置今日运动感受
  async setTodayExerciseFeeling(userId: string, feeling: string) {
    const today = getTodayStart();

    return this.prisma.dailyData.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        exerciseFeeling: feeling,
      },
      create: {
        userId,
        date: today,
        exerciseFeeling: feeling,
      },
    });
  }

  // 获取今日运动感受
  async getTodayExerciseFeeling(userId: string) {
    const today = getTodayStart();

    const dailyData = await this.prisma.dailyData.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      select: {
        exerciseFeeling: true,
      },
    });

    return dailyData?.exerciseFeeling || null;
  }
}
