import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { OverviewService } from './overview.service';
import { ShareLinkService } from './share-link.service';

@ApiTags('公开分享')
@Controller('share')
export class ShareController {
  constructor(
    private readonly overviewService: OverviewService,
    private readonly shareLinkService: ShareLinkService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: '获取默认公开分享页面数据（需通过环境变量配置分享码）' })
  async getSharedOverview() {
    const defaultShareCode = process.env.DEFAULT_SHARE_CODE;

    if (!defaultShareCode) {
      throw new NotFoundException('Default public share page is not configured');
    }

    return this.getSharedOverviewByCode(defaultShareCode);
  }

  @Get(':shareCode')
  @ApiOperation({ summary: '通过分享码获取用户的学习概况数据' })
  @ApiParam({ name: 'shareCode', description: '分享码' })
  async getSharedOverviewByCode(@Param('shareCode') shareCode: string) {
    const { userId, userInfo } = await this.shareLinkService.getUserByShareCode(shareCode);

    const [heatmapData, activities, chartData, stats] = await Promise.all([
      this.overviewService.getTaskHeatmapData(userId),
      this.overviewService.getRecentActivities(userId, 5),
      this.overviewService.getStudyChartData(userId),
      this.overviewService.getOverviewStats(userId),
    ]);

    return {
      heatmapData,
      activities,
      chartData,
      stats,
      userInfo,
    };
  }
}
