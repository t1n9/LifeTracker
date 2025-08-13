import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { getTodayStart, getTodayEnd } from '../common/utils/date.util';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createTaskDto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        ...createTaskDto,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    // 获取任务列表，包含已完成的番茄钟数量统计
    const tasks = await this.prisma.task.findMany({
      where: { userId },
      orderBy: [
        { isCompleted: 'asc' },
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
}
