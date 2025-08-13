import { Controller, Get, Body, Patch, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString } from 'class-validator';

@ApiTags('用户')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: '获取用户资料' })
  async getProfile(@Request() req) {
    const user = await this.usersService.findById(req.user.id);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      targetName: user.targetName,
      targetDate: user.targetDate,
      examDate: user.examDate,
      theme: user.theme,
      createdAt: user.createdAt,
      userSettings: user.userSettings,
      // 运动配置
      showPullUps: user.showPullUps,
      showSquats: user.showSquats,
      showPushUps: user.showPushUps,
      showRunning: user.showRunning,
      showSwimming: user.showSwimming,
      showCycling: user.showCycling,
    };
  }

  @Patch('profile')
  @ApiOperation({ summary: '更新用户资料' })
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.id, updateUserDto);
  }

  @Get('exercise-config')
  @ApiOperation({ summary: '获取运动配置' })
  async getExerciseConfig(@Request() req) {
    return this.usersService.getExerciseConfig(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取用户统计信息' })
  async getUserStats(@Request() req) {
    return this.usersService.getUserStats(req.user.id);
  }

  @Patch('theme')
  @ApiOperation({ summary: '更新用户主题' })
  async updateTheme(@Request() req, @Body() body: { theme: string }) {
    const { theme } = body;
    await this.usersService.update(req.user.id, { theme });
    return { success: true, theme };
  }
}
