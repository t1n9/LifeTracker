import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
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
  @ApiOperation({ summary: '获取公开分享的学习概况数据（默认用户）' })
  async getSharedOverview() {
    // 硬编码您的用户ID
    const sharedUserId = 'f2c457fa-ea58-4b2d-88cd-008aac10299c'; // 1378006836@qq.com

    const [heatmapData, activities, chartData, stats] = await Promise.all([
      this.overviewService.getTaskHeatmapData(sharedUserId),
      this.overviewService.getRecentActivities(sharedUserId, 5), // 只获取最近5个活动
      this.overviewService.getStudyChartData(sharedUserId),
      this.overviewService.getOverviewStats(sharedUserId),
    ]);

    return {
      heatmapData,
      activities,
      chartData,
      stats,
      userInfo: {
        email: '1378006836@qq.com',
        displayName: '吴艇',
        shareNote: '这是一个公开的学习概况分享页面',
      },
    };
  }

  @Get(':shareCode')
  @ApiOperation({ summary: '通过分享码获取用户的学习概况数据' })
  @ApiParam({ name: 'shareCode', description: '分享码' })
  async getSharedOverviewByCode(@Param('shareCode') shareCode: string) {
    // 通过分享码获取用户信息
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
