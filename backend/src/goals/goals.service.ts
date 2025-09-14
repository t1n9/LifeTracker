import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  // 获取用户当前活跃目标
  async getCurrentGoal(userId: string) {
    // 获取最新的活跃目标
    const activeGoal = await this.prisma.userGoal.findFirst({
      where: {
        userId,
        isActive: true,
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 如果有活跃目标，检查是否已过期
    if (activeGoal) {
      const now = new Date();
      const targetDate = activeGoal.targetDate ? new Date(activeGoal.targetDate) : null;

      // 如果目标日期已过，自动将目标标记为已完成
      if (targetDate && targetDate < now) {
        await this.prisma.userGoal.update({
          where: { id: activeGoal.id },
          data: {
            status: 'COMPLETED',
            endDate: targetDate,
            isActive: false,
          },
        });
        return null; // 返回null表示没有当前活跃目标
      }
    }

    return activeGoal;
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

  // 开启新目标
  async startNewGoal(userId: string, goalData: {
    goalName: string;
    targetDate?: string;
    examDate?: string;
    description?: string;
  }) {
    // 首先终止当前活跃的目标
    await this.terminateCurrentGoal(userId);

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

  // 删除目标
  async deleteGoal(goalId: string, userId: string) {
    // 验证目标是否属于该用户
    const goal = await this.prisma.userGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new Error('目标不存在或无权限删除');
    }

    // 删除目标
    await this.prisma.userGoal.delete({
      where: { id: goalId },
    });

    return { message: '目标已删除' };
  }
}
