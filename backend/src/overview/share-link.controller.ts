import { Controller, Post, Get, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShareLinkService } from './share-link.service';

class CreateShareLinkDto {}


@ApiTags('分享链接管理')
@Controller('share-links')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShareLinkController {
  constructor(private readonly shareLinkService: ShareLinkService) {}

  @Post()
  @ApiOperation({ summary: '创建或更新分享链接' })
  @ApiBody({ type: CreateShareLinkDto })
  async createShareLink(@Request() req: any) {
    const userId = req.user.id;

    const shareLink = await this.shareLinkService.createShareLink(userId);

    const base = (req?.headers?.origin as string) || process.env.FRONTEND_URL || 'https://t1n9.xyz';
    return {
      shareCode: shareLink.shareCode,
      shareUrl: `${base}/share/${shareLink.shareCode}`,
      createdAt: shareLink.createdAt,
      updatedAt: shareLink.updatedAt,
    };
  }

  @Get()
  @ApiOperation({ summary: '获取当前用户的分享链接' })
  async getUserShareLink(@Request() req: any) {
    const userId = req.user.id;
    const shareLink = await this.shareLinkService.getUserShareLink(userId);

    if (!shareLink) {
      return {
        shareCode: null,
        shareUrl: null,
        createdAt: null,
        updatedAt: null,
      };
    }

    const base = (req?.headers?.origin as string) || process.env.FRONTEND_URL || 'https://t1n9.xyz';
    return {
      shareCode: shareLink.shareCode,
      shareUrl: `${base}/share/${shareLink.shareCode}`,
      createdAt: shareLink.createdAt,
      updatedAt: shareLink.updatedAt,
    };
  }

  @Delete()
  @ApiOperation({ summary: '禁用当前用户的分享链接' })
  async disableShareLink(@Request() req: any) {
    const userId = req.user.id;
    await this.shareLinkService.disableShareLink(userId);
    return { message: '分享链接已禁用' };
  }
}
