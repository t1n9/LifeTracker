import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatDateString, parseDateString, getTodayStart } from '../common/utils/date.util';

@Injectable()
export class OverviewService {
  constructor(private prisma: PrismaService) {}

  // 获取任务完成热力图数据
  async getTaskHeatmapData(userId: string, days: number = 365) {
    const endDate = getTodayStart();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    // 获取指定时间范围内的每日数据
    const dailyData = await this.prisma.dailyData.findMany({
      where: {
        userId,
        date: {
          gte: parseDateString(formatDateString(startDate)),
          lte: parseDateString(formatDateString(endDate)),
        },
      },
      select: {
        date: true,
        pomodoroCount: true,
      },
    });

    // 获取任务数据 - 统计每天创建的已完成任务数量
    // 正确逻辑：按创建日期分组，统计已完成的任务
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        isCompleted: true,
      },
    });

    // 按创建日期分组，只统计已完成的任务
    const tasksByDate = new Map<string, number>();
    tasks.forEach(task => {
      if (task.createdAt && task.isCompleted) {
        const dateStr = formatDateString(task.createdAt);
        tasksByDate.set(dateStr, (tasksByDate.get(dateStr) || 0) + 1);
      }
    });

    // 生成热力图数据
    const heatmapData = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = formatDateString(currentDate);
      const taskCount = tasksByDate.get(dateStr) || 0;
      
      // 根据任务数量确定热力图等级
      let level = 0;
      if (taskCount === 0) level = 0;
      else if (taskCount <= 2) level = 1;
      else if (taskCount <= 4) level = 2;
      else if (taskCount <= 7) level = 3;
      else level = 4;

      heatmapData.push({
        date: dateStr,
        count: taskCount,
        level,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return heatmapData;
  }

  // 获取最近活动
  async getRecentActivities(userId: string, limit: number = 10) {
    const activities = [];

    // 获取最近完成的任务
    const recentTasks = await this.prisma.task.findMany({
      where: {
        userId,
        isCompleted: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        description: true,
      },
    });

    recentTasks.forEach(task => {
      activities.push({
        id: `task-${task.id}`,
        type: 'task',
        title: task.title,
        description: task.description,
        timestamp: task.updatedAt?.toISOString(),
      });
    });

    // 获取最近的复盘记录
    const recentReflections = await this.prisma.dailyData.findMany({
      where: {
        userId,
        dayReflection: { not: null },
        reflectionTime: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: {
        date: true,
        dayReflection: true,
        reflectionTime: true,
        updatedAt: true,
      },
    });

    recentReflections.forEach(reflection => {
      activities.push({
        id: `reflection-${reflection.date}`,
        type: 'reflection',
        title: '每日复盘',
        description: reflection.dayReflection?.substring(0, 50) + '...',
        timestamp: reflection.updatedAt.toISOString(),
      });
    });

    // 获取最近的学习记录（番茄钟）
    const recentStudy = await this.prisma.dailyData.findMany({
      where: {
        userId,
        totalMinutes: { gt: 0 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        date: true,
        totalMinutes: true,
        pomodoroCount: true,
        updatedAt: true,
      },
    });

    recentStudy.forEach(study => {
      activities.push({
        id: `study-${study.date}`,
        type: 'study',
        title: '专注学习',
        duration: study.totalMinutes,
        timestamp: study.updatedAt.toISOString(),
      });
    });

    // 按时间排序并限制数量
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // 获取学习趋势图表数据
  async getStudyChartData(userId: string, days: number = 30) {
    const endDate = getTodayStart();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    // 获取每日数据
    const dailyData = await this.prisma.dailyData.findMany({
      where: {
        userId,
        date: {
          gte: parseDateString(formatDateString(startDate)),
          lte: parseDateString(formatDateString(endDate)),
        },
      },
      select: {
        date: true,
        totalMinutes: true,
        pomodoroCount: true,
      },
    });

    // 获取每日完成的任务数 - 按创建日期分组，统计已完成的任务
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        isCompleted: true,
      },
    });

    // 按创建日期分组，只统计已完成的任务
    const tasksByDate = new Map<string, number>();
    tasks.forEach(task => {
      if (task.createdAt && task.isCompleted) {
        const dateStr = formatDateString(task.createdAt);
        tasksByDate.set(dateStr, (tasksByDate.get(dateStr) || 0) + 1);
      }
    });

    // 生成图表数据
    const chartData = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = formatDateString(currentDate);
      const dailyRecord = dailyData.find(d => formatDateString(d.date) === dateStr);
      
      chartData.push({
        date: dateStr,
        studyTime: dailyRecord?.totalMinutes || 0,
        tasksCompleted: tasksByDate.get(dateStr) || 0,
        pomodoroCount: dailyRecord?.pomodoroCount || 0,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return chartData;
  }

  // 获取统计概览
  async getOverviewStats(userId: string) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // 总完成任务数
    const totalTasks = await this.prisma.task.count({
      where: {
        userId,
        isCompleted: true,
        updatedAt: { gte: oneYearAgo },
      },
    });

    // 活跃天数（有学习记录的天数）
    const activeDays = await this.prisma.dailyData.count({
      where: {
        userId,
        date: { gte: parseDateString(formatDateString(oneYearAgo)) },
        OR: [
          { totalMinutes: { gt: 0 } },
          { pomodoroCount: { gt: 0 } },
        ],
      },
    });

    // 计算当前连续天数
    const recentDays = await this.prisma.dailyData.findMany({
      where: {
        userId,
        date: { gte: parseDateString(formatDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))) },
        OR: [
          { totalMinutes: { gt: 0 } },
          { pomodoroCount: { gt: 0 } },
        ],
      },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    let currentStreak = 0;
    const today = formatDateString(getTodayStart());
    let checkDate = new Date(getTodayStart());

    for (let i = 0; i < 30; i++) {
      const dateStr = formatDateString(checkDate);
      const hasActivity = recentDays.some(d => formatDateString(d.date) === dateStr);
      
      if (hasActivity) {
        currentStreak++;
      } else {
        break;
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
      totalTasks,
      activeDays,
      avgTasksPerDay: activeDays > 0 ? (totalTasks / activeDays).toFixed(1) : '0',
      currentStreak,
    };
  }
}
