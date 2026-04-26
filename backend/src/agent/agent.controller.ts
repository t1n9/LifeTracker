import { Controller, Post, Get, Delete, Body, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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
    return this.agentService.getMessages(req.user.id, cursor, limit ? parseInt(limit, 10) : 30);
  }

  @Post('chat')
  async chat(
    @Req() req,
    @Body('message') message: string,
    @Body('confirmMode') confirmMode: boolean,
  ) {
    return this.agentService.chat(req.user.id, message, confirmMode ?? true);
  }

  @Post('chat/stream')
  async chatStream(
    @Req() req,
    @Res() res: Response,
    @Body('message') message: string,
    @Body('confirmMode') confirmMode: boolean,
  ) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const writeEvent = (event: Record<string, any>) => {
      res.write(`${JSON.stringify(event)}\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };

    const streamReply = async (
      text: string,
      messageId: string,
      toolResults: Array<{ tool: string; args?: any; result?: any }>,
    ) => {
      const content = String(text || '');
      const chunkSize = 20;
      writeEvent({ type: 'reply_start', id: messageId });

      for (let index = 0; index < content.length; index += chunkSize) {
        const chunk = content.slice(index, index + chunkSize);
        writeEvent({ type: 'reply_delta', id: messageId, chunk });
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      writeEvent({ type: 'reply_done', id: messageId, toolResults });
    };

    let progressTimer: NodeJS.Timeout | null = null;

    try {
      writeEvent({ type: 'start' });

      const progressMessages = [
        '正在理解你的输入...',
        '正在提取意图并检查上下文...',
        '正在规划本轮操作...',
        '正在准备确认卡片...',
      ];

      let progressIndex = 0;
      writeEvent({ type: 'progress', text: progressMessages[progressIndex] });
      progressTimer = setInterval(() => {
        progressIndex = Math.min(progressIndex + 1, progressMessages.length - 1);
        writeEvent({ type: 'progress', text: progressMessages[progressIndex] });
      }, 900);

      const result: any = await this.agentService.chat(req.user.id, message, confirmMode ?? true);

      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      writeEvent({ type: 'progress_done' });

      if (result.type === 'reply') {
        await streamReply(result.reply || '', result.id, result.toolResults || []);
      } else if (result.type === 'confirms') {
        if (result.previewReply) {
          await streamReply(String(result.previewReply), `preview-${Date.now()}`, []);
        }
        writeEvent({ type: 'confirms', confirms: result.confirms || [] });
      } else if (result.type === 'auto_write_applied') {
        writeEvent({ type: 'auto_write_applied', toolResults: result.toolResults || [] });
      } else {
        writeEvent({ type: 'unknown', payload: result });
      }
    } catch (error) {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }

      writeEvent({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      if (progressTimer) {
        clearInterval(progressTimer);
      }
      writeEvent({ type: 'end' });
      res.end();
    }
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
