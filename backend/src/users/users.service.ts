import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: createUserDto,
    });

    // 创建默认用户设置
    await this.prisma.userSettings.create({
      data: {
        userId: user.id,
      },
    });

    return user;
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        userSettings: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userSettings: true,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async updatePassword(id: string, hashedPassword: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  // 获取用户运动配置
  async getExerciseConfig(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        showPullUps: true,
        showSquats: true,
        showPushUps: true,
        showRunning: true,
        showSwimming: true,
        showCycling: true,
      },
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    return user;
  }

  // 获取用户统计信息
  async getUserStats(userId: string) {
    const [
      taskCount,
      studyRecordCount,
      pomodoroCount,
      dailyDataCount,
    ] = await Promise.all([
      this.prisma.task.count({ where: { userId } }),
      this.prisma.studyRecord.count({ where: { userId } }),
      this.prisma.pomodoroSession.count({ where: { userId } }),
      this.prisma.dailyData.count({ where: { userId } }),
    ]);

    return {
      taskCount,
      studyRecordCount,
      pomodoroCount,
      dailyDataCount,
    };
  }
}
