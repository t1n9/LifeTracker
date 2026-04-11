import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { getTodayStart, getTodayEnd } from '../common/utils/date.util';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createTaskDto: CreateTaskDto) {
    // 获取当前用户未完成任务的最大sortOrder
    const maxSortOrder = await this.prisma.task.findFirst({
      where: {
        userId,
        isCompleted: false,
      },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const nextSortOrder = (maxSortOrder?.sortOrder || 0) + 1;

    return this.prisma.task.create({
      data: {
        ...createTaskDto,
        userId,
        sortOrder: nextSortOrder,
      },
    });
  }

  async findAll(userId: string) {
    // 分别获取未完成和已完成的任务，确保排序正确
    const [pendingTasks, completedTasks] = await Promise.all([
      // 未完成任务按sortOrder排序
      this.prisma.task.findMany({
        where: { userId, isCompleted: false },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          _count: {
            select: {
              studyRecords: true,
              pomodoroSessions: {
                where: {
                  status: 'COMPLETED',
                },
              },
            },
          },
        },
      }),
      // 已完成任务按完成时间排序
      this.prisma.task.findMany({
        where: { userId, isCompleted: true },
        orderBy: [
          { updatedAt: 'desc' },
        ],
        include: {
          _count: {
            select: {
              studyRecords: true,
              pomodoroSessions: {
                where: {
                  status: 'COMPLETED',
                },
              },
            },
          },
        },
      }),
    ]);

    // 合并任务列表：未完成任务在前，已完成任务在后
    const tasks = [...pendingTasks, ...completedTasks];

    // 返回任务列表，使用_count.pomodoroSessions作为番茄数量
    return tasks.map(task => ({
      ...task,
      pomodoroCount: task._count.pomodoroSessions || 0,
    }));
  }

  async findOne(userId: string, id: string) {
    return this.prisma.task.findFirst({
      where: { id, userId },
      include: {
        studyRecords: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
        pomodoroSessions: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            studyRecords: true,
            pomodoroSessions: true,
          },
        },
      },
    });
  }

  async update(userId: string, id: string, updateTaskDto: UpdateTaskDto) {
    return this.prisma.task.updateMany({
      where: { id, userId },
      data: updateTaskDto,
    });
  }

  async remove(userId: string, id: string) {
    return this.prisma.task.deleteMany({
      where: { id, userId },
    });
  }

  // 仅获取未完成的任务（供 Agent 使用）
  async getPendingTasks(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { userId, isCompleted: false },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        subject: true,
        priority: true,
        estimatedHours: true,
        createdAt: true,
      },
    });
    return tasks;
  }

  // 获取任务统计
  async getTaskStats(userId: string) {
    const [total, completed, pending] = await Promise.all([
      this.prisma.task.count({ where: { userId } }),
      this.prisma.task.count({ where: { userId, isCompleted: true } }),
      this.prisma.task.count({ where: { userId, isCompleted: false } }),
    ]);

    return {
      total,
      completed,
      pending,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  // 获取今日任务（只显示今天创建的任务）
  async getTodayTasks(userId: string, timezone?: string) {
    const resolvedTimezone = await this.resolveTimezone(userId, timezone);
    const todayStart = getTodayStart(resolvedTimezone);
    const todayEnd = getTodayEnd(resolvedTimezone);

    // 获取今天创建的任务
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        createdAt: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      orderBy: [
        { isCompleted: 'asc' }, // 未完成的任务排在前面
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        _count: {
          select: {
            studyRecords: true,
            pomodoroSessions: {
              where: {
                status: 'COMPLETED', // 只统计已完成的番茄钟
              },
            },
          },
        },
      },
    });

    return this.mapTasksWithPomodoroCount(tasks);
  }

  // 获取今日有效任务：今天创建、今天到期、今天完成，或今天有学习/番茄记录的任务
  async getTodayEffectiveTasks(userId: string, timezone?: string) {
    const resolvedTimezone = await this.resolveTimezone(userId, timezone);
    const todayStart = getTodayStart(resolvedTimezone);
    const todayEnd = getTodayEnd(resolvedTimezone);

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        OR: [
          {
            createdAt: {
              gte: todayStart,
              lt: todayEnd,
            },
          },
          {
            dueDate: {
              gte: todayStart,
              lt: todayEnd,
            },
          },
          {
            AND: [
              { isCompleted: true },
              {
                updatedAt: {
                  gte: todayStart,
                  lt: todayEnd,
                },
              },
            ],
          },
          {
            studyRecords: {
              some: {
                OR: [
                  {
                    startedAt: {
                      gte: todayStart,
                      lt: todayEnd,
                    },
                  },
                  {
                    completedAt: {
                      gte: todayStart,
                      lt: todayEnd,
                    },
                  },
                  {
                    createdAt: {
                      gte: todayStart,
                      lt: todayEnd,
                    },
                  },
                ],
              },
            },
          },
          {
            pomodoroSessions: {
              some: {
                status: { not: 'CANCELLED' as any },
                OR: [
                  {
                    startedAt: {
                      gte: todayStart,
                      lt: todayEnd,
                    },
                  },
                  {
                    completedAt: {
                      gte: todayStart,
                      lt: todayEnd,
                    },
                  },
                  {
                    createdAt: {
                      gte: todayStart,
                      lt: todayEnd,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      orderBy: [
        { isCompleted: 'asc' },
        { priority: 'desc' },
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        _count: {
          select: {
            studyRecords: true,
            pomodoroSessions: {
              where: {
                status: 'COMPLETED',
              },
            },
          },
        },
      },
    });

    return this.mapTasksWithPomodoroCount(tasks);
  }

  // 批量更新任务排序
  async updateTasksOrder(userId: string, taskOrders: { id: string; sortOrder: number }[]) {
    const updatePromises = taskOrders.map(({ id, sortOrder }) =>
      this.prisma.task.update({
        where: {
          id,
          userId, // 确保只能更新自己的任务
        },
        data: { sortOrder },
      })
    );

    return Promise.all(updatePromises);
  }

  private async resolveTimezone(userId: string, timezone?: string) {
    if (timezone) {
      return timezone;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    return user?.timezone || 'Asia/Shanghai';
  }

  private mapTasksWithPomodoroCount(tasks: any[]) {
    return tasks.map(task => ({
      ...task,
      pomodoroCount: task._count?.pomodoroSessions || 0,
    }));
  }
}
