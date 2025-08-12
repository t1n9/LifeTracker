import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ImportantInfoService {
  constructor(private prisma: PrismaService) {}



  // 获取当前重要信息
  async getCurrentInfo(userId: string) {
    // 获取用户设置中的当前重要信息ID
    const userSettings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: {
        currentImportantInfoId: true
      },
    });

    if (userSettings?.currentImportantInfoId) {
      // 根据ID获取当前重要信息
      const currentInfo = await this.prisma.importantInfo.findUnique({
        where: { id: userSettings.currentImportantInfoId },
      });

      if (currentInfo) {
        return {
          content: currentInfo.content,
          lastUpdated: currentInfo.createdAt,
        };
      }
    }

    // 如果没有设置当前ID或记录不存在，查找最新的非空重要信息
    const latestInfo = await this.prisma.importantInfo.findFirst({
      where: {
        userId,
        content: { not: '' }
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestInfo) {
      // 更新用户设置中的当前ID
      await this.prisma.userSettings.upsert({
        where: { userId },
        update: { currentImportantInfoId: latestInfo.id },
        create: {
          userId,
          currentImportantInfoId: latestInfo.id,
        },
      });

      return {
        content: latestInfo.content,
        lastUpdated: latestInfo.createdAt,
      };
    }

    return {
      content: '',
      lastUpdated: null,
    };
  }

  // 更新重要信息
  async updateInfo(userId: string, content: string) {
    // 获取当前重要信息
    const currentInfo = await this.getCurrentInfo(userId);
    const currentContent = currentInfo.content;

    // 只有内容发生变化时才创建新记录
    if (currentContent !== content) {
      // 创建新的重要信息记录
      const newInfo = await this.prisma.importantInfo.create({
        data: {
          userId,
          content,
        },
      });

      // 更新用户设置中的当前重要信息ID
      await this.prisma.userSettings.upsert({
        where: { userId },
        update: { currentImportantInfoId: newInfo.id },
        create: {
          userId,
          currentImportantInfoId: newInfo.id,
        },
      });

      return {
        content,
        updated: true,
      };
    }

    return {
      content,
      updated: false,
    };
  }

  // 获取历史记录数量（用于管理员查看）
  async getHistoryCount(userId: string) {
    return this.prisma.importantInfo.count({
      where: { userId },
    });
  }

  // 获取历史记录列表（用于管理员查看）
  async getHistory(userId: string, limit = 10) {
    return this.prisma.importantInfo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    });
  }

  // 清理旧的历史记录（保留最近100条）
  async cleanupHistory(userId: string) {
    const records = await this.prisma.importantInfo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: 100, // 跳过最新的100条
      select: { id: true },
    });

    if (records.length > 0) {
      const idsToDelete = records.map(r => r.id);
      await this.prisma.importantInfo.deleteMany({
        where: {
          id: { in: idsToDelete },
        },
      });
    }

    return records.length;
  }
}
