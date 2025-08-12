import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PomodoroService } from './pomodoro.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StartPomodoroDto } from '../study/dto/create-study.dto';

@ApiTags('番茄时钟')
@Controller('pomodoro')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PomodoroController {
  constructor(private readonly pomodoroService: PomodoroService) {}

  @Post('start')
  @ApiOperation({ summary: '启动番茄钟' })
  async startPomodoro(@Request() req, @Body() startPomodoroDto: StartPomodoroDto) {
    return this.pomodoroService.startPomodoro(req.user.id, startPomodoroDto);
  }

  @Post('pause/:sessionId')
  @ApiOperation({ summary: '暂停番茄钟' })
  @ApiParam({ name: 'sessionId', description: '会话ID' })
  async pausePomodoro(@Param('sessionId') sessionId: string) {
    return this.pomodoroService.pausePomodoro(sessionId);
  }

  @Post('resume/:sessionId')
  @ApiOperation({ summary: '恢复番茄钟' })
  @ApiParam({ name: 'sessionId', description: '会话ID' })
  async resumePomodoro(@Param('sessionId') sessionId: string) {
    return this.pomodoroService.resumePomodoro(sessionId);
  }

  @Post('stop/:sessionId')
  @ApiOperation({ summary: '停止番茄钟' })
  @ApiParam({ name: 'sessionId', description: '会话ID' })
  async stopPomodoro(@Param('sessionId') sessionId: string) {
    return this.pomodoroService.stopPomodoro(sessionId);
  }

  @Get('status/:sessionId')
  @ApiOperation({ summary: '获取番茄钟状态' })
  @ApiParam({ name: 'sessionId', description: '会话ID' })
  async getPomodoroStatus(@Param('sessionId') sessionId: string) {
    return this.pomodoroService.getPomodoroStatus(sessionId);
  }

  @Get('active')
  @ApiOperation({ summary: '获取当前用户的活跃番茄钟会话' })
  async getActiveSession(@Request() req) {
    return this.pomodoroService.getActiveSession(req.user.id);
  }

  @Get('sessions')
  @ApiOperation({ summary: '获取所有活跃番茄钟会话（管理用）' })
  async getAllSessions() {
    return this.pomodoroService.getAllActiveSessions();
  }

  @Post('sync/:sessionId')
  @ApiOperation({ summary: '强制同步特定会话' })
  @ApiParam({ name: 'sessionId', description: '会话ID' })
  async forceSyncSession(@Param('sessionId') sessionId: string) {
    return this.pomodoroService.forceSyncSession(sessionId);
  }

  @Get('health')
  @ApiOperation({ summary: '番茄时钟服务健康检查' })
  async checkHealth() {
    return this.pomodoroService.checkHealth();
  }
}
