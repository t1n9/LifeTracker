import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AgentToolsService, AGENT_TOOLS } from './agent-tools.service';
import { AgentMessageHints, extractAgentMessageHints } from './agent-intent.utils';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

// 只读工具，不需要确认
const READ_ONLY_TOOLS = new Set([
  'get_today_summary',
  'get_today_tasks',
  'get_tasks',
  'get_pomodoro_status',
  'get_today_expenses',
  'get_exercise_types',
  'get_today_exercise',
]);

const TOOL_LABELS: Record<string, string> = {
  start_day: '开启今日',
  create_task: '创建任务',
  create_tasks: '批量创建任务',
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

const EXERCISE_FEELING_LABELS: Record<string, string> = {
  excellent: '非常棒',
  good: '不错',
  normal: '一般',
  tired: '疲惫',
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
4. 起床时间要结构化：用户提到"7:30起床"这类信息时，必须把时间单独填到 start_day.wakeUpTime，不能把起床时间原文塞进 dayStart
5. 明确任务列表要拆开：用户说"今天任务是A+B+C"、"待办有..."时，这些是任务，不是单纯的 dayStart 文本。优先用 create_tasks，至少也要分别 create_task，不要整段塞进 start_day
6. 番茄钟必须优先关联真实任务：
   - 已知 taskId 时，用 start_pomodoro 的 taskId
   - 只有任务名时，先 get_tasks 找现有未完成任务
   - 如果用户要立即开始一个不存在的新任务，直接调用 start_pomodoro，并传 taskTitle + createTaskIfMissing=true，让工具自动创建并绑定
   - 如果一个任务名同时匹配多个未完成任务，必须先澄清，不要猜测绑定哪一个
7. 当一句话同时包含记录信息、建任务、开番茄时，按顺序执行：先记录事实，再准备任务，再开启番茄
8. 如果 start_pomodoro 没传 taskId，就不要只传模糊的自由文本然后期待前端自己显示；要么匹配到真实 taskId，要么让工具自动创建任务
9. 运动感受：用户说"运动感觉很棒/不错/一般/累了"时，调用 set_exercise_feeling，不要调用 update_day_reflection
10. 重要信息：用户说"添加重要信息"、"记一下重要的事"时，调用 update_important_info，不要创建任务
11. 今日复盘：仅在用户明确说"写复盘"、"总结今天"时才调用 update_day_reflection
12. 记录花费时，注意区分餐饮（早餐/午餐/晚餐用 record_meal_expense）和其他花费（用 record_other_expense）
13. 番茄钟默认25分钟，用户可以指定时长
14. 任务完成要走工具：用户说"资料分析任务完成"、"25.9福建事业单位完成了"、"这个任务做完了"这类话时，应调用 complete_task，不要把内部上下文或 UUID 原样回复给用户
15. 永远不要向用户展示内部上下文标记，例如"【已执行操作】"、"最近工具结果"这类文字

【关键示例】
- "今天早上7:30起床，今天任务是套卷+下午公差+晚上毕设"
  应拆成：start_day({ wakeUpTime: "07:30", dayStart: "今天要完成套卷、下午公差、晚上毕设" }) + create_tasks({ titles: ["套卷", "下午公差", "晚上毕设"] })
- "现在做福建事业单位试卷，开启2小时番茄"
  应先匹配未完成任务；如果没匹配到，就用 start_pomodoro({ duration: 120, taskTitle: "福建事业单位试卷", createTaskIfMissing: true })
- "今天跑了3公里，状态非常棒。现在想做一套福建事业单位的试卷，帮我开启2小时的番茄"
  应先记录运动，再记录运动感受，再为番茄准备任务并开启番茄
- "资料分析任务完成"
  应匹配现有未完成任务后调用 complete_task({ taskTitle: "资料分析" }) 或 complete_task({ taskId: "..." })
`;

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

    const messages = (await this.prisma.agentMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })).filter(message => !this.isInternalExecutionEcho(message.role, message.content, message.toolCalls));

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
    const messageHints = extractAgentMessageHints(message);
    const llmContext = await this.buildLLMContext(userId);
    const structuredGuidance = await this.buildStructuredGuidance(userId, message, messageHints);
    const llmMessages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(structuredGuidance ? [{ role: 'system' as const, content: structuredGuidance }] : []),
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
        const todayTasksFallback = await this.handleTodayTasksFallback(
          userId,
          message,
          messageHints,
          toolResults,
        );
        if (todayTasksFallback) {
          return todayTasksFallback;
        }
        const completionFallback = await this.handleDirectCompletionFallback(
          userId,
          message,
          confirmMode,
          messageHints,
          toolResults,
        );
        if (completionFallback) {
          return completionFallback;
        }
        if (this.shouldSuppressAutoReply(confirmMode, toolResults)) {
          return { type: 'auto_write_applied', toolResults };
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
        const detail = await this.formatToolArgs(userId, op.name, op.args);
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

    if (this.shouldSuppressAutoReply(confirmMode, toolResults)) {
      return { type: 'auto_write_applied', toolResults };
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

    const toolResults = [{ tool: call.name, args: call.args, result }];
    if (result?.error) {
      return {
        type: 'confirm_error',
        messageId,
        error: result.error,
      };
    }

    const label = TOOL_LABELS[call.name] || call.name;
    const detail = await this.formatToolArgs(userId, call.name, call.args, result);
    const summary = `${label}：${detail}`;

    await this.prisma.agentMessage.update({
      where: { id: messageId },
      data: {
        confirmed: true,
        content: summary,
        toolCalls: toolResults,
      },
    });

    return {
      id: messageId,
      messageId,
      summary,
      toolResults,
      confirmed: true,
      type: 'confirm_updated',
    };
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

    await this.prisma.agentMessage.update({
      where: { id: messageId },
      data: { confirmed: false },
    });

    return {
      id: messageId,
      messageId,
      summary: msg.content,
      confirmed: false,
      type: 'confirm_updated',
    };
  }

  /**
   * 从 DB 加载最近的对话构建 LLM 上下文
   */
  private async buildLLMContext(userId: string): Promise<LLMMessage[]> {
    const recentMessages = (await this.prisma.agentMessage.findMany({
      where: {
        userId,
        OR: [
          { role: { in: ['user', 'assistant'] } },
          { role: 'confirm', confirmed: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })).filter(message => !this.isInternalExecutionEcho(message.role, message.content, message.toolCalls));

    return recentMessages.reverse().flatMap((message) => {
      const contextMessages: LLMMessage[] = [];

      if (message.role === 'user') {
        contextMessages.push({
          role: 'user',
          content: message.content,
        });
      } else if (message.role === 'assistant') {
        contextMessages.push({
          role: 'assistant',
          content: message.content,
        });
      }

      const toolSummary = this.summarizeToolCallsForContext(message.toolCalls as Array<{ tool?: string; args?: any; result?: any }> | undefined);
      if (toolSummary) {
        contextMessages.push({
          role: 'assistant',
          content: `【最近工具结果】\n${toolSummary}`,
        });
      }

      return contextMessages;
    });
  }

  private async handleTodayTasksFallback(
    userId: string,
    message: string,
    hints: AgentMessageHints,
    toolResults: Array<{ tool: string; args?: any; result?: any }>,
  ) {
    if (!this.isSimpleTodayTasksQuery(message, hints)) {
      return null;
    }

    if (toolResults.some(({ tool, result }) => (
      (tool === 'get_today_tasks' || tool === 'get_today_summary') && !result?.error
    ))) {
      return null;
    }

    if (toolResults.some(({ tool }) => !['get_tasks', 'get_today_tasks', 'get_today_summary'].includes(tool))) {
      return null;
    }

    let result: any;
    try {
      result = await this.agentToolsService.executeTool(userId, 'get_today_tasks', {});
    } catch (error) {
      result = { error: error.message || 'Tool execution failed' };
    }

    const nextToolResults = [{ tool: 'get_today_tasks', args: {}, result }];
    if (result?.error) {
      return this.createAssistantReply(userId, result.error, nextToolResults);
    }

    return this.createAssistantReply(userId, this.formatTodayTasksReply(result), nextToolResults);
  }

  private isSimpleTodayTasksQuery(message: string, hints: AgentMessageHints) {
    if (
      hints.wakeUpTime
      || hints.explicitTaskTitles.length > 0
      || hints.completionTaskTitle
      || hints.pomodoro
      || hints.exerciseRecord
      || hints.exerciseFeeling
    ) {
      return false;
    }

    const normalized = message.replace(/\s+/gu, '');
    return /^(?:帮我|给我|麻烦|请)?(?:看|查|列出|展示|告诉我)?(?:一下|一眼)?(?:今天|今日)(?:的)?(?:任务|待办|安排|计划)(?:列表|情况)?$/u.test(normalized)
      || /^(?:今天|今日)(?:有什么|有啥|有哪些)(?:任务|待办|安排|计划)$/u.test(normalized);
  }

  private formatTodayTasksReply(tasks: Array<{ title?: string; isCompleted?: boolean }>) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return '今天还没有有效任务。';
    }

    const pendingCount = tasks.filter(task => !task?.isCompleted).length;
    const completedCount = tasks.length - pendingCount;
    const lines = tasks.map((task, index) => (
      `${index + 1}. [${task?.isCompleted ? '已完成' : '未完成'}] ${task?.title || '未命名任务'}`
    ));

    return `今天共有${tasks.length}个有效任务，${pendingCount}个未完成，${completedCount}个已完成。\n${lines.join('\n')}`;
  }

  private async handleDirectCompletionFallback(
    userId: string,
    message: string,
    confirmMode: boolean,
    hints: AgentMessageHints,
    toolResults: Array<{ tool: string; args?: any; result?: any }>,
  ) {
    if (!this.isSimpleCompletionMessage(message, hints)) {
      return null;
    }

    if (toolResults.some(({ tool, result }) => tool === 'complete_task' && !result?.error)) {
      return null;
    }

    const preview = await this.agentToolsService.previewCompleteTask(userId, {
      taskTitle: hints.completionTaskTitle,
    });

    if (preview.error) {
      return this.createAssistantReply(userId, preview.error, toolResults);
    }

    const taskTitle = preview.taskTitle || hints.completionTaskTitle;
    if (preview.alreadyCompleted) {
      return this.createAssistantReply(userId, `任务“${taskTitle}”已经是完成状态。`, toolResults);
    }

    if (!preview.taskId || !taskTitle) {
      return null;
    }

    const action = {
      id: `fallback-complete-${Date.now()}`,
      name: 'complete_task',
      args: {
        taskId: preview.taskId,
        taskTitle,
      },
    };

    if (confirmMode) {
      const summary = `完成任务："${taskTitle}"`;
      const saved = await this.prisma.agentMessage.create({
        data: {
          userId,
          role: 'confirm',
          content: summary,
          pendingAction: { toolCall: action },
          confirmed: null,
        },
      });

      return {
        type: 'confirms',
        confirms: [{ id: saved.id, summary, action }],
      };
    }

    let result: any;
    try {
      result = await this.agentToolsService.executeTool(userId, 'complete_task', action.args);
    } catch (error) {
      result = { error: error.message || 'Tool execution failed' };
    }

    const nextToolResults = [...toolResults, { tool: 'complete_task', args: action.args, result }];
    if (result?.error) {
      return this.createAssistantReply(userId, result.error, nextToolResults);
    }

    return { type: 'auto_write_applied', toolResults: nextToolResults };
  }

  private isSimpleCompletionMessage(message: string, hints: AgentMessageHints) {
    if (
      !hints.completionTaskTitle
      || hints.wakeUpTime
      || hints.explicitTaskTitles.length > 0
      || hints.pomodoro
      || hints.exerciseRecord
      || hints.exerciseFeeling
    ) {
      return false;
    }

    const normalized = message
      .replace(/\s+/gu, '')
      .replace(/[，,。！？!?；;：:“”"'`]/gu, '');
    const escapedTaskTitle = this.escapeRegExp(hints.completionTaskTitle.replace(/\s+/gu, ''));

    return new RegExp(
      `^(?:好(?:的)?|嗯|那|现在|已经|我把|把)?${escapedTaskTitle}(?:任务|待办)?(?:完成了|完成|做完了|搞定了|结束了)$`,
      'u',
    ).test(normalized);
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async createAssistantReply(
    userId: string,
    reply: string,
    toolResults: Array<{ tool: string; args?: any; result?: any }> = [],
  ) {
    const saved = await this.prisma.agentMessage.create({
      data: {
        userId,
        role: 'assistant',
        content: reply,
        toolCalls: toolResults.length > 0 ? toolResults : undefined,
      },
    });

    return { id: saved.id, reply, toolResults, type: 'reply' as const };
  }

  private async buildStructuredGuidance(userId: string, message: string, hints: AgentMessageHints = extractAgentMessageHints(message)) {
    const notes: string[] = [];

    if (hints.wakeUpTime) {
      notes.push(`检测到起床时间 ${hints.wakeUpTime}。调用 start_day 时必须把 wakeUpTime 设为这个值，不要把起床时间原文写进 dayStart。`);
    }

    if (this.isSimpleTodayTasksQuery(message, hints)) {
      notes.push('用户在查询今天的任务，应优先调用 get_today_tasks。get_tasks 只用于查询全部未完成任务或为其他操作匹配任务，不要把 get_tasks 的结果说成“今天的任务”。');
    }

    if (hints.explicitTaskTitles.length > 0) {
      const existingTaskTitles: string[] = [];
      const ambiguousTaskTitles: string[] = [];
      const missingTaskTitles: string[] = [];

      for (const title of hints.explicitTaskTitles) {
        const matched = await this.agentToolsService.resolvePendingTask(userId, title);
        if (matched.status === 'matched' && matched.match) {
          existingTaskTitles.push(`${title} -> 已有任务 "${matched.match.taskTitle}"`);
        } else if (matched.status === 'ambiguous') {
          ambiguousTaskTitles.push(`${title} -> 候选 ${matched.candidates.map(candidate => `"${candidate.taskTitle}"`).join('、')}`);
        } else {
          missingTaskTitles.push(title);
        }
      }

      notes.push(`检测到明确任务列表：${hints.explicitTaskTitles.join('、')}。这些是任务，不是单纯的 dayStart 文本。`);
      if (existingTaskTitles.length > 0) {
        notes.push(`其中已有未完成任务：${existingTaskTitles.join('；')}。不要重复创建。`);
      }
      if (ambiguousTaskTitles.length > 0) {
        notes.push(`其中有歧义的任务标题：${ambiguousTaskTitles.join('；')}。不要自动认成已有任务，必要时需要用户澄清。`);
      }
      if (missingTaskTitles.length > 0) {
        notes.push(`需要创建的新任务：${missingTaskTitles.join('、')}。优先使用 create_tasks。`);
      }
    }

    if (hints.completionTaskTitle) {
      const matched = await this.agentToolsService.resolvePendingTask(userId, hints.completionTaskTitle);
      if (matched.status === 'matched' && matched.match) {
        notes.push(`检测到任务完成意图："${hints.completionTaskTitle}"。应调用 complete_task，并优先传 taskId="${matched.match.taskId}"。`);
      } else if (matched.status === 'ambiguous') {
        notes.push(`完成任务目标 "${hints.completionTaskTitle}" 存在歧义，候选有：${matched.candidates.map(candidate => `"${candidate.taskTitle}"`).join('、')}。不要猜测完成哪一个，先让用户澄清。`);
      } else {
        notes.push(`检测到任务完成意图："${hints.completionTaskTitle}"。如果没有找到匹配的未完成任务，不要假装已完成，应明确告知用户未匹配到任务。`);
      }
    }

    if (hints.exerciseRecord) {
      notes.push(`检测到运动记录：${hints.exerciseRecord.exerciseName} ${hints.exerciseRecord.value}。优先调用 record_exercise，参数应为 exerciseName="${hints.exerciseRecord.exerciseName}"、value=${hints.exerciseRecord.value}。`);
    }

    if (hints.exerciseFeeling) {
      notes.push(`检测到运动感受：${EXERCISE_FEELING_LABELS[hints.exerciseFeeling] || hints.exerciseFeeling}。应调用 set_exercise_feeling({ feeling: "${hints.exerciseFeeling}" })，不要写进 update_day_reflection。`);
    }

    if (hints.pomodoro) {
      if (hints.exerciseRecord || hints.exerciseFeeling) {
        notes.push('这条消息同时包含运动记录和番茄意图，先记录运动信息，再处理任务和番茄。');
      }

      if (hints.pomodoro.durationMinutes) {
        notes.push(`检测到番茄时长：${hints.pomodoro.durationMinutes} 分钟。`);
      }

      if (hints.pomodoro.taskTitle) {
        const matched = await this.agentToolsService.resolvePendingTask(userId, hints.pomodoro.taskTitle);
        if (matched.status === 'matched' && matched.match) {
          notes.push(`番茄目标任务已匹配到未完成任务：taskId="${matched.match.taskId}"，title="${matched.match.taskTitle}"。调用 start_pomodoro 时优先传 taskId。`);
        } else if (matched.status === 'ambiguous') {
          notes.push(`番茄目标任务 "${hints.pomodoro.taskTitle}" 存在歧义，候选有：${matched.candidates.map(candidate => `"${candidate.taskTitle}"`).join('、')}。不要猜测绑定，优先向用户澄清。`);
        } else {
          notes.push(`番茄目标任务候选为 "${hints.pomodoro.taskTitle}"。如果当前没有匹配到未完成任务，不要先 create_task 等待返回 taskId；直接调用 start_pomodoro，并传 taskTitle="${hints.pomodoro.taskTitle}"、createTaskIfMissing=true。`);
        }
      }
    }

    if (notes.length === 0) {
      return null;
    }

    return `【本轮结构化解析提示】\n- ${notes.join('\n- ')}`;
  }

  private summarizeToolCallsForContext(toolCalls?: Array<{ tool?: string; args?: any; result?: any }>) {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return '';
    }

    return toolCalls.map((toolCall) => {
      switch (toolCall.tool) {
        case 'get_today_tasks':
          return `- get_today_tasks: count=${Array.isArray(toolCall.result) ? toolCall.result.length : 0}`;
        case 'start_day':
          return `- start_day: dayStart="${toolCall.result?.dayStart ?? toolCall.args?.dayStart ?? ''}" wakeUpTime="${toolCall.result?.wakeUpTime ?? toolCall.args?.wakeUpTime ?? ''}"`;
        case 'create_task':
          return `- create_task: "${toolCall.result?.title ?? toolCall.args?.title ?? ''}"`;
        case 'create_tasks':
          return `- create_tasks: created=${(toolCall.result?.created ?? []).map((task: any) => task.title).join('、') || '无'} skipped=${(toolCall.result?.skipped ?? []).map((task: any) => task.title).join('、') || '无'}`;
        case 'complete_task':
          return `- complete_task: "${toolCall.result?.title ?? toolCall.args?.taskId ?? ''}"`;
        case 'start_pomodoro':
          return `- start_pomodoro: duration=${toolCall.args?.duration || toolCall.result?.session?.duration || 25} task="${toolCall.result?.boundTaskTitle ?? toolCall.args?.taskTitle ?? toolCall.args?.taskName ?? ''}" taskId="${toolCall.result?.boundTaskId ?? toolCall.args?.taskId ?? ''}"`;
        case 'record_exercise':
          return `- record_exercise: ${toolCall.args?.exerciseName ?? ''} ${toolCall.args?.value ?? ''}`;
        case 'set_exercise_feeling':
          return `- set_exercise_feeling: ${toolCall.args?.feeling ?? ''}`;
        default:
          return `- ${toolCall.tool}: ${JSON.stringify(toolCall.args ?? {})}`;
      }
    }).join('\n');
  }

  /**
   * 格式化工具参数为人类可读文本
   */
  private async formatToolArgs(
    userId: string,
    toolName: string,
    args: Record<string, any>,
    result?: any,
  ): Promise<string> {
    switch (toolName) {
      case 'start_day':
        if (args.dayStart && args.wakeUpTime) {
          return `"${args.dayStart}" (起床 ${args.wakeUpTime})`;
        }
        if (args.dayStart) {
          return `"${args.dayStart}"`;
        }
        return args.wakeUpTime ? `起床 ${args.wakeUpTime}` : '{}';
      case 'create_task':
        return `"${args.title}"${args.subject ? ` [${args.subject}]` : ''}${args.estimatedHours ? ` 预估${args.estimatedHours}h` : ''}`;
      case 'create_tasks':
        return Array.isArray(args.titles) ? args.titles.map((title: string) => `"${title}"`).join('、') : '{}';
      case 'complete_task': {
        const taskTitle =
          result?.title ||
          (typeof args.taskId === 'string' && args.taskId
            ? (await this.agentToolsService.getTaskById(userId, args.taskId))?.title
            : undefined);
        return taskTitle ? `"${taskTitle}"` : `任务ID ${args.taskId}`;
      }
      case 'start_pomodoro':
        return `${args.duration || 25}分钟${await this.formatTaskReference(userId, args, result)}${args.createTaskIfMissing ? ' (不存在则自动创建)' : ''}`;
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

  private async formatTaskReference(userId: string, args: Record<string, any>, result?: any) {
    const taskTitle =
      result?.boundTaskTitle ||
      result?.taskTitle ||
      (typeof args.taskTitle === 'string' ? args.taskTitle : '') ||
      (typeof args.taskName === 'string' ? args.taskName : '');

    if (taskTitle) {
      return ` (任务: ${taskTitle})`;
    }

    if (typeof args.taskId === 'string' && args.taskId) {
      const task = await this.agentToolsService.getTaskById(userId, args.taskId);
      return task?.title ? ` (任务: ${task.title})` : ` (任务ID: ${args.taskId})`;
    }

    return '';
  }

  private shouldSuppressAutoReply(confirmMode: boolean, toolResults: Array<{ tool: string; result?: any }>) {
    if (confirmMode) {
      return false;
    }

    const hasSuccessfulWrite = toolResults.some(({ tool, result }) => (
      !READ_ONLY_TOOLS.has(tool) && !result?.error
    ));
    if (!hasSuccessfulWrite) {
      return false;
    }

    const hasAnyError = toolResults.some(({ result }) => Boolean(result?.error));
    return !hasAnyError;
  }

  private isInternalExecutionEcho(role: string, content: string, toolCalls?: unknown) {
    if (role !== 'assistant') {
      return false;
    }

    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      return false;
    }

    const normalizedContent = String(content || '').trim();
    return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu.test(normalizedContent)
      && /[\r\n]/u.test(normalizedContent);
  }

  /**
   * 清空历史
   */
  async clearHistory(userId: string) {
    await this.prisma.agentMessage.deleteMany({ where: { userId } });
    return { message: '会话历史已清除' };
  }
}
