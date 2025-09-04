import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { UpdateSuggestionDto } from './dto/update-suggestion.dto';

@Injectable()
export class SuggestionsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createSuggestionDto: CreateSuggestionDto) {
    return this.prisma.systemSuggestion.create({
      data: {
        ...createSuggestionDto,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async findAll(userId?: string, isAdmin = false) {
    const where = isAdmin ? {} : { userId };
    
    return this.prisma.systemSuggestion.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId?: string, isAdmin = false) {
    const suggestion = await this.prisma.systemSuggestion.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!suggestion) {
      throw new NotFoundException('建议不存在');
    }

    // 非管理员只能查看自己的建议
    if (!isAdmin && suggestion.userId !== userId) {
      throw new ForbiddenException('无权查看此建议');
    }

    return suggestion;
  }

  async update(id: string, updateSuggestionDto: UpdateSuggestionDto, reviewerId?: string) {
    const suggestion = await this.prisma.systemSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      throw new NotFoundException('建议不存在');
    }

    const updateData: any = { ...updateSuggestionDto };
    
    // 如果状态从pending变为其他状态，记录审核信息
    if (suggestion.status === 'pending' && updateSuggestionDto.status && updateSuggestionDto.status !== 'pending') {
      updateData.reviewedAt = new Date();
      updateData.reviewedBy = reviewerId;
    }

    return this.prisma.systemSuggestion.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId?: string, isAdmin = false) {
    const suggestion = await this.prisma.systemSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      throw new NotFoundException('建议不存在');
    }

    // 非管理员只能删除自己的建议，且只能删除pending状态的
    if (!isAdmin) {
      if (suggestion.userId !== userId) {
        throw new ForbiddenException('无权删除此建议');
      }
      if (suggestion.status !== 'pending') {
        throw new ForbiddenException('只能删除待处理的建议');
      }
    }

    return this.prisma.systemSuggestion.delete({
      where: { id },
    });
  }

  async getStats() {
    const [total, pending, reviewed, implemented, rejected] = await Promise.all([
      this.prisma.systemSuggestion.count(),
      this.prisma.systemSuggestion.count({ where: { status: 'pending' } }),
      this.prisma.systemSuggestion.count({ where: { status: 'reviewed' } }),
      this.prisma.systemSuggestion.count({ where: { status: 'implemented' } }),
      this.prisma.systemSuggestion.count({ where: { status: 'rejected' } }),
    ]);

    return {
      total,
      pending,
      reviewed,
      implemented,
      rejected,
    };
  }
}
