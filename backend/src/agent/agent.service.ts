import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AgentToolsService, AGENT_TOOLS } from './agent-tools.service';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

// 只读工具，不需要确认
const READ_ONLY_TOOLS = new Set([
  'get_today_summary',
  'get_tasks',
  'get_pomodoro_status',
  'get_today_expenses',
  'get_exercise_types',
  'get_today_exercise',
]);

const TOOL_LABELS: Record<string, string> = {
  start_day: '开启今日',
  create_task: '创建任务',
  complete_task: '完成任务',
  start_pomodoro: '开启番茄钟',
  stop_pomodoro: '停止番茄钟',
  record_meal_expense: '记录餐饮花费',
  record_other_expense: '记录其他花费',
  record_exercise: '记录运动',
  set_exercise_feeling: '记录运动感受',
  update_important_info: '更新重要信息',
  update_day_reflection: '更新今日复盘',
};

const SYSTEM_PROMPT = `你是 LifeTracker 的专属助手，只服务于本网站的功能，帮助用户管理每日学习和生活。

【你能做的事】
- 开启今天（设置今日计划）
- 创建和管理任务
- 开启/停止番茄钟（支持关联任务）
- 记录花费（餐饮和其他消费）
- 记录运动数据和运动感受
- 更新重要信息/公告
- 查看今日概况
- 写今日复盘
- 回应简单的问候和闲聊（"你好"、"今天怎么样"等）

【你不能做的事 - 遇到以下请求必须拒绝】
- 编写任何代码或程序
- 提供专业建议（法律、医疗、心理、财务、学术论文等）
- 撰写长篇文章、报告、作文、邮件草稿
- 回答与本网站无关的知识性、技术性问题
- 执行任何与生活记录无关的复杂任务

拒绝时，用一句话说明原因并引导用户使用本网站功能，例如："抱歉，我只能帮你管理 LifeTracker 中的学习和生活记录，无法提供代码编写/专业建议。你有什么需要记录的吗？"

【操作规则】
1. 用中文回复，简洁友好
2. 如果用户一句话包含多个操作，依次执行所有操作
3. 执行完操作后，根据工具返回的实际结果来总结，不要编造结果。如果工具返回了错误，如实告知用户
4. 番茄钟：如果用户提到了要学习/做某个任务，用 start_pomodoro 的 taskName 参数关联任务
5. 运动感受：用户说"运动感觉很棒/不错/一般/累了"时，调用 set_exercise_feeling，不要调用 update_day_reflection
6. 重要信息：用户说"添加重要信息"、"记一下重要的事"时，调用 update_important_info，不要创建任务
7. 今日复盘：仅在用户明确说"写复盘"、"总结今天"时才调用 update_day_reflection
8. 记录花费时，注意区分餐饮（早餐/午餐/晚餐用 record_meal_expense）和其他花费（用 record_other_expense）
9. 番茄钟默认25分钟，用户可以指定时长`;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private agentToolsService: AgentToolsService,
  ) {}

  /**
   * 获取历史消息（分页，往上翻加载更多）
   */
  async getMessages(userId: string, cursor?: string, limit = 30) {
    const where: any = { userId };
    if (cursor) {
      where.createdAt = { lt: (await this.prisma.agentMessage.findUnique({ where: { id: cursor } }))?.createdAt };
    }

    const messages = await this.prisma.agentMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      messages: messages.reverse(), // 返回时正序
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[0].id : null,
    };
  }

  /**
   * 主聊天接口
   */
  async chat(userId: string, message: string, confirmMode: boolean) {
    // 保存用户消息
    await this.prisma.agentMessage.create({
      data: { userId, role: 'user', content: message },
    });

    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL', 'GLM-4-Flash');
    const timeout = this.configService.get<number>('AI_TIMEOUT', 30000);

    if (!apiUrl || !apiKey) {
      throw new Error('AI_API_URL and AI_API_KEY must be configured');
    }

    // 从 DB 加载最近的对话作为 LLM 上下文
    const llmContext = await this.buildLLMContext(userId);
    const llmMessages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...llmContext,
    ];

    const toolResults: any[] = [];
    // 确认模式下收集所有写操作，最后统一返回
    const pendingWriteOps: Array<{ id: string; name: string; args: any }> = [];

    // 循环处理 tool calls
    let maxRounds = 8;
    while (maxRounds-- > 0) {
      const response = await axios.post(
        apiUrl,
        { model, messages: llmMessages, tools: AGENT_TOOLS, tool_choice: 'auto' },
        {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout,
        },
      );

      const assistantMsg = response.data.choices[0].message;
      llmMessages.push(assistantMsg);

      // 没有 tool_calls → 最终回复
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        // 确认模式下如果有待确认操作，忽略最终文字回复，直接返回确认列表
        if (confirmMode && pendingWriteOps.length > 0) {
          break;
        }
        const saved = await this.prisma.agentMessage.create({
          data: {
            userId,
            role: 'assistant',
            content: assistantMsg.content || '',
            toolCalls: toolResults.length > 0 ? toolResults : undefined,
          },
        });
        return { id: saved.id, reply: assistantMsg.content || '', toolResults, type: 'reply' };
      }

      // 解析 tool calls
      const parsedCalls = assistantMsg.tool_calls.map((tc: any) => {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
        return { id: tc.id, name: tc.function.name, args };
      });

      // 逐个处理：只读工具立即执行，写工具根据模式处理
      for (const call of parsedCalls) {
        const isReadOnly = READ_ONLY_TOOLS.has(call.name);

        if (!confirmMode || isReadOnly) {
          // 直接执行
          this.logger.log(`Executing tool: ${call.name} args: ${JSON.stringify(call.args)}`);
          let result: any;
          try {
            result = await this.agentToolsService.executeTool(userId, call.name, call.args);
          } catch (error) {
            result = { error: error.message || 'Tool execution failed' };
          }
          toolResults.push({ tool: call.name, args: call.args, result });
          llmMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: call.id });
        } else {
          // 确认模式下，写操作加入待确认队列
          // 给 LLM 一个占位结果，让它可以继续规划后续操作
          pendingWriteOps.push(call);
          llmMessages.push({
            role: 'tool',
            content: JSON.stringify({ status: 'pending_user_confirmation' }),
            tool_call_id: call.id,
          });
        }
      }
    }

    // 确认模式：为每个写操作创建独立的确认消息
    if (confirmMode && pendingWriteOps.length > 0) {
      const confirms: Array<{ id: string; summary: string; action: any }> = [];
      for (const op of pendingWriteOps) {
        const label = TOOL_LABELS[op.name] || op.name;
        const detail = this.formatToolArgs(op.name, op.args);
        const summary = `${label}：${detail}`;

        const saved = await this.prisma.agentMessage.create({
          data: {
            userId,
            role: 'confirm',
            content: summary,
            pendingAction: { toolCall: op },
            confirmed: null,
          },
        });
        confirms.push({ id: saved.id, summary, action: op });
      }
      return { type: 'confirms', confirms };
    }

    const saved = await this.prisma.agentMessage.create({
      data: { userId, role: 'assistant', content: '操作完成，但处理轮次过多，请简化你的请求。' },
    });
    return { id: saved.id, reply: '操作完成，但处理轮次过多，请简化你的请求。', toolResults, type: 'reply' };
  }

  /**
   * 确认执行单个待定操作
   */
  async confirmAction(userId: string, messageId: string) {
    const msg = await this.prisma.agentMessage.findFirst({
      where: { id: messageId, userId, role: 'confirm', confirmed: null },
    });
    if (!msg || !msg.pendingAction) {
      throw new Error('没有找到待确认的操作');
    }

    const pending = msg.pendingAction as any;
    const call = pending.toolCall;

    this.logger.log(`Confirmed executing: ${call.name} args: ${JSON.stringify(call.args)}`);
    let result: any;
    try {
      result = await this.agentToolsService.executeTool(userId, call.name, call.args);
    } catch (error) {
      result = { error: error.message || 'Tool execution failed' };
    }

    // 标记为已确认
    await this.prisma.agentMessage.update({
      where: { id: messageId },
      data: { confirmed: true },
    });

    const toolResults = [{ tool: call.name, args: call.args, result }];
    const label = TOOL_LABELS[call.name] || call.name;
    const reply = result.error ? `执行失败：${result.error}` : `已完成：${label}`;

    const saved = await this.prisma.agentMessage.create({
      data: { userId, role: 'assistant', content: reply, toolCalls: toolResults },
    });
    return { id: saved.id, reply, toolResults, type: 'reply' };
  }

  /**
   * 拒绝待定操作
   */
  async rejectAction(userId: string, messageId: string) {
    const msg = await this.prisma.agentMessage.findFirst({
      where: { id: messageId, userId, role: 'confirm', confirmed: null },
    });
    if (!msg) {
      throw new Error('没有找到待确认的操作');
    }

    const pending = msg.pendingAction as any;
    const call = pending?.toolCall;
    const label = call ? (TOOL_LABELS[call.name] || call.name) : '操作';

    await this.prisma.agentMessage.update({
      where: { id: messageId },
      data: { confirmed: false },
    });

    const saved = await this.prisma.agentMessage.create({
      data: { userId, role: 'assistant', content: `已取消：${label}` },
    });

    return { id: saved.id, reply: `已取消：${label}`, type: 'reply' };
  }

  /**
   * 从 DB 加载最近的对话构建 LLM 上下文
   */
  private async buildLLMContext(userId: string): Promise<LLMMessage[]> {
    const recentMessages = await this.prisma.agentMessage.findMany({
      where: {
        userId,
        role: { in: ['user', 'assistant'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return recentMessages.reverse().map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  /**
   * 格式化工具参数为人类可读文本
   */
  private formatToolArgs(toolName: string, args: Record<string, any>): string {
    switch (toolName) {
      case 'start_day':
        return `"${args.dayStart}"${args.wakeUpTime ? ` (起床 ${args.wakeUpTime})` : ''}`;
      case 'create_task':
        return `"${args.title}"${args.subject ? ` [${args.subject}]` : ''}${args.estimatedHours ? ` 预估${args.estimatedHours}h` : ''}`;
      case 'complete_task':
        return `任务ID ${args.taskId}`;
      case 'start_pomodoro':
        return `${args.duration || 25}分钟${args.taskName ? ` (关联: ${args.taskName})` : ''}`;
      case 'stop_pomodoro':
        return '停止当前番茄钟';
      case 'record_meal_expense': {
        const labels: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
        return `${labels[args.category] || args.category} ${args.amount}元`;
      }
      case 'record_other_expense':
        return `${args.description} ${args.amount}元`;
      case 'record_exercise':
        return `${args.exerciseName} ${args.value}`;
      case 'set_exercise_feeling': {
        const feelings: Record<string, string> = { excellent: '非常棒', good: '不错', normal: '一般', tired: '疲惫' };
        return feelings[args.feeling] || args.feeling;
      }
      case 'update_important_info':
        return `"${args.content}"`;
      case 'update_day_reflection':
        return `"${args.dayReflection}"`;
      default:
        return JSON.stringify(args);
    }
  }

  /**
   * 清空历史
   */
  async clearHistory(userId: string) {
    await this.prisma.agentMessage.deleteMany({ where: { userId } });
    return { message: '会话历史已清除' };
  }
}
