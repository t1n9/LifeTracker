import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GoalsService } from './goals.service';

@ApiTags('目标管理')
@Controller('goals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get('current')
  @ApiOperation({ summary: '获取当前活跃目标' })
  async getCurrentGoal(@Req() req: any) {
    const userId = req.user.id;
    const goal = await this.goalsService.getCurrentGoal(userId);

    // 确保日期字段被正确序列化
    if (goal) {
      const serializedGoal = {
        ...goal,
        startDate: goal.startDate ? goal.startDate.toISOString() : null,
        targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
        endDate: goal.endDate ? goal.endDate.toISOString() : null,
        createdAt: goal.createdAt ? goal.createdAt.toISOString() : null,
        updatedAt: goal.updatedAt ? goal.updatedAt.toISOString() : null,
      };
      return { data: serializedGoal };
    }

    return { data: goal };
  }

  @Get('history')
  @ApiOperation({ summary: '获取目标历史' })
  async getGoalHistory(@Req() req: any) {
    const userId = req.user.id;
    const goals = await this.goalsService.getGoalHistory(userId);

    // 确保所有目标的日期字段被正确序列化
    const serializedGoals = goals.map(goal => ({
      ...goal,
      startDate: goal.startDate ? goal.startDate.toISOString() : null,
      targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
      endDate: goal.endDate ? goal.endDate.toISOString() : null,
      createdAt: goal.createdAt ? goal.createdAt.toISOString() : null,
      updatedAt: goal.updatedAt ? goal.updatedAt.toISOString() : null,
    }));

    return { data: serializedGoals };
  }

  @Post('start')
  @ApiOperation({ summary: '开启新目标' })
  async startNewGoal(@Req() req: any, @Body() goalData: {
    goalName: string;
    targetDate?: string;
    examDate?: string;
    description?: string;
  }) {
    const userId = req.user.id;
    const goal = await this.goalsService.startNewGoal(userId, goalData);

    // 确保日期字段被正确序列化
    const serializedGoal = {
      ...goal,
      startDate: goal.startDate ? goal.startDate.toISOString() : null,
      targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
      endDate: goal.endDate ? goal.endDate.toISOString() : null,
      createdAt: goal.createdAt ? goal.createdAt.toISOString() : null,
      updatedAt: goal.updatedAt ? goal.updatedAt.toISOString() : null,
    };

    return {
      data: serializedGoal,
      message: '新目标已开启'
    };
  }

  @Put('terminate')
  @ApiOperation({ summary: '终止当前目标' })
  async terminateCurrentGoal(@Req() req: any) {
    const userId = req.user.id;
    const goal = await this.goalsService.terminateCurrentGoal(userId);
    return { 
      data: goal,
      message: goal ? '当前目标已终止' : '没有活跃的目标'
    };
  }

  @Put(':id/complete')
  @ApiOperation({ summary: '完成目标' })
  async completeGoal(@Req() req: any, @Param('id') goalId: string) {
    const userId = req.user.id;
    const goal = await this.goalsService.completeGoal(userId, goalId);
    return { 
      data: goal,
      message: '目标已完成'
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新目标' })
  async updateGoal(@Param('id') id: string, @Body() updateData: any, @Req() req: any) {
    const goal = await this.goalsService.updateGoal(id, req.user.id, updateData);

    // 确保日期字段被正确序列化
    const serializedGoal = {
      ...goal,
      startDate: goal.startDate ? goal.startDate.toISOString() : null,
      targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
      endDate: goal.endDate ? goal.endDate.toISOString() : null,
      createdAt: goal.createdAt ? goal.createdAt.toISOString() : null,
      updatedAt: goal.updatedAt ? goal.updatedAt.toISOString() : null,
    };

    return { data: serializedGoal };
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除目标' })
  async deleteGoal(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    const result = await this.goalsService.deleteGoal(id, userId);
    return { data: result };
  }

  @Post('migrate')
  @ApiOperation({ summary: '迁移现有用户数据（管理员功能）' })
  async migrateExistingUsers(@Req() req: any) {
    // 这里可以添加管理员权限检查
    const result = await this.goalsService.migrateExistingUsers();
    return {
      data: result,
      message: `成功迁移 ${result.migratedCount} 个用户的目标数据`
    };
  }
}
