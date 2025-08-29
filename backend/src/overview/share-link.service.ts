import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class ShareLinkService {
  constructor(private readonly prisma: PrismaService) {}

  private generateShareCode(length = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  // 生成分享链接
  async createShareLink(userId: string) {
    // 检查用户是否存在
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('用户不存在或未激活');
    }

    // 检查是否已有活跃的分享链接
    const existingLink = await this.prisma.shareLink.findFirst({
      where: {
        userId,
        isActive: true,
      },
    });

    if (existingLink) {
      // 更新现有链接
      return await this.prisma.shareLink.update({
        where: { id: existingLink.id },
        data: {
          updatedAt: new Date(),
        },
        select: {
          id: true,
          userId: true,
          shareCode: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    // 生成新的分享码（8位随机字符串）
    let shareCode: string;
    let isUnique = false;
    
    while (!isUnique) {
      shareCode = this.generateShareCode(8);
      const existing = await this.prisma.shareLink.findUnique({
        where: { shareCode },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    // 创建新的分享链接
    return await this.prisma.shareLink.create({
      data: {
        userId,
        shareCode,
      },
      select: {
        id: true,
        userId: true,
        shareCode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // 通过分享码获取用户信息
  async getUserByShareCode(shareCode: string) {
    const shareLink = await this.prisma.shareLink.findUnique({
      where: { shareCode },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!shareLink || !shareLink.isActive || !shareLink.user.isActive) {
      throw new NotFoundException('分享链接不存在或已失效');
    }

    return {
      userId: shareLink.user.id,
      userInfo: {
        userId: shareLink.user.id,
        email: shareLink.user.email,
        displayName: shareLink.user.name || '学习者',
        shareNote: `${shareLink.user.name || '学习者'}的学习概况分享`,
        shareTitle: `${shareLink.user.name || '学习者'}的学习概况`,
      },
    };
  }

  // 获取用户的分享链接
  async getUserShareLink(userId: string) {
    return await this.prisma.shareLink.findFirst({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        shareCode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // 禁用分享链接
  async disableShareLink(userId: string) {
    return await this.prisma.shareLink.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  }
}
