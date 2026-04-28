import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTodayStart, formatDateString } from '../common/utils/date.util';

@Injectable()
export class ExerciseService {
  constructor(private prisma: PrismaService) {}

  private getTodayDateStr(timezone = 'Asia/Shanghai'): string {
    return formatDateString(getTodayStart(timezone), timezone);
  }

  async addLog(
    userId: string,
    data: {
      exerciseName: string;
      emoji?: string;
      value: number;
      unit: string;
      note?: string;
      date?: string;
    },
    timezone = 'Asia/Shanghai',
  ) {
    const date = data.date ?? this.getTodayDateStr(timezone);
    return this.prisma.exerciseLog.create({
      data: {
        userId,
        exerciseName: data.exerciseName,
        emoji: data.emoji ?? null,
        value: data.value,
        unit: data.unit,
        note: data.note ?? null,
        date,
      },
    });
  }

  async getTodayLogs(userId: string, timezone = 'Asia/Shanghai') {
    const date = this.getTodayDateStr(timezone);
    const logs = await this.prisma.exerciseLog.findMany({
      where: { userId, date },
      orderBy: { loggedAt: 'asc' },
    });

    // Aggregate by exercise name
    const map = new Map<string, { exerciseName: string; emoji: string | null; totalValue: number; unit: string; count: number }>();
    for (const log of logs) {
      const key = log.exerciseName;
      if (!map.has(key)) {
        map.set(key, { exerciseName: key, emoji: log.emoji, totalValue: 0, unit: log.unit, count: 0 });
      }
      const entry = map.get(key)!;
      entry.totalValue += log.value;
      entry.count += 1;
    }
    return Array.from(map.values());
  }

  async getLogsByDateRange(userId: string, from: string, to: string) {
    const logs = await this.prisma.exerciseLog.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { loggedAt: 'asc' }],
    });

    const byDate = new Map<string, typeof logs>();
    for (const log of logs) {
      if (!byDate.has(log.date)) byDate.set(log.date, []);
      byDate.get(log.date)!.push(log);
    }

    return Array.from(byDate.entries()).map(([date, entries]) => ({ date, entries }));
  }

  async deleteLog(userId: string, logId: string) {
    return this.prisma.exerciseLog.delete({
      where: { id: logId, userId },
    });
  }

  async setTodayExerciseFeeling(userId: string, feeling: string, timezone = 'Asia/Shanghai') {
    const { parseDateString } = await import('../common/utils/date.util');
    const todayDate = parseDateString(this.getTodayDateStr(timezone));
    return this.prisma.dailyData.upsert({
      where: { userId_date: { userId, date: todayDate } },
      update: { exerciseFeeling: feeling },
      create: { userId, date: todayDate, exerciseFeeling: feeling },
    });
  }

  async getTodayExerciseFeeling(userId: string, timezone = 'Asia/Shanghai') {
    const { parseDateString } = await import('../common/utils/date.util');
    const todayDate = parseDateString(this.getTodayDateStr(timezone));
    const daily = await this.prisma.dailyData.findUnique({
      where: { userId_date: { userId, date: todayDate } },
      select: { exerciseFeeling: true },
    });
    return daily?.exerciseFeeling ?? null;
  }
}
