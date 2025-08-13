import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDayStartDto, UpdateDayReflectionDto } from './dto/update-daily.dto';
import { formatDateString, parseDateString, getTodayStart } from '../common/utils/date.util';

@Injectable()
export class DailyService {
  constructor(private prisma: PrismaService) {}

  // 获取每日数据
  async getDailyData(userId: string, date?: string) {
    const targetDate = date ? parseDateString(date) : parseDateString(formatDateString(getTodayStart()));
    
    const dailyData = await this.prisma.dailyData.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      select: {
        id: true,
        date: true,
        dayStart: true,
        dayReflection: true,
        reflectionTime: true,
        totalMinutes: true,
        pomodoroCount: true,
        focusMode: true,
        exerciseFeeling: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return dailyData;
  }

  // 更新开启内容
  async updateDayStart(userId: string, updateDayStartDto: UpdateDayStartDto) {
    const targetDate = updateDayStartDto.date 
      ? parseDateString(updateDayStartDto.date) 
      : parseDateString(formatDateString(getTodayStart()));

    const dailyData = await this.prisma.dailyData.upsert({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      update: {
        dayStart: updateDayStartDto.dayStart,
      },
      create: {
        userId,
        date: targetDate,
        dayStart: updateDayStartDto.dayStart,
        totalMinutes: 0,
        pomodoroCount: 0,
      },
    });

    return dailyData;
  }

  // 更新复盘内容
  async updateDayReflection(userId: string, updateDayReflectionDto: UpdateDayReflectionDto & { phoneUsage?: number }) {
    const targetDate = updateDayReflectionDto.date
      ? parseDateString(updateDayReflectionDto.date)
      : parseDateString(formatDateString(getTodayStart()));

    // 如果没有提供复盘时间，使用当前时间
    const reflectionTime = updateDayReflectionDto.reflectionTime ||
      new Date().toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

    // 更新每日数据
    const dailyData = await this.prisma.dailyData.upsert({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      update: {
        dayReflection: updateDayReflectionDto.dayReflection,
        reflectionTime: reflectionTime,
      },
      create: {
        userId,
        date: targetDate,
        dayReflection: updateDayReflectionDto.dayReflection,
        reflectionTime: reflectionTime,
        totalMinutes: 0,
        pomodoroCount: 0,
      },
    });

    // 如果提供了手机使用时间，保存到健康记录
    if (updateDayReflectionDto.phoneUsage !== undefined && updateDayReflectionDto.phoneUsage > 0) {
      await this.prisma.healthRecord.upsert({
        where: {
          userId_date: {
            userId,
            date: targetDate,
          },
        },
        update: {
          phoneUsage: updateDayReflectionDto.phoneUsage / 60, // 转换为小时
        },
        create: {
          userId,
          date: targetDate,
          phoneUsage: updateDayReflectionDto.phoneUsage / 60, // 转换为小时
        },
      });
    }

    return dailyData;
  }

  // 获取今日开启和复盘状态
  async getTodayStatus(userId: string) {
    const today = parseDateString(formatDateString(getTodayStart()));

    const dailyData = await this.prisma.dailyData.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      select: {
        dayStart: true,
        dayReflection: true,
        reflectionTime: true,
      },
    });

    // 获取健康记录中的手机使用时间
    const healthRecord = await this.prisma.healthRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      select: {
        phoneUsage: true,
      },
    });

    return {
      hasStarted: !!(dailyData?.dayStart && dailyData.dayStart.trim() !== ''),
      hasReflected: !!(dailyData?.dayReflection && dailyData.dayReflection.trim() !== ''),
      dayStart: dailyData?.dayStart || null,
      dayReflection: dailyData?.dayReflection || null,
      reflectionTime: dailyData?.reflectionTime || null,
      phoneUsage: healthRecord?.phoneUsage ? Math.round(healthRecord.phoneUsage * 60) : null, // 转换为分钟
    };
  }

  // 清除开启内容
  async clearDayStart(userId: string, date?: string) {
    const targetDate = date 
      ? parseDateString(date) 
      : parseDateString(formatDateString(getTodayStart()));

    const dailyData = await this.prisma.dailyData.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
    });

    if (!dailyData) {
      return null;
    }

    return this.prisma.dailyData.update({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      data: {
        dayStart: null,
      },
    });
  }

  // 清除复盘内容
  async clearDayReflection(userId: string, date?: string) {
    const targetDate = date 
      ? parseDateString(date) 
      : parseDateString(formatDateString(getTodayStart()));

    const dailyData = await this.prisma.dailyData.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
    });

    if (!dailyData) {
      return null;
    }

    return this.prisma.dailyData.update({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      data: {
        dayReflection: null,
        reflectionTime: null,
      },
    });
  }
}
