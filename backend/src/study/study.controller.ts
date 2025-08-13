import { Controller, Get, Post, Delete, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StudyService } from './study.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateStudyRecordDto, CreatePomodoroSessionDto } from './dto/create-study.dto';

@ApiTags('学习')
@Controller('study')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Get('stats')
  @ApiOperation({ summary: '获取学习统计' })
  getStudyStats(@Request() req) {
    return this.studyService.getStudyStats(req.user.id);
  }

  @Get('daily')
  @ApiOperation({ summary: '获取每日学习数据' })
  @ApiQuery({ name: 'date', required: false, description: '日期 (YYYY-MM-DD)' })
  getDailyData(@Request() req, @Query('date') date?: string) {
    return this.studyService.getDailyData(req.user.id, date);
  }

  @Get('records')
  @ApiOperation({ summary: '获取学习记录' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量' })
  getStudyRecords(@Request() req, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.studyService.getRecentStudyRecords(req.user.id, limitNum);
  }

  @Get('pomodoro')
  @ApiOperation({ summary: '获取番茄钟会话' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量' })
  getPomodoroSessions(@Request() req, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.studyService.getPomodoroSessions(req.user.id, limitNum);
  }

  @Post('records')
  @ApiOperation({ summary: '创建学习记录' })
  createStudyRecord(@Request() req, @Body() createStudyRecordDto: CreateStudyRecordDto) {
    return this.studyService.createStudyRecord(req.user.id, createStudyRecordDto);
  }

  @Post('pomodoro')
  @ApiOperation({ summary: '创建番茄钟会话' })
  createPomodoroSession(@Request() req, @Body() createPomodoroSessionDto: CreatePomodoroSessionDto) {
    return this.studyService.createPomodoroSession(req.user.id, createPomodoroSessionDto);
  }

  @Delete('records/:id')
  @ApiOperation({ summary: '删除学习记录' })
  deleteStudyRecord(@Request() req, @Param('id') id: string) {
    return this.studyService.deleteStudyRecord(req.user.id, id);
  }

  @Get('today')
  @ApiOperation({ summary: '获取今日学习统计' })
  async getTodayStats(@Request() req) {
    const timezone = req.user.timezone || 'Asia/Shanghai';
    return this.studyService.getTodayStats(req.user.id, timezone);
  }
}
