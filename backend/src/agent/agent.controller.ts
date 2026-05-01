import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
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

  @Get('runs')
  async getRuns(@Req() req, @Query('limit') limit?: string) {
    return this.agentService.getRuns(req.user.id, limit ? parseInt(limit, 10) : 20);
  }

  @Get('runs/:id')
  async getRun(@Req() req, @Param('id') runId: string) {
    return this.agentService.getRun(req.user.id, runId);
  }

  @Get('runs/:id/steps')
  async getRunSteps(@Req() req, @Param('id') runId: string) {
    return this.agentService.getRunSteps(req.user.id, runId);
  }

  @Get('confirmations')
  async getConfirmations(
    @Req() req,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agentService.getConfirmations(req.user.id, status || 'pending', limit ? parseInt(limit, 10) : 20);
  }

  @Get('memories')
  async getMemories(@Req() req) {
    return this.agentService.getMemories(req.user.id);
  }

  @Post('memories')
  async createMemory(
    @Req() req,
    @Body('type') type: string,
    @Body('content') content: string,
  ) {
    return this.agentService.createMemory(req.user.id, type, content);
  }

  @Patch('memories/:id')
  async updateMemory(
    @Req() req,
    @Param('id') memoryId: string,
    @Body('type') type?: string,
    @Body('content') content?: string,
    @Body('status') status?: string,
  ) {
    return this.agentService.updateMemory(req.user.id, memoryId, { type, content, status });
  }

  @Delete('memories/:id')
  async deleteMemory(@Req() req, @Param('id') memoryId: string) {
    return this.agentService.deleteMemory(req.user.id, memoryId);
  }

  @Get('profile')
  async getProfile(@Req() req) {
    return this.agentService.getProfile(req.user.id);
  }

  @Post('profile/rebuild')
  async rebuildProfile(@Req() req) {
    return this.agentService.rebuildProfile(req.user.id);
  }

  @Patch('profile')
  async updateProfile(
    @Req() req,
    @Body('summary') summary?: string | null,
    @Body('goals') goals?: unknown,
    @Body('preferences') preferences?: unknown,
    @Body('routines') routines?: unknown,
    @Body('constraints') constraints?: unknown,
  ) {
    return this.agentService.updateProfile(req.user.id, {
      summary,
      goals,
      preferences,
      routines,
      constraints,
    });
  }

  @Post('chat')
  async chat(
    @Req() req,
    @Body('message') message: string,
    @Body('confirmMode') confirmMode: boolean,
  ) {
    return this.agentService.chat(req.user.id, message, confirmMode ?? true);
  }

  @Get('suggestions/empty-state')
  async getEmptyStateSuggestions(@Req() req) {
    return { suggestions: await this.agentService.getEmptyStateSuggestions(req.user.id) };
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
      suggestions: Array<{ label: string; send: string; hint?: string }> = [],
    ) => {
      const content = String(text || '');
      writeEvent({ type: 'reply_start', id: messageId });

      // 逐字符流式输出，模拟真实打字效果
      for (let index = 0; index < content.length; index++) {
        const char = content[index];
        writeEvent({ type: 'reply_delta', id: messageId, chunk: char });
        if (index % (1 + Math.floor(Math.random() * 3)) === 0) {
          await new Promise((resolve) => setTimeout(resolve, 5 + Math.random() * 10));
        }
      }

      writeEvent({ type: 'reply_done', id: messageId, toolResults, suggestions });
    };

    let progressTimer: NodeJS.Timeout | null = null;

    try {
      writeEvent({ type: 'start' });

      const progressMessages = [
        "正在理解你的输入...",
        "正在读取今天的上下文...",
        "正在判断是否需要调用工具...",
        "正在整理可确认的操作..."
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
        await streamReply(result.reply || '', result.id, result.toolResults || [], result.suggestions || []);
      } else if (result.type === 'confirms') {
        if (result.previewReply) {
          await streamReply(String(result.previewReply), result.previewMessageId || `preview-${Date.now()}`, []);
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

  @Post('confirmations/:id/approve')
  async approveConfirmation(@Req() req, @Param('id') confirmationId: string) {
    return this.agentService.confirmAction(req.user.id, confirmationId);
  }

  @Post('reject')
  async reject(@Req() req, @Body('messageId') messageId: string) {
    return this.agentService.rejectAction(req.user.id, messageId);
  }

  @Post('confirmations/:id/reject')
  async rejectConfirmation(@Req() req, @Param('id') confirmationId: string) {
    return this.agentService.rejectAction(req.user.id, confirmationId);
  }

  @Post('confirmations/:id/retry')
  async retryConfirmation(@Req() req, @Param('id') confirmationId: string) {
    return this.agentService.retryConfirmation(req.user.id, confirmationId);
  }

  @Post('proactive')
  async proactive(
    @Req() req,
    @Body('trigger') trigger: string,
    @Body('context') context?: { taskId?: string; taskTitle?: string; pomodoroCount?: number },
  ) {
    return this.agentService.handleProactive(req.user.id, trigger, context);
  }

  @Post('proactive/stream')
  async proactiveStream(
    @Req() req,
    @Res() res: Response,
    @Body('trigger') trigger: string,
    @Body('context') context?: { taskId?: string; taskTitle?: string; pomodoroCount?: number },
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

    const streamReply = async (text: string, messageId: string) => {
      const content = String(text || '');
      const chunkSize = 20;
      writeEvent({ type: 'reply_start', id: messageId });

      for (let index = 0; index < content.length; index += chunkSize) {
        writeEvent({ type: 'reply_delta', id: messageId, chunk: content.slice(index, index + chunkSize) });
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      writeEvent({ type: 'reply_done', id: messageId });
    };

    try {
      writeEvent({ type: 'start' });
      writeEvent({ type: 'progress', text: '正在感知你的状态...' });

      let messageId: string | null = null;
      let firstToken = true;

      const result: any = await this.agentService.handleProactiveStream(
        req.user.id,
        trigger,
        context,
        {
          onStart: (id: string) => {
            messageId = id;
          },
          onToken: (token: string) => {
            if (firstToken) {
              writeEvent({ type: 'progress_done' });
              writeEvent({ type: 'reply_start', id: messageId! });
              firstToken = false;
            }
            writeEvent({ type: 'reply_delta', id: messageId!, chunk: token });
          },
        },
      );

      if (messageId) {
        writeEvent({ type: 'reply_done', id: messageId });
      }
    } catch (error) {
      writeEvent({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      writeEvent({ type: 'end' });
      res.end();
    }
  }

  @Delete('history')
  clearHistory(@Req() req) {
    return this.agentService.clearHistory(req.user.id);
  }
}
