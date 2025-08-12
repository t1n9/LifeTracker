import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('健康')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '系统健康检查' })
  async checkHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'LifeTracker API',
    };
  }

  @Get('stats')
  @ApiOperation({ summary: '获取健康统计' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getHealthStats(@Request() req) {
    return this.healthService.getHealthStats(req.user.id);
  }

  @Get('records')
  @ApiOperation({ summary: '获取健康记录' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getHealthRecords(@Request() req, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 30;
    return this.healthService.getHealthRecords(req.user.id, limitNum);
  }

  @Get('exercise')
  @ApiOperation({ summary: '获取运动记录' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getExerciseRecords(@Request() req, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 30;
    return this.healthService.getExerciseRecords(req.user.id, limitNum);
  }

  @Get('expense')
  @ApiOperation({ summary: '获取支出记录' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getExpenseRecords(@Request() req, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 30;
    return this.healthService.getExpenseRecords(req.user.id, limitNum);
  }
}
