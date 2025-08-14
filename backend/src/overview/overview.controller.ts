import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OverviewService } from './overview.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('学习概况')
@Controller('overview')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get('heatmap')
  @ApiOperation({ summary: '获取任务完成热力图数据' })
  @ApiQuery({ name: 'days', required: false, description: '天数 (默认365天)' })
  async getTaskHeatmapData(@Request() req, @Query('days') days?: string) {
    const daysNum = days ? parseInt(days) : 365;
    return this.overviewService.getTaskHeatmapData(req.user.id, daysNum);
  }

  @Get('activities')
  @ApiOperation({ summary: '获取最近活动' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量 (默认10)' })
  async getRecentActivities(@Request() req, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.overviewService.getRecentActivities(req.user.id, limitNum);
  }

  @Get('chart')
  @ApiOperation({ summary: '获取学习趋势图表数据' })
  @ApiQuery({ name: 'days', required: false, description: '天数 (默认30天)' })
  async getStudyChartData(@Request() req, @Query('days') days?: string) {
    const daysNum = days ? parseInt(days) : 30;
    return this.overviewService.getStudyChartData(req.user.id, daysNum);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取统计概览' })
  async getOverviewStats(@Request() req) {
    return this.overviewService.getOverviewStats(req.user.id);
  }

  @Get()
  @ApiOperation({ summary: '获取完整的学习概况数据' })
  async getFullOverview(@Request() req) {
    const [heatmapData, activities, chartData, stats] = await Promise.all([
      this.overviewService.getTaskHeatmapData(req.user.id),
      this.overviewService.getRecentActivities(req.user.id),
      this.overviewService.getStudyChartData(req.user.id),
      this.overviewService.getOverviewStats(req.user.id),
    ]);

    return {
      heatmapData,
      activities,
      chartData,
      stats,
    };
  }


}
