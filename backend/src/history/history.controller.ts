import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HistoryService } from './history.service';

@ApiTags('历史数据')
@Controller('history')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('dates')
  @ApiOperation({ summary: '获取可用日期列表' })
  async getAvailableDates(@Req() req: any) {
    const userId = req.user.id;
    const dates = await this.historyService.getAvailableDates(userId);
    return { dates };
  }

  @Get('day/:date')
  @ApiOperation({ summary: '获取指定日期的数据' })
  async getDayData(@Param('date') date: string, @Req() req: any) {
    const userId = req.user.id;
    const data = await this.historyService.getDayData(userId, date);

    if (!data) {
      return { data: null };
    }

    return { data };
  }

  @Get('overview')
  @ApiOperation({ summary: '获取数据概况' })
  @ApiQuery({ name: 'goalId', required: false, description: '目标ID，不传则显示全部时间' })
  async getOverview(@Req() req: any, @Query('goalId') goalId?: string) {
    const userId = req.user.id;
    const data = await this.historyService.getGoalOverview(userId, goalId);
    return { data };
  }
}
