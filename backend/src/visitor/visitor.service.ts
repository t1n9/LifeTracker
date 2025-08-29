import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceType } from '@prisma/client';

interface VisitorData {
  profileUserId: string;
  visitorUserId?: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface DeviceInfo {
  deviceType: DeviceType;
  browser?: string;
  os?: string;
}

@Injectable()
export class VisitorService {
  constructor(private prisma: PrismaService) {}

  // 记录访客访问
  async recordVisit(data: VisitorData): Promise<{ isNewVisitor: boolean; totalVisitors: number }> {
    const deviceInfo = this.parseDeviceInfo(data.userAgent);
    
    // 查找现有访客记录
    const existingVisitor = await this.prisma.profileVisitor.findUnique({
      where: {
        profileUserId_deviceFingerprint: {
          profileUserId: data.profileUserId,
          deviceFingerprint: data.deviceFingerprint,
        },
      },
    });

    let isNewVisitor = false;

    if (existingVisitor) {
      // 更新现有访客的访问信息
      await this.prisma.profileVisitor.update({
        where: { id: existingVisitor.id },
        data: {
          lastVisitAt: new Date(),
          visitCount: { increment: 1 },
          visitorUserId: data.visitorUserId, // 更新用户ID（如果从匿名变为登录）
          ipAddress: data.ipAddress, // 更新IP（可能变化）
        },
      });

      // 记录详细访问日志
      await this.prisma.profileVisitLog.create({
        data: {
          profileUserId: data.profileUserId,
          visitorId: existingVisitor.id,
          visitedAt: new Date(),
          referrer: data.referrer,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
        },
      });
    } else {
      // 创建新访客记录
      isNewVisitor = true;
      const newVisitor = await this.prisma.profileVisitor.create({
        data: {
          profileUserId: data.profileUserId,
          visitorUserId: data.visitorUserId,
          deviceFingerprint: data.deviceFingerprint,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          sessionId: data.sessionId,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          firstVisitAt: new Date(),
          lastVisitAt: new Date(),
          visitCount: 1,
          referrer: data.referrer,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
        },
      });

      // 记录首次访问日志
      await this.prisma.profileVisitLog.create({
        data: {
          profileUserId: data.profileUserId,
          visitorId: newVisitor.id,
          visitedAt: new Date(),
          referrer: data.referrer,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
        },
      });
    }

    // 获取总访客数
    const totalVisitors = await this.prisma.profileVisitor.count({
      where: { profileUserId: data.profileUserId },
    });

    return { isNewVisitor, totalVisitors };
  }

  // 获取访客统计
  async getVisitorStats(profileUserId: string) {
    const [
      totalVisitors,
      totalVisits,
      recentVisitors,
      deviceStats,
      referrerStats,
      dailyStats,
    ] = await Promise.all([
      // 总访客数
      this.prisma.profileVisitor.count({
        where: { profileUserId },
      }),

      // 总访问次数（使用访客表的visitCount总和）
      this.prisma.profileVisitor.aggregate({
        where: { profileUserId },
        _sum: { visitCount: true },
      }).then(result => result._sum.visitCount || 0),

      // 最近访客
      this.prisma.profileVisitor.findMany({
        where: { profileUserId },
        orderBy: { lastVisitAt: 'desc' },
        take: 10,
        select: {
          id: true,
          deviceType: true,
          browser: true,
          os: true,
          country: true,
          city: true,
          visitCount: true,
          firstVisitAt: true,
          lastVisitAt: true,
          visitorUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),

      // 设备类型统计
      this.prisma.profileVisitor.groupBy({
        by: ['deviceType'],
        where: { profileUserId },
        _count: { deviceType: true },
      }),

      // 来源统计
      this.prisma.profileVisitor.groupBy({
        by: ['referrer'],
        where: { 
          profileUserId,
          referrer: { not: null },
        },
        _count: { referrer: true },
        orderBy: { _count: { referrer: 'desc' } },
        take: 10,
      }),

      // 每日访问统计（最近30天）
      this.prisma.profileVisitLog.groupBy({
        by: ['visitedAt'],
        where: {
          profileUserId,
          visitedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        _count: { visitedAt: true },
      }),
    ]);

    return {
      totalVisitors,
      totalVisits,
      recentVisitors,
      deviceStats: deviceStats.map(stat => ({
        deviceType: stat.deviceType,
        count: stat._count.deviceType,
      })),
      referrerStats: referrerStats.map(stat => ({
        referrer: stat.referrer,
        count: stat._count.referrer,
      })),
      dailyStats: this.processDailyStats(dailyStats),
    };
  }

  // 生成设备指纹
  generateDeviceFingerprint(userAgent: string, acceptLanguage?: string, timezone?: string): string {
    const components = [
      userAgent,
      acceptLanguage || 'unknown',
      timezone || 'unknown',
      // 可以添加更多浏览器特征
    ];
    
    // 简单的哈希函数（生产环境建议使用更复杂的算法）
    return Buffer.from(components.join('|')).toString('base64').slice(0, 32);
  }

  // 解析设备信息
  private parseDeviceInfo(userAgent: string): DeviceInfo {
    const ua = userAgent.toLowerCase();
    
    // 设备类型检测
    let deviceType: DeviceType = 'DESKTOP';
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      deviceType = 'MOBILE';
    } else if (/tablet|ipad/i.test(ua)) {
      deviceType = 'TABLET';
    }

    // 浏览器检测
    let browser = 'Unknown';
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    // 操作系统检测
    let os = 'Unknown';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('ios')) os = 'iOS';

    return { deviceType, browser, os };
  }

  // 处理每日统计数据
  private processDailyStats(rawStats: any[]) {
    const dailyMap = new Map();
    
    rawStats.forEach(stat => {
      const date = stat.visitedAt.toISOString().split('T')[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + stat._count.visitedAt);
    });

    // 生成最近30天的完整数据
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        visits: dailyMap.get(dateStr) || 0,
      });
    }

    return result;
  }

  // 检查是否为自己访问自己的页面
  isOwnerVisit(profileUserId: string, visitorUserId?: string): boolean {
    return profileUserId === visitorUserId;
  }
}
