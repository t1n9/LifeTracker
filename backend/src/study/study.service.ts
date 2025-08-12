import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTodayStart, getTodayEnd } from '../common/utils/date.util';
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

    return this.prisma.studyRecord.create({
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
    return this.prisma.studyRecord.deleteMany({
      where: {
        id: recordId,
        userId,
      },
    });
  }

  // 获取最近的学习记录（用于撤销）
  async getLatestStudyRecord(userId: string) {
    return this.prisma.studyRecord.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 获取今日学习统计
  async getTodayStats(userId: string) {
    // 使用北京时间计算今天的开始和结束时间
    const today = getTodayStart();
    const tomorrow = getTodayEnd();

    const [studyRecords, pomodoroSessions] = await Promise.all([
      this.prisma.studyRecord.findMany({
        where: {
          userId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pomodoroSession.findMany({
        where: {
          userId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
          status: 'COMPLETED',
          type: 'WORK',
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalMinutes = studyRecords.reduce((sum, record) => sum + record.duration, 0);
    const pomodoroCount = pomodoroSessions.length;

    return {
      totalMinutes,
      pomodoroCount,
      studyRecords: studyRecords.length,
      totalHours: Math.round(totalMinutes / 60 * 100) / 100,
    };
  }

}
