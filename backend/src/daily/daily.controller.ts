import { Controller, Get, Post, Put, Delete, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DailyService } from './daily.service';
import { UpdateDayStartDto, UpdateDayReflectionDto } from './dto/update-daily.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('每日数据')
@Controller('daily')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DailyController {
  constructor(private readonly dailyService: DailyService) {}

  @Get()
  @ApiOperation({ summary: '获取每日数据' })
  @ApiQuery({ name: 'date', required: false, description: '日期 (YYYY-MM-DD)' })
  async getDailyData(@Request() req, @Query('date') date?: string) {
    return this.dailyService.getDailyData(req.user.id, date);
  }

  @Get('status')
  @ApiOperation({ summary: '获取今日开启和复盘状态' })
  async getTodayStatus(@Request() req) {
    return this.dailyService.getTodayStatus(req.user.id);
  }

  @Put('start')
  @ApiOperation({ summary: '更新开启内容' })
  async updateDayStart(@Request() req, @Body() updateDayStartDto: UpdateDayStartDto) {
    return this.dailyService.updateDayStart(req.user.id, updateDayStartDto);
  }

  @Put('reflection')
  @ApiOperation({ summary: '更新复盘内容' })
  async updateDayReflection(@Request() req, @Body() updateDayReflectionDto: UpdateDayReflectionDto) {
    return this.dailyService.updateDayReflection(req.user.id, updateDayReflectionDto);
  }

  @Delete('start')
  @ApiOperation({ summary: '清除开启内容' })
  @ApiQuery({ name: 'date', required: false, description: '日期 (YYYY-MM-DD)' })
  async clearDayStart(@Request() req, @Query('date') date?: string) {
    return this.dailyService.clearDayStart(req.user.id, date);
  }

  @Delete('reflection')
  @ApiOperation({ summary: '清除复盘内容' })
  @ApiQuery({ name: 'date', required: false, description: '日期 (YYYY-MM-DD)' })
  async clearDayReflection(@Request() req, @Query('date') date?: string) {
    return this.dailyService.clearDayReflection(req.user.id, date);
  }
}
