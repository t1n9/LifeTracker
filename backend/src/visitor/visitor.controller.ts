import { Controller, Post, Get, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { VisitorService } from './visitor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface RecordVisitDto {
  profileUserId: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

@Controller('visitor')
export class VisitorController {
  constructor(private readonly visitorService: VisitorService) {}

  // 记录访问（公开接口，不需要登录）
  @Post('record')
  async recordVisit(@Body() recordDto: RecordVisitDto, @Req() req: Request) {
    // 获取访客信息
    const ipAddress = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const acceptLanguage = req.headers['accept-language'];
    const sessionId = this.generateSessionId();
    
    // 生成设备指纹
    const deviceFingerprint = this.visitorService.generateDeviceFingerprint(
      userAgent,
      acceptLanguage,
      // 可以从请求头获取更多信息
    );

    // 检查是否为登录用户
    let visitorUserId: string | undefined;
    try {
      // 尝试从token获取用户ID（如果有的话）
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // 这里可以解析JWT获取用户ID，但不强制要求登录
        // 简化处理，如果需要可以添加JWT解析逻辑
      }
    } catch (error) {
      // 忽略JWT解析错误，继续作为匿名用户处理
    }

    // 检查是否为自己访问自己的页面
    if (this.visitorService.isOwnerVisit(recordDto.profileUserId, visitorUserId)) {
      return {
        success: true,
        message: '自己访问不计入统计',
        data: { isOwnerVisit: true },
      };
    }

    const result = await this.visitorService.recordVisit({
      profileUserId: recordDto.profileUserId,
      visitorUserId,
      deviceFingerprint,
      ipAddress,
      userAgent,
      sessionId,
      referrer: recordDto.referrer,
      utmSource: recordDto.utmSource,
      utmMedium: recordDto.utmMedium,
      utmCampaign: recordDto.utmCampaign,
    });

    return {
      success: true,
      data: result,
    };
  }

  // 获取访客统计（需要登录，只能查看自己的统计）
  @Get('stats/:userId')
  @UseGuards(JwtAuthGuard)
  async getVisitorStats(@Param('userId') userId: string, @Req() req: any) {
    // 确保只能查看自己的统计
    if (req.user.id !== userId) {
      throw new Error('只能查看自己的访客统计');
    }

    const stats = await this.visitorService.getVisitorStats(userId);
    
    return {
      success: true,
      data: stats,
    };
  }

  // 获取简单的访客计数（公开接口，用于显示在分享页面）
  @Get('count/:userId')
  async getVisitorCount(@Param('userId') userId: string) {
    const stats = await this.visitorService.getVisitorStats(userId);
    
    return {
      success: true,
      data: {
        totalVisitors: stats.totalVisitors,
        totalVisits: stats.totalVisits,
      },
    };
  }

  // 获取客户端IP地址
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIp) {
      return realIp;
    }
    
    return remoteAddress || 'unknown';
  }

  // 生成会话ID
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}
