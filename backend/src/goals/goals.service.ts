import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  // 获取用户当前活跃目标
  async getCurrentGoal(userId: string) {
    const now = new Date();

    // 获取所有活跃目标
    const activeGoals = await this.prisma.userGoal.findMany({
      where: { userId, isActive: true, status: 'ACTIVE' },
    });

    // 过期的自动标记完成
    const expired = activeGoals.filter(g => g.targetDate && new Date(g.targetDate) < now);
    if (expired.length > 0) {
      await this.prisma.userGoal.updateMany({
        where: { id: { in: expired.map(g => g.id) } },
        data: { status: 'COMPLETED', isActive: false, endDate: now },
      });
    }

    const valid = activeGoals.filter(g => !expired.find(e => e.id === g.id));
    if (valid.length === 0) return null;

    // 优先返回截止日期最近的；没有截止日期的排最后
    valid.sort((a, b) => {
      if (!a.targetDate && !b.targetDate) return 0;
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });

    return valid[0];
  }

  // 获取用户目标历史
  async getGoalHistory(userId: string) {
    return this.prisma.userGoal.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // 开启新目标（允许多目标并存，不终止旧目标）
  async startNewGoal(userId: string, goalData: {
    goalName: string;
    targetDate?: string;
    examDate?: string;
    description?: string;
  }) {
    // 创建新目标
    const newGoal = await this.prisma.userGoal.create({
      data: {
        userId,
        goalName: goalData.goalName,
        targetDate: goalData.targetDate ? new Date(goalData.targetDate) : null,
        description: goalData.description,
        startDate: new Date(),
        isActive: true,
        status: 'ACTIVE',
      },
    });

    // 用户表中已经移除了目标字段，不需要更新

    return newGoal;
  }

  // 终止当前目标
  async terminateCurrentGoal(userId: string) {
    const currentGoal = await this.getCurrentGoal(userId);
    
    if (currentGoal) {
      return this.prisma.userGoal.update({
        where: { id: currentGoal.id },
        data: {
          isActive: false,
          status: 'TERMINATED',
          endDate: new Date(),
        },
      });
    }
    
    return null;
  }

  // 完成目标
  async completeGoal(userId: string, goalId: string) {
    return this.prisma.userGoal.update({
      where: {
        id: goalId,
        userId,
      },
      data: {
        isActive: false,
        status: 'COMPLETED',
        endDate: new Date(),
      },
    });
  }

  // 数据迁移：为现有用户创建初始目标记录
  async migrateExistingUsers() {
    // 由于用户表中已经移除了目标字段，这个方法现在只是返回空结果
    // 如果需要迁移数据，应该从数据库备份或其他数据源进行
    return {
      migratedCount: 0,
      totalUsers: 0,
      results: [],
      message: '用户表中已移除目标字段，无需迁移'
    };
  }

  // 更新目标
  async updateGoal(goalId: string, userId: string, updateData: any) {
    // 验证目标是否属于当前用户
    const goal = await this.prisma.userGoal.findFirst({
      where: {
        id: goalId,
        userId: userId,
      },
    });

    if (!goal) {
      throw new Error('目标不存在或无权限访问');
    }

    // 更新目标
    const updatedGoal = await this.prisma.userGoal.update({
      where: { id: goalId },
      data: {
        ...updateData,
        // 确保日期字段正确处理
        targetDate: updateData.targetDate ? new Date(updateData.targetDate) : undefined,
        startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
        endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
      },
    });

    return updatedGoal;
  }

  // 获取目标下的所有学习计划（含暂停、归档）
  async getPlansForGoal(goalId: string, userId: string) {
    const plans = await this.prisma.studyPlan.findMany({
      where: { goalId, userId },
      orderBy: { createdAt: 'desc' },
      include: {
        subjects: { select: { id: true, name: true, weight: true } },
        _count: { select: { dailySlots: true, weeklyPlans: true } },
      },
    });

    return Promise.all(plans.map(async (p) => {
      const totalSlots = await this.prisma.dailyStudySlot.count({ where: { planId: p.id } });
      const completedSlots = await this.prisma.dailyStudySlot.count({ where: { planId: p.id, status: 'completed' } });
      const plannedHours = await this.prisma.dailyStudySlot.aggregate({
        where: { planId: p.id },
        _sum: { plannedHours: true },
      });
      return {
        id: p.id,
        title: p.title,
        examName: p.examName,
        examDate: p.examDate ? p.examDate.toISOString() : null,
        status: p.status,
        weekdayHours: p.weekdayHours,
        weekendHours: p.weekendHours,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        subjects: p.subjects,
        stats: {
          totalSlots,
          completedSlots,
          completionRate: totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0,
          plannedHours: plannedHours._sum.plannedHours ?? 0,
        },
      };
    }));
  }

  // 删除目标
  async deleteGoal(goalId: string, userId: string) {
    const goal = await this.prisma.userGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new Error('目标不存在或无权限删除');
    }

    // 先把关联的学习计划归档，避免孤儿计划继续出现在学习计划页
    await this.prisma.studyPlan.updateMany({
      where: { goalId, userId, status: { not: 'archived' } },
      data: { status: 'archived' },
    });

    await this.prisma.userGoal.delete({
      where: { id: goalId },
    });

    return { message: '目标已删除' };
  }
}
