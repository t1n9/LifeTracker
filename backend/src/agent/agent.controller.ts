import { Controller, Post, Get, Delete, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgentService } from './agent.service';

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private agentService: AgentService) {}

  @Get('messages')
  async getMessages(
    @Req() req,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agentService.getMessages(req.user.id, cursor, limit ? parseInt(limit) : 30);
  }

  @Post('chat')
  async chat(
    @Req() req,
    @Body('message') message: string,
    @Body('confirmMode') confirmMode: boolean,
  ) {
    return this.agentService.chat(req.user.id, message, confirmMode ?? true);
  }

  @Post('confirm')
  async confirm(@Req() req, @Body('messageId') messageId: string) {
    return this.agentService.confirmAction(req.user.id, messageId);
  }

  @Post('reject')
  async reject(@Req() req, @Body('messageId') messageId: string) {
    return this.agentService.rejectAction(req.user.id, messageId);
  }

  @Delete('history')
  clearHistory(@Req() req) {
    return this.agentService.clearHistory(req.user.id);
  }
}
