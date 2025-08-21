import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTodayStart, getTodayEnd, formatDateString, parseDateString } from '../common/utils/date.util';
import { CreateStudyRecordDto, CreatePomodoroSessionDto } from './dto/create-study.dto';

@Injectable()
export class StudyService {
  constructor(private prisma: PrismaService) {}

  // 获取学习统计
  async getStudyStats(userId: string) {
    const [totalMinutes, totalSessions, totalPomodoros] = await Promise.all([
      this.prisma.studyRecord.aggregate({
        where: { userId },
        _sum: { duration: true },
      }),
      this.prisma.studyRecord.count({ where: { userId } }),
      this.prisma.pomodoroSession.count({ where: { userId } }),
    ]);

    return {
      totalMinutes: totalMinutes._sum.duration || 0,
      totalSessions,
      totalPomodoros,
      totalHours: Math.round((totalMinutes._sum.duration || 0) / 60 * 100) / 100,
    };
  }

  // 获取每日学习数据
  async getDailyData(userId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    
    return this.prisma.dailyData.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
    });
  }

  // 获取最近的学习记录
  async getRecentStudyRecords(userId: string, limit = 10) {
    return this.prisma.studyRecord.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            subject: true,
          },
        },
      },
    });
  }

  // 获取番茄钟会话
  async getPomodoroSessions(userId: string, limit = 10) {
    return this.prisma.pomodoroSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            subject: true,
          },
        },
      },
    });
  }

  // 创建学习记录
  async createStudyRecord(userId: string, createStudyRecordDto: CreateStudyRecordDto) {
    const now = new Date();
    const startedAt = createStudyRecordDto.startedAt ? new Date(createStudyRecordDto.startedAt) : now;
    const completedAt = createStudyRecordDto.completedAt ? new Date(createStudyRecordDto.completedAt) : now;

    // 创建学习记录
    const studyRecord = await this.prisma.studyRecord.create({
      data: {
        userId,
        duration: createStudyRecordDto.duration,
        subject: createStudyRecordDto.subject || '其他',
        taskId: createStudyRecordDto.taskId,
        startedAt,
        completedAt,
        createdAt: completedAt, // 使用完成时间作为创建时间
      },
    });

    // 更新每日数据汇总
    await this.updateDailyData(userId, completedAt, createStudyRecordDto.duration);

    return studyRecord;
  }

  // 更新每日数据汇总
  private async updateDailyData(userId: string, completedAt: Date, duration: number) {
    // 获取完成时间对应的日期
    const dateStr = formatDateString(completedAt);
    const date = parseDateString(dateStr);

    // 更新或创建每日数据
    await this.prisma.dailyData.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      update: {
        totalMinutes: {
          increment: duration,
        },
      },
      create: {
        userId,
        date,
        totalMinutes: duration,
        pomodoroCount: 0,
      },
    });
  }

  // 创建番茄钟会话
  async createPomodoroSession(userId: string, createPomodoroSessionDto: CreatePomodoroSessionDto) {
    const now = new Date();
    const startedAt = createPomodoroSessionDto.startedAt ? new Date(createPomodoroSessionDto.startedAt) : now;
    const completedAt = createPomodoroSessionDto.completedAt ? new Date(createPomodoroSessionDto.completedAt) : now;

    return this.prisma.pomodoroSession.create({
      data: {
        userId,
        duration: createPomodoroSessionDto.duration,
        type: createPomodoroSessionDto.type,
        status: createPomodoroSessionDto.status,
        taskId: createPomodoroSessionDto.taskId,
        startedAt,
        completedAt,
        createdAt: completedAt, // 使用完成时间作为创建时间
      },
    });
  }

  // 删除学习记录
  async deleteStudyRecord(userId: string, recordId: string) {
    // 先获取要删除的记录信息
    const record = await this.prisma.studyRecord.findFirst({
      where: {
        id: recordId,
        userId,
      },
    });

    if (!record) {
      throw new Error('学习记录不存在');
    }

    // 删除记录
    const result = await this.prisma.studyRecord.deleteMany({
      where: {
        id: recordId,
        userId,
      },
    });

    // 如果删除成功，更新每日数据（减去删除的时长）
    if (result.count > 0) {
      await this.updateDailyData(userId, record.completedAt || record.createdAt, -record.duration);
    }

    return result;
  }

  // 获取最近的学习记录（用于撤销）
  async getLatestStudyRecord(userId: string) {
    return this.prisma.studyRecord.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 获取今日学习统计
  async getTodayStats(userId: string, timezone: string = 'Asia/Shanghai') {
    // 获取用户时区的今天日期
    const todayDateStr = formatDateString(getTodayStart(timezone), timezone);
    const todayDate = parseDateString(todayDateStr);

    // 获取今日的DailyData记录
    const dailyData = await this.prisma.dailyData.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayDate,
        },
      },
    });

    // 如果没有今日数据，返回默认值
    if (!dailyData) {
      return {
        totalMinutes: 0,
        pomodoroCount: 0,
        studyRecords: [],
        pomodoroSessions: [],
      };
    }

    // 获取今日的学习记录和番茄钟会话（用于详细显示）
    const today = getTodayStart(timezone);
    const tomorrow = getTodayEnd(timezone);

    const [studyRecords, pomodoroSessions] = await Promise.all([
      this.prisma.studyRecord.findMany({
        where: {
          userId,
          startedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.pomodoroSession.findMany({
        where: {
          userId,
          startedAt: {
            gte: today,
            lt: tomorrow,
          },
          status: 'COMPLETED',
          type: 'WORK',
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    return {
      totalMinutes: dailyData.totalMinutes,
      pomodoroCount: dailyData.pomodoroCount,
      studyRecords,
      pomodoroSessions,
      totalHours: Math.round(dailyData.totalMinutes / 60 * 100) / 100,
    };
  }

}
