import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserRoleDto, BanUserDto, UpdateSubscriptionDto } from './dto/admin.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ── 用户列表（分页 + 搜索 + 筛选） ──

  async listUsers(params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    status?: string;
  }) {
    const { page, limit, search, role, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status === 'banned') {
      where.bannedAt = { not: null };
    } else if (status === 'active') {
      where.bannedAt = null;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          bannedAt: true,
          banReason: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              tasks: true,
              pomodoroSessions: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── 用户详情 ──

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
        lastLoginAt: true,
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            trialEndsAt: true,
            canceledAt: true,
            source: true,
          },
        },
        _count: {
          select: {
            tasks: true,
            pomodoroSessions: true,
            studyRecords: true,
            dailyData: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 最近操作审计日志
    const recentAuditLogs = await this.prisma.adminAuditLog.findMany({
      where: { targetId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return { ...user, recentAuditLogs };
  }

  // ── 修改角色 ──

  async updateUserRole(adminId: string, userId: string, dto: UpdateUserRoleDto) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('用户不存在');

    const oldRole = target.role;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: dto.role,
        // 同步 isAdmin 以保持兼容
        isAdmin: dto.role === 'ADMIN',
      },
      select: { id: true, email: true, name: true, role: true },
    });

    await this.writeAuditLog(adminId, userId, 'user.role_change', {
      oldRole,
      newRole: dto.role,
    });

    return updated;
  }

  // ── 封禁用户 ──

  async banUser(adminId: string, userId: string, dto: BanUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('用户不存在');
    if (target.role === 'ADMIN') {
      throw new NotFoundException('不能封禁管理员');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        bannedAt: new Date(),
        banReason: dto.reason || null,
      },
      select: { id: true, email: true, name: true, isActive: true, bannedAt: true, banReason: true },
    });

    await this.writeAuditLog(adminId, userId, 'user.ban', {
      reason: dto.reason || null,
    });

    return updated;
  }

  // ── 解封用户 ──

  async unbanUser(adminId: string, userId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('用户不存在');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        bannedAt: null,
        banReason: null,
      },
      select: { id: true, email: true, name: true, isActive: true },
    });

    await this.writeAuditLog(adminId, userId, 'user.unban', {});

    return updated;
  }

  // ── 修改订阅 ──

  async updateSubscription(adminId: string, userId: string, dto: UpdateSubscriptionDto) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('用户不存在');

    const subscription = await this.prisma.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: dto.plan,
        status: dto.status || 'active',
        currentPeriodEnd: dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : null,
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
        source: 'admin',
      },
      update: {
        plan: dto.plan,
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.currentPeriodEnd !== undefined && {
          currentPeriodEnd: dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : null,
        }),
        ...(dto.trialEndsAt !== undefined && {
          trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
        }),
        source: 'admin',
      },
    });

    await this.writeAuditLog(adminId, userId, 'subscription.update', {
      plan: dto.plan,
      status: dto.status,
    });

    return subscription;
  }

  // ── 审计日志列表 ──

  async getAuditLogs(params: { page: number; limit: number; adminId?: string }) {
    const { page, limit, adminId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (adminId) where.adminId = adminId;

    const [logs, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        include: {
          admin: { select: { id: true, email: true, name: true } },
          target: { select: { id: true, email: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── 私有辅助 ──

  private async writeAuditLog(adminId: string, targetId: string | null, action: string, detail: Prisma.InputJsonValue) {
    await this.prisma.adminAuditLog.create({
      data: { adminId, targetId, action, detail },
    });
  }
}
