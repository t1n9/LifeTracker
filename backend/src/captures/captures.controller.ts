import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCaptureDto } from './dto/create-capture.dto';
import { CapturesService } from './captures.service';

@ApiTags('captures')
@Controller('captures')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CapturesController {
  constructor(private readonly capturesService: CapturesService) {}

  @Get()
  @ApiOperation({ summary: '获取最近记录' })
  list(@Req() req: any, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.capturesService.list(req.user.id, Number.isNaN(parsedLimit) ? 20 : parsedLimit);
  }

  @Post()
  @ApiOperation({ summary: '创建一条原始记录' })
  create(@Req() req: any, @Body() dto: CreateCaptureDto) {
    return this.capturesService.create(req.user.id, dto.content);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: '整理一条记录' })
  analyze(@Req() req: any, @Param('id') id: string) {
    return this.capturesService.analyze(req.user.id, id);
  }
}
