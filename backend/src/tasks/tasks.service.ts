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
  async getTodayTasks(userId: string, timezone: string = 'Asia/Shanghai') {
    // 获取用户时区的今天开始和结束时间
    const todayStart = getTodayStart(timezone);
    const todayEnd = getTodayEnd(timezone);

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

    // 返回任务列表，使用_count.pomodoroSessions作为番茄数量
    return tasks.map(task => ({
      ...task,
      pomodoroCount: task._count.pomodoroSessions || 0,
    }));
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
}
