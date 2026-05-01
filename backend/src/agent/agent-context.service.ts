import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

const READ_ONLY_TOOLS = new Set([
  'get_today_summary',
  'get_today_tasks',
  'get_tasks',
  'get_pomodoro_status',
  'get_today_expenses',
  'get_today_exercise',
]);

interface AgentMessageRecord {
  role: string;
  content: string;
  toolCalls?: unknown;
}

@Injectable()
export class AgentContextService {
  constructor(private prisma: PrismaService) {}

  async buildShortTermContext(userId: string) {
    const [conversationMessages, toolResultMessages] = await Promise.all([
      this.prisma.agentMessage.findMany({
        where: {
          userId,
          role: { in: ['user', 'assistant'] },
          // 排除主动推送消息，避免 LLM 把旧对话重新当成指令
          NOT: { toolCalls: { path: ['proactive'], equals: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 14,
      }),
      this.prisma.agentMessage.findMany({
        where: {
          userId,
          OR: [
            { role: 'action_result' },
            {
              role: 'assistant',
              NOT: { toolCalls: { equals: undefined } },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    const messages = conversationMessages
      .filter((message) => !this.isInternalExecutionEcho(message))
      .reverse()
      .map((message): LLMMessage => {
        if (message.role !== 'assistant') {
          return { role: 'user', content: this.compactText(message.content) };
        }
        // 把该轮执行过的写操作附加到 assistant 消息里，让 LLM 知道自己上轮做了什么
        const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
        const writeOps = (toolCalls as Array<{ tool?: string; args?: any; result?: any }>)
          .filter(tc => tc.tool && !READ_ONLY_TOOLS.has(tc.tool))
          .map(tc => this.summarizeToolCall(tc))
          .filter(Boolean);
        const content = this.compactText(message.content);
        return {
          role: 'assistant',
          content: writeOps.length > 0 ? `${content}\n[本轮已执行：${writeOps.join('；')}]` : content,
        };
      });

    const toolSummary = this.buildToolSummary(toolResultMessages.reverse());

    return {
      messages,
      toolSummary,
      stats: {
        conversationMessageCount: messages.length,
        toolResultMessageCount: toolResultMessages.length,
        hasToolSummary: Boolean(toolSummary),
      },
    };
  }

  private buildToolSummary(messages: AgentMessageRecord[]) {
    const lines: string[] = [];

    for (const message of messages) {
      const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
      for (const toolCall of toolCalls as Array<{ tool?: string; args?: any; result?: any }>) {
        if (!toolCall.tool || !READ_ONLY_TOOLS.has(toolCall.tool)) {
          continue;
        }
        const line = this.summarizeToolCall(toolCall);
        if (line) {
          lines.push(line);
        }
      }
    }

    if (lines.length === 0) {
      return '';
    }

    return [
      '【历史操作记录 — 仅供理解对话背景，严禁将其中的数据用于当前请求】',
      '以下是你过去已经执行过的操作，仅用于理解对话上下文。',
      '绝对不要把这里的任务名、金额、内容等照搬到当前用户请求中。用户当前说了什么就用什么。',
      ...lines.slice(-12).map((line) => `- [历史] ${line}`),
    ].join('\n');
  }

  private summarizeToolCall(toolCall: { tool?: string; args?: any; result?: any }) {
    const tool = toolCall.tool;
    const args = toolCall.args || {};
    const result = toolCall.result || {};

    if (result?.error) {
      return `${tool}: 执行失败，${result.error}`;
    }

    switch (tool) {
      case 'get_today_tasks':
        return `查询今日任务：${Array.isArray(result) ? result.length : 0} 条`;
      case 'start_day':
        return `开启今日：${result.dayStart ?? args.dayStart ?? ''}`;
      case 'create_task':
        return `创建任务：${result.title ?? args.title ?? ''}`;
      case 'create_tasks': {
        const created = Array.isArray(result.created) ? result.created.map((task: any) => task.title).filter(Boolean) : [];
        const skipped = Array.isArray(result.skipped) ? result.skipped.map((task: any) => task.title).filter(Boolean) : [];
        return `批量创建任务：新增 ${created.join('、') || '无'}；跳过 ${skipped.join('、') || '无'}`;
      }
      case 'create_and_complete_task':
        return `创建并完成任务：${result.title ?? args.title ?? ''}`;
      case 'complete_task':
        return `完成任务：${result.title ?? args.taskTitle ?? args.taskName ?? ''}`;
      case 'start_pomodoro':
        return `开启番茄钟：${args.duration || result.session?.duration || 25} 分钟，任务 ${result.boundTaskTitle ?? args.taskTitle ?? args.taskName ?? '未绑定'}`;
      case 'stop_pomodoro':
        return '停止当前番茄钟';
      case 'record_meal_expense':
        return `记录餐饮花费：${args.category ?? ''} ${args.amount ?? ''}`;
      case 'record_other_expense':
        return `记录其他花费：${args.description ?? ''} ${args.amount ?? ''}`;
      case 'record_exercise':
        return `记录运动：${args.exerciseName ?? ''} ${args.value ?? ''}`;
      case 'set_exercise_feeling':
        return `记录运动感受：${args.feeling ?? ''}`;
      case 'update_important_info':
        return `更新重要信息：${this.compactText(args.content ?? '', 80)}`;
      case 'update_day_reflection':
        return `更新今日复盘：${this.compactText(args.dayReflection ?? '', 80)}`;
      default:
        return tool ? `${tool}: ${this.compactText(JSON.stringify(args), 120)}` : '';
    }
  }

  private compactText(value: unknown, maxLength = 500) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  private isInternalExecutionEcho(message: AgentMessageRecord) {
    if (message.role !== 'assistant') {
      return false;
    }

    if (Array.isArray(message.toolCalls) && message.toolCalls.length > 0) {
      return false;
    }

    const normalizedContent = String(message.content || '').trim();
    return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu.test(normalizedContent)
      && /[\r\n]/u.test(normalizedContent);
  }
}
