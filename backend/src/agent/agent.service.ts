import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AgentConfirmationService } from './agent-confirmation.service';
import { AgentContextService } from './agent-context.service';
import { AgentMemoryService } from './agent-memory.service';
import { AgentProfileService } from './agent-profile.service';
import { AgentTraceService } from './agent-trace.service';
import { AgentToolsService, AGENT_TOOLS } from './agent-tools.service';
import { StudyPlanService } from '../study-plan/study-plan.service';
import { AgentMessageHints, extractAgentMessageHints, toTaskMatchKey } from './agent-intent.utils';
import { AgentSessionService } from './agent-session.service';

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
  'get_current_goal',
  'get_pomodoro_status',
  'get_today_expenses',
  'get_today_exercise',
]);

const TOOL_LABELS: Record<string, string> = {
  start_day: '开启今日',
  create_task: '创建任务',
  create_tasks: '批量创建任务',
  create_and_complete_task: '创建并完成任务',
  update_task: '修改任务',
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

const AGENT_PROMPT_VERSION = 'lifetracker-agent-2026-04-27';
const AGENT_TOOLSET_VERSION = 'lifetracker-tools-v1';

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
6. 番茄钟绑定规则（严格按优先级，不可跳过）：
   ① 消息/提示中已有 taskId → start_pomodoro({ taskId, duration })，直接执行，不再查询
   ② 有任务名，提示显示"已匹配到今日未完成任务" → start_pomodoro({ taskId: 匹配到的ID, duration })
   ③ 有任务名，提示显示"存在歧义" → 先向用户澄清哪个任务，禁止猜测绑定
   ④ 有任务名，提示显示"未匹配" → start_pomodoro({ taskTitle, createTaskIfMissing: true, duration })
   ⑤ 无任务名 → start_pomodoro({ duration })，不绑定任务
   严禁：把历史已完成任务拿来当候选；无 createTaskIfMissing 却传 taskTitle 期待前端显示
7. 当一句话同时包含记录信息、建任务、开番茄时，按顺序执行：先记录事实，再准备任务，再开启番茄
8. 如果 start_pomodoro 没传 taskId，就不要只传模糊的自由文本然后期待前端自己显示；要么匹配到真实 taskId，要么让工具自动创建任务
9. 运动感受：用户说"运动感觉很棒/不错/一般/累了"时，调用 set_exercise_feeling，不要调用 update_day_reflection
10. 重要信息：用户说"添加重要信息"、"记一下重要的事"时，调用 update_important_info，不要创建任务
11. 今日复盘：仅在用户明确说"写复盘"、"总结今天"时才调用 update_day_reflection
12. 记录花费时，注意区分餐饮（早餐/午餐/晚餐用 record_meal_expense）和其他花费（用 record_other_expense）
13. 番茄钟默认25分钟；如果长期记忆里有用户明确保存的默认番茄时长，优先使用长期记忆；本轮用户明确指定时长时，以本轮指令为准
14. 任务完成要走工具：用户说"资料分析任务完成"、"25.9福建事业单位完成了"、"这个任务做完了"这类话时，应调用 complete_task，不要把内部上下文或 UUID 原样回复给用户
15. 永远不要向用户展示内部上下文标记，例如"【已执行操作】"、"最近工具结果"这类文字

【关键示例】
示例1：用户说 "今天早上7:30起床，今天任务是套卷+下午公差+晚上毕设"
→ 调用 start_day({"wakeUpTime":"07:30","dayStart":"今天安排：套卷、公差、毕设"})
→ 调用 create_tasks({"titles":["套卷","下午公差","晚上毕设"]})

示例2：用户说 "现在做福建事业单位试卷，开启2小时番茄"，提示显示该任务未匹配到今日任务
→ 调用 start_pomodoro({"duration":120,"taskTitle":"福建事业单位试卷","createTaskIfMissing":true})

示例3：用户说 "今天跑了3公里，状态非常棒。现在想做一套福建事业单位的试卷，帮我开启2小时的番茄"
→ 调用 record_exercise({"exerciseName":"跑步","value":3,"unit":"km","emoji":"🏃"})
→ 调用 set_exercise_feeling({"feeling":"excellent"})
→ 调用 start_pomodoro({"duration":120,"taskTitle":"福建事业单位试卷","createTaskIfMissing":true})

示例4：用户说 "资料分析任务完成"，提示显示已匹配 taskId="abc-123"
→ 调用 complete_task({"taskId":"abc-123","taskTitle":"资料分析"})

【晨间规划流程】严格分两阶段，绝不可越级。

== 阶段 1：提案（用户首次给出今天安排时） ==
仅输出文字，**禁止调用任何工具**（不调 start_day、不调 create_tasks，什么写操作都不做）。
你要做的：
1. 分析用户的时间段，合理安排任务顺序（难的科目放精力好的时段，简单的放疲劳时段）
2. 如果用户有活跃学习计划，把今日学习安排的章节也纳入任务列表
3. 用户提到的特殊任务（模考、运动、外出等）要单独列出来，不要遗漏
4. 把"白天有事"、"出门"、"休息"这类非任务的时段，**不要**算成任务
5. 用列表形式呈现完整的全天计划表（按上午/下午/晚上分时段），每个时段标注要做的任务
6. 末尾必须问一句"这个安排可以吗？需要调整告诉我，确认后我来创建任务"
7. 注意：用户说的整段时间安排是任务列表，不是 dayStart 文本。dayStart 是当日主题/口号（如"备考冲刺日"），最多 30 字

== 阶段 2：执行（仅在用户明确表达确认意愿后） ==
确认信号包括：'好/可以/确认/对/没问题/同意/OK/就这样/开始吧/创建吧'，或对计划提出修改后又确认。
此时才调用工具，按顺序：
1. create_tasks({ titles: [...] }) 批量创建当天任务
2. start_day({ wakeUpTime, dayStart }) — dayStart 是一句话主题（如"备考冲刺日"），不是任务列表
3. 用文字回复"已经创建好啦，要开始第一个番茄钟吗？"

如果用户要调整，回到阶段 1 重新提案。
`;

export interface ReplySuggestion {
  label: string;   // 按钮上显示的短文字
  send: string;    // 点击后实际发送给 AI 的内容
  hint?: string;   // 可选：鼠标悬停或长按时的辅助说明
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private agentConfirmationService: AgentConfirmationService,
    private agentContextService: AgentContextService,
    private agentMemoryService: AgentMemoryService,
    private agentProfileService: AgentProfileService,
    private agentSessionService: AgentSessionService,
    private agentTraceService: AgentTraceService,
    private agentToolsService: AgentToolsService,
    private studyPlanService: StudyPlanService,
  ) {}

  /**
   * 获取历史消息（分页，往上翻加载更多）
   */
  async getMessages(userId: string, cursor?: string, limit = 30) {
    const where: any = {
      userId,
      OR: [
        { role: { in: ['user', 'assistant'] } },
        { role: 'confirm', confirmed: null },
      ],
    };
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

  async getRuns(userId: string, limit = 20) {
    return this.prisma.agentRun.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        input: true,
        status: true,
        model: true,
        promptVersion: true,
        toolsetVersion: true,
        confirmMode: true,
        errorCode: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        latencyMs: true,
        _count: {
          select: {
            steps: true,
            confirmations: true,
          },
        },
      },
    });
  }

  async getRun(userId: string, runId: string) {
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, userId },
      include: {
        steps: {
          orderBy: { createdAt: 'asc' },
        },
        confirmations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run) {
      return { run: null };
    }

    return { run };
  }

  async getRunSteps(userId: string, runId: string) {
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, userId },
      select: { id: true },
    });
    if (!run) {
      return { steps: [] };
    }

    const steps = await this.prisma.agentRunStep.findMany({
      where: { runId, userId },
      orderBy: { createdAt: 'asc' },
    });

    return { steps };
  }

  async getConfirmations(userId: string, status = 'pending', limit = 20) {
    const confirmations = await this.agentConfirmationService.listForUser(userId, status, limit);
    return {
      confirmations: confirmations.map((confirmation) => ({
        id: confirmation.id,
        runId: confirmation.runId,
        userId: confirmation.userId,
        toolName: confirmation.toolName,
        args: confirmation.args,
        summary: confirmation.summary,
        status: confirmation.status,
        result: confirmation.result,
        error: confirmation.error,
        createdAt: confirmation.createdAt,
        resolvedAt: confirmation.resolvedAt,
        executedAt: confirmation.executedAt,
        action: {
          id: confirmation.id,
          name: confirmation.toolName,
          args: confirmation.args,
        },
      })),
    };
  }

  async getMemories(userId: string) {
    return this.prisma.agentMemory.findMany({
      where: { userId },
      orderBy: [
        { status: 'asc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  async getProfile(userId: string) {
    return this.agentProfileService.getOrRebuildProfile(userId);
  }

  async rebuildProfile(userId: string) {
    return this.agentProfileService.rebuildProfile(userId);
  }

  async updateProfile(
    userId: string,
    patch: {
      summary?: string | null;
      goals?: unknown;
      preferences?: unknown;
      routines?: unknown;
      constraints?: unknown;
    },
  ) {
    return this.agentProfileService.updateProfile(userId, patch);
  }

  async createMemory(userId: string, type: string, content: string) {
    const normalizedType = this.normalizeMemoryType(type);
    const normalizedContent = String(content || '').trim();
    if (!normalizedContent) {
      throw new Error('记忆内容不能为空');
    }

    return this.prisma.agentMemory.create({
      data: {
        userId,
        type: normalizedType,
        content: normalizedContent,
        source: 'manual_user',
        confidence: 1,
        status: 'active',
      },
    });
  }

  async updateMemory(
    userId: string,
    memoryId: string,
    patch: { type?: string; content?: string; status?: string },
  ) {
    const existing = await this.prisma.agentMemory.findFirst({
      where: { id: memoryId, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('记忆不存在');
    }

    const data: Record<string, any> = {};
    if (patch.type !== undefined) {
      data.type = this.normalizeMemoryType(patch.type);
    }
    if (patch.content !== undefined) {
      const content = String(patch.content || '').trim();
      if (!content) {
        throw new Error('记忆内容不能为空');
      }
      data.content = content;
    }
    if (patch.status !== undefined) {
      data.status = this.normalizeMemoryStatus(patch.status);
    }

    return this.prisma.agentMemory.update({
      where: { id: memoryId },
      data,
    });
  }

  async deleteMemory(userId: string, memoryId: string) {
    const existing = await this.prisma.agentMemory.findFirst({
      where: { id: memoryId, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('记忆不存在');
    }

    return this.prisma.agentMemory.update({
      where: { id: memoryId },
      data: { status: 'archived' },
    });
  }

  /**
   * 主聊天接口
   */
  async chat(userId: string, message: string, confirmMode: boolean) {
    // 新一轮对话开始时，自动作废上一轮未处理的确认卡片
    await this.prisma.agentMessage.updateMany({
      where: {
        userId,
        role: 'confirm',
        confirmed: null,
      },
      data: {
        confirmed: false,
      },
    });
    await this.agentConfirmationService.expirePendingForUser(userId);

    // 保存用户消息
    await this.prisma.agentMessage.create({
      data: { userId, role: 'user', content: message },
    });

    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL', 'GLM-4-Flash');
    const timeout = parseInt(this.configService.get<string>('AI_TIMEOUT', '60000'), 10);

    if (!apiUrl || !apiKey) {
      throw new Error('AI_API_URL and AI_API_KEY must be configured');
    }

    const runStartedAt = Date.now();
    const runId = await this.agentTraceService.startRun({
      userId,
      input: message,
      confirmMode,
      model,
      promptVersion: AGENT_PROMPT_VERSION,
      toolsetVersion: AGENT_TOOLSET_VERSION,
    });
    const finishRun = async <T>(result: T, status: 'completed' | 'waiting_confirmation' = 'completed') => {
      await this.agentTraceService.finishRun(runId, status, runStartedAt);
      return { ...(result as any), runId };
    };
    const persistConfirmPreview = async <T extends { type?: string; previewReply?: string; previewMessageId?: string }>(result: T) => {
      if (result?.type !== 'confirms' || !result.previewReply || result.previewMessageId) {
        return result;
      }

      const saved = await this.prisma.agentMessage.create({
        data: {
          userId,
          role: 'assistant',
          content: result.previewReply,
        },
      });
      return { ...result, previewMessageId: saved.id };
    };

    try {
    // 从 DB 加载最近的对话作为 LLM 上下文
    const messageHints = extractAgentMessageHints(message);
    const memoryWrite = await this.agentMemoryService.processExplicitMemory(userId, message);
    await this.agentTraceService.recordStep({
      runId,
      userId,
      type: 'memory_write',
      status: memoryWrite.action === 'skipped' ? 'skipped' : 'success',
      input: { message },
      output: memoryWrite,
    });
    const memoryContext = await this.agentMemoryService.buildMemoryContext(userId);
    await this.agentTraceService.recordStep({
      runId,
      userId,
      type: 'memory_read',
      output: {
        count: memoryContext.memories.length,
        preferredPomodoroMinutes: memoryContext.preferredPomodoroMinutes,
      },
    });
    if (['created', 'updated', 'forgotten'].includes(memoryWrite.action)) {
      await this.agentProfileService.rebuildProfile(userId);
    }
    const profileContext = await this.agentProfileService.buildProfileContext(userId);
    await this.agentTraceService.recordStep({
      runId,
      userId,
      type: 'profile_read',
      output: {
        hasProfile: Boolean(profileContext.profile),
        hasContext: Boolean(profileContext.contextText),
      },
    });
    const shortTermContext = await this.agentContextService.buildShortTermContext(userId);
    await this.agentTraceService.recordStep({
      runId,
      userId,
      type: 'context_build',
      output: shortTermContext.stats,
    });
    // 检查是否有活跃的 morning_planning session，如有则注入上下文
    const activeSession = await this.agentSessionService.getSession(userId);
    let sessionContext: string | null = null;
    if (activeSession?.flow === 'morning_planning') {
      const { state, data } = activeSession;
      const sessionParts: string[] = [`【晨间规划流程状态: ${state}】`];
      if (data.wakeUpTime) sessionParts.push(`用户起床时间: ${data.wakeUpTime}`);
      if (state === 'plan_proposed' && data.proposedPlan) {
        sessionParts.push(`上一轮AI提出的计划草稿:\n${data.proposedPlan}`);
        const isConfirm = this.isPlanConfirmation(message);
        if (isConfirm) {
          sessionParts.push('用户已明确同意当前方案。立即调用 create_tasks 批量创建任务，再 start_day，然后回复"已经创建好啦"。');
        } else {
          sessionParts.push(
            '用户对当前方案提出了修改/补充意见（不是确认）。你必须：\n'
            + '1. 把用户这条消息的内容（如"再加一个 X"、"调整 Y"）合并到上面的草稿，输出**完整新版计划**（保留原有任务+新加任务）\n'
            + '2. 末尾再问一次"这样改可以吗？没问题就告诉我"\n'
            + '3. **绝对不要直接调 create_task / create_tasks / start_day**，用户还在调整阶段',
          );
        }
      } else if (state === 'greeting_sent') {
        sessionParts.push('已完成晨间问候，等待用户提供今天的时间安排。用户现在的消息可能包含时间段或任务信息，请结合学习计划制定全天计划并列出，然后等待确认。');
      }
      sessionContext = sessionParts.join('\n');
    }

    const structuredGuidance = await this.buildStructuredGuidance(userId, message, messageHints);

    // 把结构化指令附加到当前用户消息末尾，确保 LLM 在处理请求时第一时间看到已解析的 taskId 和匹配结果
    // 注意：shortTermContext.messages 最后一条不一定是 user，需精确找到最后一条 user 消息
    const lastUserIdx = [...shortTermContext.messages].reverse().findIndex(m => m.role === 'user');
    const historyMessages = lastUserIdx >= 0
      ? shortTermContext.messages.slice(0, shortTermContext.messages.length - 1 - lastUserIdx)
      : shortTermContext.messages;
    const lastUserMessage = lastUserIdx >= 0
      ? shortTermContext.messages[shortTermContext.messages.length - 1 - lastUserIdx]
      : null;
    const baseUserContent = lastUserMessage?.content ?? message;
    const userMessageContent = structuredGuidance
      ? `${baseUserContent}\n\n${structuredGuidance}`
      : baseUserContent;

    // 过滤历史中连续同角色消息（失败请求堆积的孤立 user 消息会导致 DeepSeek 400）
    const cleanedHistory = historyMessages.reduce<LLMMessage[]>((acc, msg) => {
      if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
        // 合并同角色相邻消息
        acc[acc.length - 1] = {
          ...acc[acc.length - 1],
          content: `${acc[acc.length - 1].content}\n${msg.content}`,
        };
      } else {
        acc.push(msg);
      }
      return acc;
    }, []);

    // 确保历史最后一条是 assistant（user 在后面追加），否则 DeepSeek 拒绝
    const trimmedHistory = cleanedHistory.at(-1)?.role === 'user'
      ? cleanedHistory.slice(0, -1)
      : cleanedHistory;

    const llmMessages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(memoryContext.contextText ? [{ role: 'system' as const, content: memoryContext.contextText }] : []),
      ...(profileContext.contextText ? [{ role: 'system' as const, content: profileContext.contextText }] : []),
      ...(shortTermContext.toolSummary ? [{ role: 'system' as const, content: shortTermContext.toolSummary }] : []),
      ...(sessionContext ? [{ role: 'system' as const, content: sessionContext }] : []),
      ...trimmedHistory,
      { role: 'user', content: userMessageContent },
    ];

    const toolResults: any[] = [];
    // 确认模式下收集所有写操作，最后统一返回
    const pendingWriteOps: Array<{ id: string; name: string; args: any }> = [];

    // 第一轮根据 hints 锁定工具，避免 LLM 在意图明确时绕路
    const firstRoundToolChoice = this.resolveFirstRoundToolChoice(messageHints);

    // 晨间规划硬护栏：以下情况强制第一轮不调工具，让 AI 输出（重新）方案文字
    //  (a) 首次开启：用户给了时段/任务安排，且没有 plan_proposed session
    //  (b) 调整中：已在 plan_proposed 状态，但用户消息不是确认信号 → 视为要调整，回到提案阶段
    const isInPlanProposed = activeSession?.flow === 'morning_planning' && activeSession.state === 'plan_proposed';
    const isMorningProposalPhase =
      (this.isMorningPlanningMessage(message) && !isInPlanProposed)
      || (isInPlanProposed && !this.isPlanConfirmation(message));

    // 循环处理 tool calls
    let maxRounds = 5;
    let isFirstRound = true;
    while (maxRounds-- > 0) {
      const toolChoice = isFirstRound
        ? (isMorningProposalPhase ? 'none' : firstRoundToolChoice)
        : 'auto';
      isFirstRound = false;
      const llmStartedAt = Date.now();
      const response = await axios.post(
        apiUrl,
        { model, messages: llmMessages, tools: AGENT_TOOLS, tool_choice: toolChoice },
        {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout,
        },
      );
      await this.agentTraceService.recordStep({
        runId,
        userId,
        type: 'llm_call',
        input: {
          model,
          messageCount: llmMessages.length,
          toolCount: AGENT_TOOLS.length,
          toolChoice: typeof toolChoice === 'string' ? toolChoice : toolChoice?.function?.name,
        },
        output: {
          finishReason: response.data?.choices?.[0]?.finish_reason,
          hasToolCalls: Boolean(response.data?.choices?.[0]?.message?.tool_calls?.length),
          toolCallCount: response.data?.choices?.[0]?.message?.tool_calls?.length || 0,
        },
        durationMs: Date.now() - llmStartedAt,
      });

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
          return finishRun(todayTasksFallback);
        }
        const completionFallback = await this.handleDirectCompletionFallback(
          userId,
          message,
          confirmMode,
          messageHints,
          toolResults,
        );
        if (completionFallback) {
          return finishRun(
            await persistConfirmPreview(completionFallback),
            completionFallback.type === 'confirms' ? 'waiting_confirmation' : 'completed',
          );
        }
        const createAndCompleteFallback = await this.handleCreateAndCompleteFallback(
          userId,
          message,
          confirmMode,
          messageHints,
          toolResults,
        );
        if (createAndCompleteFallback) {
          return finishRun(
            await persistConfirmPreview(createAndCompleteFallback),
            createAndCompleteFallback.type === 'confirms' ? 'waiting_confirmation' : 'completed',
          );
        }
        // 复盘 fallback：LLM 查完数据后输出了文字但没调 update_day_reflection，自动提取并保存
        const reflectionFallback = await this.handleReflectionFallback(
          userId,
          message,
          assistantMsg.content,
          toolResults,
        );
        if (reflectionFallback) {
          return finishRun(reflectionFallback);
        }
        if (this.shouldSuppressAutoReply(confirmMode, toolResults)) {
          return finishRun(await this.createAutoWriteApplied(userId, toolResults));
        }
        const deterministicConfirmFallback = await this.handleDeterministicConfirmFallback(
          userId,
          message,
          confirmMode,
          messageHints,
          memoryContext.preferredPomodoroMinutes,
          runId,
        );
        if (deterministicConfirmFallback) {
          return finishRun(
            await persistConfirmPreview(deterministicConfirmFallback),
            'waiting_confirmation',
          );
        }
        // 晨间规划 session 推进
        const replyText = assistantMsg.content || '';
        if (activeSession?.flow === 'morning_planning' && activeSession.state === 'greeting_sent' && replyText.length > 50) {
          // 已有 session（按按钮"开启今日"启动） + greeting_sent → plan_proposed
          await this.agentSessionService.transitionTo(userId, 'plan_proposed', {
            proposedPlan: replyText.slice(0, 800),
          });
        } else if (!activeSession && isMorningProposalPhase && replyText.length > 50) {
          // 用户文字开启的晨间规划：本轮已生成计划草稿（被 guardrail 强制无工具），直接建立 session 进入 plan_proposed
          await this.agentSessionService.startMorningSession(userId, '');
          await this.agentSessionService.transitionTo(userId, 'plan_proposed', {
            wakeUpTime: messageHints.wakeUpTime,
            proposedPlan: replyText.slice(0, 800),
          });
        } else if (isInPlanProposed && isMorningProposalPhase && replyText.length > 50) {
          // 用户提出调整 → AI 输出新版方案，刷新 proposedPlan
          await this.agentSessionService.transitionTo(userId, 'plan_proposed', {
            proposedPlan: replyText.slice(0, 800),
          });
        }

        const saved = await this.prisma.agentMessage.create({
          data: {
            userId,
            role: 'assistant',
            content: assistantMsg.content || '',
            toolCalls: toolResults.length > 0 ? toolResults : undefined,
          },
        });
        const suggestions = await this.computeReplySuggestions(userId, assistantMsg.content || '');
        return finishRun({ id: saved.id, reply: assistantMsg.content || '', toolResults, type: 'reply', suggestions });
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
          const toolStartedAt = Date.now();
          let result: any;
          try {
            result = await this.agentToolsService.executeTool(userId, call.name, call.args);
          } catch (error) {
            result = { error: error.message || 'Tool execution failed' };
          }
          await this.agentTraceService.recordStep({
            runId,
            userId,
            type: 'tool_call',
            status: result?.error ? 'failed' : 'success',
            input: { tool: call.name, args: call.args, readOnly: isReadOnly },
            output: result,
            error: result?.error ? { message: result.error } : undefined,
            durationMs: Date.now() - toolStartedAt,
          });
          toolResults.push({ tool: call.name, args: call.args, result });
          llmMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: call.id });

          // 晨间规划 session 推进：create_tasks 成功 → 流程结束
          if (call.name === 'create_tasks' && !result?.error && activeSession?.flow === 'morning_planning') {
            await this.agentSessionService.transitionTo(userId, 'done');
          }
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
      const normalizedPendingWriteOps = this.normalizePendingWriteOps(messageHints, pendingWriteOps);
      const hasReflectionWrite = normalizedPendingWriteOps.some((op) => op.name === 'update_day_reflection');
      const reflectionSafePendingWriteOps = (this.isReflectionIntentMessage(message) || hasReflectionWrite)
        ? normalizedPendingWriteOps.filter((op) => op.name === 'update_day_reflection')
        : normalizedPendingWriteOps;
      const memorySafePendingWriteOps = this.isExplicitMemoryIntent(message)
        ? reflectionSafePendingWriteOps.filter((op) => op.name !== 'start_pomodoro')
        : reflectionSafePendingWriteOps;
      const intentSafePendingWriteOps = this.isPomodoroCandidateIntentQuery(message)
        ? []
        : memorySafePendingWriteOps;
      const finalPendingWriteOps = this.sanitizePendingWriteOps(
        messageHints,
        intentSafePendingWriteOps,
        memoryContext.preferredPomodoroMinutes,
      );

      // 晨间规划闭环：用户确认了 plan_proposed 方案 + LLM 生成了 create_tasks 但漏了 start_day → 自动补齐
      if (
        isInPlanProposed
        && this.isPlanConfirmation(message)
        && finalPendingWriteOps.some((op) => op.name === 'create_tasks')
        && !finalPendingWriteOps.some((op) => op.name === 'start_day')
      ) {
        const wakeUpTime = activeSession?.data?.wakeUpTime;
        const dayStart = this.deriveDayStartFromPlan(activeSession?.data?.proposedPlan) || '新的一天';
        finalPendingWriteOps.push({
          id: `auto-start-day-${Date.now()}`,
          name: 'start_day',
          args: { ...(wakeUpTime ? { wakeUpTime } : {}), dayStart },
        });
        this.logger.log(`[MORNING-AUTOFILL] appended start_day(wakeUp=${wakeUpTime}, dayStart="${dayStart}")`);
      }

      if (finalPendingWriteOps.length === 0) {
        return finishRun(await this.createAssistantReply(
          userId,
          this.isPomodoroCandidateIntentQuery(message)
            ? '我会只查看今日可绑定的任务候选，不会自动创建任务或开启番茄钟。'
            : '这轮没有需要确认执行的写操作。',
          toolResults,
        ));
      }
      const confirms: Array<{ id: string; summary: string; action: any }> = [];
      for (const op of finalPendingWriteOps) {
        const label = TOOL_LABELS[op.name] || op.name;
        const detail = await this.formatToolArgs(userId, op.name, op.args);
        const summary = `${label}：${detail}`;

        const saved = await this.agentConfirmationService.create({
          runId,
          userId,
          toolName: op.name,
          args: op.args,
          summary,
        });
        if (saved) {
          confirms.push({ id: saved.id, summary, action: op });
        }
      }
      await this.agentTraceService.recordStep({
        runId,
        userId,
        type: 'confirmation_generation',
        input: { pendingCount: pendingWriteOps.length },
        output: { confirmationCount: confirms.length, tools: finalPendingWriteOps.map((op) => op.name) },
      });
      const previewReply = await this.buildPendingWritePreview(userId, finalPendingWriteOps);
      return finishRun(await persistConfirmPreview({
        type: 'confirms',
        confirms,
        previewReply,
      }), 'waiting_confirmation');
    }

    if (this.shouldSuppressAutoReply(confirmMode, toolResults)) {
      return finishRun(await this.createAutoWriteApplied(userId, toolResults));
    }

    const saved = await this.prisma.agentMessage.create({
      data: { userId, role: 'assistant', content: '操作完成，但处理轮次过多，请简化你的请求。' },
    });
    return finishRun({ id: saved.id, reply: '操作完成，但处理轮次过多，请简化你的请求。', toolResults, type: 'reply' });
    } catch (error) {
      await this.agentTraceService.finishRun(runId, 'failed', runStartedAt, {
        code: 'AGENT_CHAT_FAILED',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 确认执行单个待定操作
   */
  async confirmAction(userId: string, messageId: string) {
    const confirmation = await this.agentConfirmationService.findPending(userId, messageId);
    if (confirmation) {
      const call = {
        id: confirmation.id,
        name: confirmation.toolName,
        args: confirmation.args as Record<string, any>,
      };

      this.logger.log(`[CONFIRM-APPROVE] tool=${call.name} args=${JSON.stringify(call.args)} confirmationId=${messageId}`);
      const executeStartedAt = Date.now();
      await this.agentConfirmationService.markApproved(messageId);
      await this.agentTraceService.recordStep({
        runId: confirmation.runId,
        userId,
        type: 'confirmation_approval',
        input: {
          confirmationId: messageId,
          tool: call.name,
          args: call.args,
        },
      });
      const toolResults = await this.executePendingAction(userId, call);
      this.logger.log(`[CONFIRM-RESULT] toolResults=${JSON.stringify(toolResults)}`);
      const hasSuccessfulWrite = toolResults.some(({ result }) => !result?.error);
      const firstError = toolResults.find(({ result }) => Boolean(result?.error))?.result?.error;

      if (firstError && !hasSuccessfulWrite) {
        await this.agentConfirmationService.markFailed(messageId, { message: firstError }, toolResults);
        await this.agentTraceService.recordStep({
          runId: confirmation.runId,
          userId,
          type: 'confirmation_execution',
          status: 'failed',
          input: {
            confirmationId: messageId,
            tool: call.name,
            args: call.args,
          },
          output: toolResults,
          error: { message: firstError },
          durationMs: Date.now() - executeStartedAt,
        });
        return {
          type: 'confirm_error',
          messageId,
          error: firstError,
        };
      }

      const summary = await this.formatExecutedActionSummary(userId, call, toolResults);
      await this.agentConfirmationService.markExecuted(messageId, { summary, toolResults });
      await this.agentTraceService.recordStep({
        runId: confirmation.runId,
        userId,
        type: 'confirmation_execution',
        input: {
          confirmationId: messageId,
          tool: call.name,
          args: call.args,
        },
        output: { summary, toolResults },
        durationMs: Date.now() - executeStartedAt,
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

    const msg = await this.prisma.agentMessage.findFirst({
      where: { id: messageId, userId, role: 'confirm', confirmed: null },
    });
    if (!msg || !msg.pendingAction) {
      throw new Error('没有找到待确认的操作');
    }

    const pending = msg.pendingAction as any;
    const call = pending.toolCall;

    this.logger.log(`Confirmed executing: ${call.name} args: ${JSON.stringify(call.args)}`);
    const toolResults = await this.executePendingAction(userId, call);
    const hasSuccessfulWrite = toolResults.some(({ result }) => !result?.error);
    const firstError = toolResults.find(({ result }) => Boolean(result?.error))?.result?.error;

    if (firstError && !hasSuccessfulWrite) {
      return {
        type: 'confirm_error',
        messageId,
        error: firstError,
      };
    }

    const summary = await this.formatExecutedActionSummary(userId, call, toolResults);

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

  async retryConfirmation(userId: string, confirmationId: string) {
    const confirmation = await this.agentConfirmationService.findRetriable(userId, confirmationId);
    if (!confirmation) {
      throw new Error('没有找到可重试的确认操作');
    }

    const call = {
      id: confirmation.id,
      name: confirmation.toolName,
      args: confirmation.args as Record<string, any>,
    };

    const executeStartedAt = Date.now();
    await this.agentConfirmationService.markApproved(confirmationId);
    await this.agentTraceService.recordStep({
      runId: confirmation.runId,
      userId,
      type: 'confirmation_retry',
      input: {
        confirmationId,
        tool: call.name,
        args: call.args,
      },
    });

    const toolResults = await this.executePendingAction(userId, call);
    const hasSuccessfulWrite = toolResults.some(({ result }) => !result?.error);
    const firstError = toolResults.find(({ result }) => Boolean(result?.error))?.result?.error;

    if (firstError && !hasSuccessfulWrite) {
      await this.agentConfirmationService.markFailed(confirmationId, { message: firstError }, toolResults);
      await this.agentTraceService.recordStep({
        runId: confirmation.runId,
        userId,
        type: 'confirmation_execution',
        status: 'failed',
        input: {
          confirmationId,
          tool: call.name,
          args: call.args,
        },
        output: toolResults,
        error: { message: firstError },
        durationMs: Date.now() - executeStartedAt,
      });
      return {
        type: 'confirm_error',
        messageId: confirmationId,
        error: firstError,
      };
    }

    const summary = await this.formatExecutedActionSummary(userId, call, toolResults);
    await this.agentConfirmationService.markExecuted(confirmationId, { summary, toolResults });
    await this.agentTraceService.recordStep({
      runId: confirmation.runId,
      userId,
      type: 'confirmation_execution',
      input: {
        confirmationId,
        tool: call.name,
        args: call.args,
      },
      output: { summary, toolResults },
      durationMs: Date.now() - executeStartedAt,
    });

    return {
      id: confirmationId,
      messageId: confirmationId,
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
    const confirmation = await this.agentConfirmationService.findPending(userId, messageId);
    if (confirmation) {
      await this.agentConfirmationService.markRejected(messageId);
      await this.agentTraceService.recordStep({
        runId: confirmation.runId,
        userId,
        type: 'confirmation_rejection',
        input: {
          confirmationId: messageId,
          tool: confirmation.toolName,
          args: confirmation.args,
        },
      });
      return {
        id: messageId,
        messageId,
        summary: confirmation.summary,
        confirmed: false,
        type: 'confirm_updated',
      };
    }

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

  private async handleDeterministicConfirmFallback(
    userId: string,
    message: string,
    confirmMode: boolean,
    hints: AgentMessageHints,
    preferredPomodoroMinutes: number | null,
    runId: string | null,
  ) {
    if (!confirmMode || !runId) {
      return null;
    }
    if (this.isExplicitMemoryIntent(message)) {
      return null;
    }
    if (this.isPomodoroCandidateIntentQuery(message)) {
      return null;
    }
    // 晨间规划场景：用户提供了时间段安排，需要 LLM 编排任务，不能被 deterministic fallback 截断
    if (this.isMorningPlanningMessage(message)) {
      return null;
    }
    // plan_proposed 状态下，用户的非确认消息（含 "再加"、"调整"、具体修改）应该让 LLM 重新提案，
    // 不能被 deterministic fallback 抢先把单个任务塞进 confirm
    const session = await this.agentSessionService.getSession(userId);
    if (session?.flow === 'morning_planning' && session.state === 'plan_proposed' && !this.isPlanConfirmation(message)) {
      return null;
    }

    const pendingWriteOps: Array<{ id: string; name: string; args: any }> = [];
    const importantInfo = this.extractImportantInfoIntentContent(message);
    const dayReflection = this.extractDayReflectionIntentContent(message);

    if (hints.wakeUpTime || this.looksLikeStartDayIntent(message)) {
      pendingWriteOps.push({
        id: `fallback-start-day-${Date.now()}`,
        name: 'start_day',
        args: {
          wakeUpTime: hints.wakeUpTime,
          dayStart: this.extractDayStartContent(message, hints),
        },
      });
    }

    if (hints.explicitTaskTitles.length > 0) {
      pendingWriteOps.push({
        id: `fallback-create-tasks-${Date.now()}`,
        name: 'create_tasks',
        args: { titles: hints.explicitTaskTitles },
      });
    }

    const mealExpenses = this.extractMealExpenseIntents(message);
    for (const mealExpense of mealExpenses) {
      pendingWriteOps.push({
        id: `fallback-meal-expense-${mealExpense.category}-${Date.now()}`,
        name: 'record_meal_expense',
        args: mealExpense,
      });
    }

    if (!this.isReflectionIntentMessage(message) && hints.createAndCompleteTaskTitle) {
      pendingWriteOps.push({
        id: `fallback-create-complete-${Date.now()}`,
        name: 'create_and_complete_task',
        args: {
          title: hints.createAndCompleteTaskTitle,
          createArgs: { title: hints.createAndCompleteTaskTitle },
        },
      });
    } else if (!this.isReflectionIntentMessage(message) && hints.completionTaskTitle) {
      pendingWriteOps.push({
        id: `fallback-complete-${Date.now()}`,
        name: 'complete_task',
        args: { taskTitle: hints.completionTaskTitle },
      });
    }

    if (hints.pomodoro) {
      pendingWriteOps.push({
        id: `fallback-pomodoro-${Date.now()}`,
        name: 'start_pomodoro',
        args: {
          duration: hints.pomodoro.durationMinutes || preferredPomodoroMinutes || 25,
          ...(hints.pomodoro.taskTitle
            ? { taskTitle: hints.pomodoro.taskTitle, createTaskIfMissing: true }
            : {}),
        },
      });
    } else if (this.isSimplePomodoroStartIntent(message)) {
      pendingWriteOps.push({
        id: `fallback-pomodoro-${Date.now()}`,
        name: 'start_pomodoro',
        args: { duration: preferredPomodoroMinutes || 25 },
      });
    }

    if (
      hints.pomodoro?.taskTitle
      && !pendingWriteOps.some((op) => (
        (op.name === 'create_task' && this.matchesTaskTitleKey(op.args?.title, toTaskMatchKey(hints.pomodoro?.taskTitle || '')))
        || (op.name === 'create_tasks' && Array.isArray(op.args?.titles) && op.args.titles.some((title: string) => this.matchesTaskTitleKey(title, toTaskMatchKey(hints.pomodoro?.taskTitle || ''))))
      ))
    ) {
      pendingWriteOps.push({
        id: `fallback-create-pomodoro-task-${Date.now()}`,
        name: 'create_task',
        args: { title: hints.pomodoro.taskTitle },
      });
    }

    if (hints.exerciseRecord) {
      pendingWriteOps.push({
        id: `fallback-exercise-${Date.now()}`,
        name: 'record_exercise',
        args: {
          exerciseName: hints.exerciseRecord.exerciseName,
          value: hints.exerciseRecord.value,
        },
      });
    }

    if (hints.exerciseFeeling) {
      pendingWriteOps.push({
        id: `fallback-exercise-feeling-${Date.now()}`,
        name: 'set_exercise_feeling',
        args: { feeling: hints.exerciseFeeling },
      });
    }

    if (importantInfo) {
      pendingWriteOps.push({
        id: `fallback-important-info-${Date.now()}`,
        name: 'update_important_info',
        args: { content: importantInfo },
      });
    }

    if (dayReflection) {
      pendingWriteOps.push({
        id: `fallback-day-reflection-${Date.now()}`,
        name: 'update_day_reflection',
        args: { dayReflection },
      });
    }

    const normalizedPendingWriteOps = this.normalizePendingWriteOps(hints, pendingWriteOps);
    const reflectionSafePendingWriteOps = normalizedPendingWriteOps.some((op) => op.name === 'update_day_reflection')
      ? normalizedPendingWriteOps.filter((op) => op.name === 'update_day_reflection')
      : normalizedPendingWriteOps;
    const finalPendingWriteOps = this.sanitizePendingWriteOps(
      hints,
      reflectionSafePendingWriteOps,
      preferredPomodoroMinutes,
    );
    if (finalPendingWriteOps.length === 0) {
      return null;
    }

    const confirms: Array<{ id: string; summary: string; action: any }> = [];
    for (const op of finalPendingWriteOps) {
      const label = TOOL_LABELS[op.name] || op.name;
      const detail = await this.formatToolArgs(userId, op.name, op.args);
      const summary = `${label}：${detail}`;
      const saved = await this.agentConfirmationService.create({
        runId,
        userId,
        toolName: op.name,
        args: op.args,
        summary,
      });
      if (saved) {
        confirms.push({ id: saved.id, summary, action: op });
      }
    }

    if (confirms.length === 0) {
      return null;
    }

    await this.agentTraceService.recordStep({
      runId,
      userId,
      type: 'confirmation_generation',
      input: { source: 'deterministic_fallback', pendingCount: finalPendingWriteOps.length },
      output: { confirmationCount: confirms.length, tools: finalPendingWriteOps.map((op) => op.name) },
    });

    return {
      type: 'confirms' as const,
      confirms,
      previewReply: await this.buildPendingWritePreview(userId, finalPendingWriteOps),
    };
  }

  private normalizePendingWriteOps(
    hints: AgentMessageHints,
    pendingWriteOps: Array<{ id: string; name: string; args: any }>,
  ) {
    const taskTitle = hints.createAndCompleteTaskTitle;
    if (!taskTitle) {
      return pendingWriteOps;
    }

    const titleKey = toTaskMatchKey(taskTitle);
    const matchingCreateTask = pendingWriteOps.find((op) => (
      op.name === 'create_task' && this.matchesTaskTitleKey(op.args?.title, titleKey)
    ));
    const matchingCreateTasks = pendingWriteOps.find((op) => (
      op.name === 'create_tasks'
      && Array.isArray(op.args?.titles)
      && op.args.titles.length === 1
      && this.matchesTaskTitleKey(op.args.titles[0], titleKey)
    ));
    const hasMatchingComplete = pendingWriteOps.some((op) => (
      op.name === 'complete_task'
      && this.matchesTaskTitleKey(op.args?.taskTitle ?? op.args?.taskName, titleKey)
    ));

    if (pendingWriteOps.some((op) => op.name === 'create_and_complete_task')) {
      return pendingWriteOps;
    }

    const sourceCreateOp = matchingCreateTask || matchingCreateTasks;
    if (sourceCreateOp) {
      return pendingWriteOps.flatMap((op) => {
        if (op === sourceCreateOp) {
          const createArgs = sourceCreateOp.name === 'create_tasks'
            ? { title: taskTitle }
            : {
                ...sourceCreateOp.args,
                title: sourceCreateOp.args?.title || taskTitle,
              };

          return [{
            id: op.id,
            name: 'create_and_complete_task',
            args: {
              title: taskTitle,
              createArgs,
            },
          }];
        }

        if (op.name === 'complete_task' && this.matchesTaskTitleKey(op.args?.taskTitle ?? op.args?.taskName, titleKey)) {
          return [];
        }

        return [op];
      });
    }

    if (!hasMatchingComplete) {
      return [
        {
          id: `fallback-create-complete-${Date.now()}`,
          name: 'create_and_complete_task',
          args: {
            title: taskTitle,
            createArgs: { title: taskTitle },
          },
        },
        ...pendingWriteOps,
      ];
    }

    return pendingWriteOps;
  }

  private sanitizePendingWriteOps(
    hints: AgentMessageHints,
    pendingWriteOps: Array<{ id: string; name: string; args: any }>,
    preferredPomodoroMinutes?: number | null,
  ) {
    if (!Array.isArray(pendingWriteOps) || pendingWriteOps.length === 0) {
      return [];
    }

    const titlesInBatchCreate = new Set<string>();
    for (const op of pendingWriteOps) {
      if (op.name !== 'create_tasks' || !Array.isArray(op.args?.titles)) {
        continue;
      }
      for (const title of op.args.titles) {
        if (typeof title === 'string' && title.trim()) {
          titlesInBatchCreate.add(toTaskMatchKey(title));
        }
      }
    }

    const filtered = pendingWriteOps.filter((op) => {
      if (op.name === 'create_task') {
        const titleKey = toTaskMatchKey(op.args?.title || '');
        if (titleKey && titlesInBatchCreate.has(titleKey)) {
          return false;
        }
      }

      if (op.name === 'complete_task') {
        const taskId = typeof op.args?.taskId === 'string' ? op.args.taskId.trim() : '';
        const taskTitle = typeof op.args?.taskTitle === 'string' ? op.args.taskTitle.trim() : '';
        const taskName = typeof op.args?.taskName === 'string' ? op.args.taskName.trim() : '';
        if (!taskId && !taskTitle && !taskName) {
          return false;
        }
      }

      return true;
    });

    const seen = new Set<string>();
    const deduped: Array<{ id: string; name: string; args: any }> = [];
    for (const op of filtered) {
      const key = `${op.name}:${JSON.stringify(op.args || {})}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(op);
    }

    const hasTool = (toolName: string) => deduped.some((op) => op.name === toolName);

    if (hints.exerciseRecord) {
      const expectedExercise = hints.exerciseRecord.exerciseName;
      const expectedValue = hints.exerciseRecord.value;
      const expectedMode = hints.exerciseRecord.mode;

      for (let index = deduped.length - 1; index >= 0; index -= 1) {
        const op = deduped[index];
        if (op.name !== 'record_exercise') {
          continue;
        }

        const sameExercise = op.args?.exerciseName === expectedExercise;
        const sameValue = Number(op.args?.value) === expectedValue;
        if (!sameExercise || !sameValue) {
          deduped.splice(index, 1);
          continue;
        }

        op.args = {
          ...op.args,
          recordMode: expectedMode,
        };
      }
    }

    if (hints.completionTaskTitle) {
      for (const op of deduped) {
        if (
          op.name === 'complete_task'
          && !op.args?.taskTitle
          && !op.args?.taskName
        ) {
          op.args = {
            ...op.args,
            taskTitle: hints.completionTaskTitle,
          };
        }
      }
    }

    if (preferredPomodoroMinutes && !hints.pomodoro?.durationMinutes) {
      for (const op of deduped) {
        if (op.name === 'start_pomodoro') {
          op.args = {
            ...op.args,
            duration: preferredPomodoroMinutes,
          };
        }
      }
    }

    if (hints.pomodoro?.taskTitle) {
      const pomodoroTitleKey = toTaskMatchKey(hints.pomodoro.taskTitle);
      const hasMatchingCreate = deduped.some((op) => (
        (op.name === 'create_task' && this.matchesTaskTitleKey(op.args?.title, pomodoroTitleKey))
        || (op.name === 'create_tasks' && Array.isArray(op.args?.titles) && op.args.titles.some((title: string) => this.matchesTaskTitleKey(title, pomodoroTitleKey)))
      ));
      const hasPomodoroWithAutoCreate = deduped.some((op) => (
        op.name === 'start_pomodoro'
        && op.args?.createTaskIfMissing
        && this.matchesTaskTitleKey(op.args?.taskTitle ?? op.args?.taskName, pomodoroTitleKey)
      ));

      if (hasPomodoroWithAutoCreate && !hasMatchingCreate) {
        deduped.push({
          id: `fallback-create-pomodoro-task-${Date.now()}`,
          name: 'create_task',
          args: { title: hints.pomodoro.taskTitle },
        });
      }
    }

    // 补齐“完成任务”意图，避免模型漏掉时整轮只创建不完成
    if (
      hints.completionTaskTitle
      && !hasTool('complete_task')
      && !hasTool('create_and_complete_task')
    ) {
      deduped.push({
        id: `fallback-complete-${Date.now()}`,
        name: 'complete_task',
        args: { taskTitle: hints.completionTaskTitle },
      });
    }

    // 补齐“开启番茄钟”意图，避免模型漏掉时本轮没有番茄卡片
    if (hints.pomodoro && !hasTool('start_pomodoro')) {
      const pomodoroArgs: Record<string, any> = {
        duration: hints.pomodoro.durationMinutes || preferredPomodoroMinutes || 25,
      };

      if (hints.pomodoro.taskTitle) {
        pomodoroArgs.taskTitle = hints.pomodoro.taskTitle;
        pomodoroArgs.createTaskIfMissing = true;
      }

      deduped.push({
        id: `fallback-pomodoro-${Date.now()}`,
        name: 'start_pomodoro',
        args: pomodoroArgs,
      });
    }

    if (hints.exerciseFeeling && !hasTool('set_exercise_feeling')) {
      deduped.push({
        id: `fallback-exercise-feeling-${Date.now()}`,
        name: 'set_exercise_feeling',
        args: { feeling: hints.exerciseFeeling },
      });
    }

    const priority: Record<string, number> = {
      start_day: 10,
      create_tasks: 20,
      create_task: 30,
      create_and_complete_task: 40,
      complete_task: 50,
      start_pomodoro: 60,
      record_exercise: 70,
      set_exercise_feeling: 80,
      record_meal_expense: 90,
      record_other_expense: 100,
      update_important_info: 110,
      update_day_reflection: 120,
    };

    return deduped.sort((left, right) => (priority[left.name] ?? 999) - (priority[right.name] ?? 999));
  }

  private async buildPendingWritePreview(userId: string, pendingWriteOps: Array<{ id: string; name: string; args: any }>) {
    if (!Array.isArray(pendingWriteOps) || pendingWriteOps.length === 0) {
      return '';
    }

    const descriptions = await Promise.all(pendingWriteOps.map(async (op) => {
      const detail = await this.formatToolArgs(userId, op.name, op.args);
      switch (op.name) {
        case 'create_task':
        case 'create_tasks':
          return `创建 ${detail}`;
        case 'complete_task':
          return `完成 ${detail}`;
        case 'start_pomodoro':
          return `开启 ${detail} 的番茄钟`;
        case 'record_exercise':
          return `${op.args?.recordMode === 'increment' ? '追加运动' : '记录运动'} ${detail}`;
        case 'set_exercise_feeling':
          return `记录运动感受为${detail}`;
        case 'record_meal_expense':
        case 'record_other_expense':
          return `记录支出 ${detail}`;
        case 'update_important_info':
          return `更新重要信息 ${detail}`;
        case 'update_day_reflection':
          return `更新今日复盘 ${detail}`;
        default:
          return `${TOOL_LABELS[op.name] || op.name} ${detail}`;
      }
    }));

    return `我理解你的这轮操作是：${this.joinChineseList(descriptions)}。请在上方任务区确认要执行的项目。`;
  }

  private joinChineseList(items: string[]) {
    const filtered = items.map((item) => item.trim()).filter(Boolean);
    if (filtered.length <= 1) {
      return filtered[0] || '';
    }
    if (filtered.length === 2) {
      return `${filtered[0]}，并${filtered[1]}`;
    }
    return `${filtered.slice(0, -1).join('，')}，并${filtered[filtered.length - 1]}`;
  }

  private async executePendingAction(
    userId: string,
    action: { name: string; args: Record<string, any> },
  ) {
    if (action.name === 'create_and_complete_task') {
      const createArgs = {
        ...(action.args?.createArgs || {}),
        title: action.args?.createArgs?.title || action.args?.title,
      };

      const createResult = await this.executeToolSafely(userId, 'create_task', createArgs);
      const toolResults = [createResult];
      if (createResult.result?.error) {
        return toolResults;
      }

      const completeArgs = {
        taskId: createResult.result?.id,
        taskTitle: createResult.result?.title || action.args?.title,
      };
      const completeResult = await this.executeToolSafely(userId, 'complete_task', completeArgs);
      toolResults.push(completeResult);
      return toolResults;
    }

    return [await this.executeToolSafely(userId, action.name, action.args)];
  }

  private async executeToolSafely(userId: string, tool: string, args: Record<string, any>) {
    let result: any;
    try {
      result = await this.agentToolsService.executeTool(userId, tool, args);
    } catch (error) {
      result = { error: error.message || 'Tool execution failed' };
    }

    return { tool, args, result };
  }

  private async formatExecutedActionSummary(
    userId: string,
    action: { name: string; args: Record<string, any> },
    toolResults: Array<{ tool: string; args?: any; result?: any }>,
  ) {
    if (action.name === 'create_and_complete_task') {
      const createResult = toolResults.find(({ tool }) => tool === 'create_task');
      const completeResult = toolResults.find(({ tool }) => tool === 'complete_task');
      const title =
        completeResult?.result?.title
        || createResult?.result?.title
        || action.args?.title
        || '未命名任务';

      if (createResult?.result?.error) {
        return `创建并完成任务失败：${createResult.result.error}`;
      }

      if (completeResult?.result?.error) {
        return `已创建任务“${title}”，但标记完成失败：${completeResult.result.error}`;
      }

      return `已创建任务“${title}”并标记为已完成。`;
    }

    const label = TOOL_LABELS[action.name] || action.name;
    const detail = await this.formatToolArgs(
      userId,
      action.name,
      action.args,
      toolResults[toolResults.length - 1]?.result,
    );
    return `${label}：${detail}`;
  }

  private async createAutoWriteApplied(
    userId: string,
    toolResults: Array<{ tool: string; args?: any; result?: any }>,
  ) {
    const summary = await this.buildActionResultSummary(userId, toolResults);
    if (summary) {
      await this.prisma.agentMessage.create({
        data: {
          userId,
          role: 'action_result',
          content: summary,
          toolCalls: toolResults,
        },
      });
    }

    return { type: 'auto_write_applied', toolResults };
  }

  private async buildActionResultSummary(
    userId: string,
    toolResults: Array<{ tool: string; args?: any; result?: any }>,
  ) {
    const lines: string[] = [];

    for (const toolResult of toolResults) {
      if (toolResult.result?.error || READ_ONLY_TOOLS.has(toolResult.tool)) {
        continue;
      }

      switch (toolResult.tool) {
        case 'create_task': {
          const title = toolResult.result?.title || toolResult.args?.title;
          if (title) {
            lines.push(`已创建任务“${title}”。`);
          }
          break;
        }
        case 'create_tasks': {
          const createdTitles = (toolResult.result?.created ?? []).map((task: any) => task.title).filter(Boolean);
          const skippedTitles = (toolResult.result?.skipped ?? []).map((task: any) => task.title).filter(Boolean);
          if (createdTitles.length > 0) {
            lines.push(`已创建任务：${createdTitles.join('、')}。`);
          }
          if (skippedTitles.length > 0) {
            lines.push(`已跳过已有任务：${skippedTitles.join('、')}。`);
          }
          break;
        }
        case 'complete_task': {
          const title =
            toolResult.result?.title
            || (typeof toolResult.args?.taskId === 'string' && toolResult.args.taskId
              ? (await this.agentToolsService.getTaskById(userId, toolResult.args.taskId))?.title
              : toolResult.args?.taskTitle);
          if (title) {
            lines.push(`已将任务“${title}”标记为完成。`);
          }
          break;
        }
        case 'start_day':
          if (toolResult.result?.dayStart || toolResult.args?.dayStart) {
            lines.push(`已更新今日计划。`);
          }
          break;
        case 'start_pomodoro': {
          const taskTitle = toolResult.result?.boundTaskTitle || toolResult.args?.taskTitle || '';
          lines.push(taskTitle ? `已开启番茄钟，关联任务“${taskTitle}”。` : '已开启番茄钟。');
          break;
        }
        case 'stop_pomodoro':
          lines.push('已停止当前番茄钟。');
          break;
        case 'record_exercise':
          lines.push('已记录运动数据。');
          break;
        case 'set_exercise_feeling':
          lines.push('已记录运动感受。');
          break;
        case 'record_meal_expense':
        case 'record_other_expense':
          lines.push('已记录花费。');
          break;
        case 'update_important_info':
          lines.push('已更新重要信息。');
          break;
        case 'update_day_reflection':
          lines.push('已更新今日复盘。');
          break;
        default:
          break;
      }
    }

    return lines.join('\n');
  }

  /**
   * 从 DB 加载最近的对话构建 LLM 上下文
   */
  private async buildLLMContext(userId: string): Promise<LLMMessage[]> {
    const recentMessages = (await this.prisma.agentMessage.findMany({
      where: {
        userId,
        OR: [
          { role: { in: ['user', 'assistant', 'action_result'] } },
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
      } else if (message.role === 'assistant' || message.role === 'action_result' || message.role === 'confirm') {
        contextMessages.push({
          role: 'assistant',
          content: message.content,
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
          previewReply: '我已整理好本轮待执行操作，请在上方任务区确认。',
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

    return this.createAutoWriteApplied(userId, nextToolResults);
  }

  private async handleCreateAndCompleteFallback(
    userId: string,
    message: string,
    confirmMode: boolean,
    hints: AgentMessageHints,
    toolResults: Array<{ tool: string; args?: any; result?: any }>,
  ) {
    const taskTitle = hints.createAndCompleteTaskTitle;
    if (!taskTitle) {
      return null;
    }

    if (
      hints.wakeUpTime
      || hints.explicitTaskTitles.length > 0
      || hints.pomodoro
      || hints.exerciseRecord
      || hints.exerciseFeeling
    ) {
      return null;
    }

    if (toolResults.some(({ tool, result, args }) => (
      tool === 'complete_task'
      && !result?.error
      && this.matchesTaskTitleKey(result?.title ?? args?.taskTitle ?? args?.taskName, toTaskMatchKey(taskTitle))
    ))) {
      return null;
    }

    const createdTask = this.findCreatedTaskFromToolResults(toolResults, taskTitle);
    if (!createdTask) {
      const failedCreate = toolResults.find(({ tool, result, args }) => (
        tool === 'create_task'
        && Boolean(result?.error)
        && this.matchesTaskTitleKey(result?.title ?? args?.title, toTaskMatchKey(taskTitle))
      ));
      if (failedCreate?.result?.error) {
        return this.createAssistantReply(userId, failedCreate.result.error, toolResults);
      }
    }

    if (confirmMode) {
      const summary = `创建并完成任务："${taskTitle}"`;
      const action = {
        id: `fallback-create-complete-${Date.now()}`,
        name: 'create_and_complete_task',
        args: {
          title: taskTitle,
          createArgs: { title: taskTitle },
        },
      };

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
          previewReply: '我已整理好本轮待执行操作，请在上方任务区确认。',
        };
      }

    const nextToolResults = [...toolResults];
    let taskId = createdTask?.id;
    let createdTitle = createdTask?.title || taskTitle;

    if (!taskId) {
      const createResult = await this.executeToolSafely(userId, 'create_task', { title: taskTitle });
      nextToolResults.push(createResult);
      if (createResult.result?.error) {
        return this.createAssistantReply(userId, createResult.result.error, nextToolResults);
      }
      taskId = createResult.result?.id;
      createdTitle = createResult.result?.title || taskTitle;
    }

    const completeResult = await this.executeToolSafely(userId, 'complete_task', {
      taskId,
      taskTitle: createdTitle,
    });
    nextToolResults.push(completeResult);

    if (completeResult.result?.error) {
      return this.createAssistantReply(
        userId,
        `任务“${createdTitle}”已创建，但标记完成失败：${completeResult.result.error}`,
        nextToolResults,
      );
    }

    return this.createAutoWriteApplied(userId, nextToolResults);
  }

  private async handleReflectionFallback(
    userId: string,
    message: string,
    llmReply: string,
    toolResults: Array<{ tool: string; args?: any; result?: any }>,
  ) {
    // 触发条件：用户意图是写复盘，LLM 已查了今日数据，但没调 update_day_reflection
    if (!this.isReflectionIntentMessage(message)) {
      return null;
    }
    const hasDataQuery = toolResults.some(({ tool }) =>
      ['get_today_summary', 'get_today_tasks', 'get_today_exercise', 'get_today_expenses'].includes(tool)
    );
    if (!hasDataQuery) {
      return null;
    }
    if (toolResults.some(({ tool }) => tool === 'update_day_reflection')) {
      return null;
    }
    // LLM 输出的文字就是复盘内容，直接保存
    const reflectionText = (llmReply || '').trim();
    if (!reflectionText) {
      return null;
    }

    let saveResult: any;
    try {
      saveResult = await this.agentToolsService.executeTool(userId, 'update_day_reflection', {
        dayReflection: reflectionText,
      });
    } catch (error) {
      saveResult = { error: error.message || 'Tool execution failed' };
    }

    const nextToolResults = [
      ...toolResults,
      { tool: 'update_day_reflection', args: { dayReflection: reflectionText }, result: saveResult },
    ];

    if (saveResult?.error) {
      return this.createAssistantReply(userId, `复盘内容已生成，但保存失败：${saveResult.error}`, nextToolResults);
    }

    return this.createAutoWriteApplied(userId, nextToolResults);
  }

  private isSimpleCompletionMessage(message: string, hints: AgentMessageHints) {
    if (
      !hints.completionTaskTitle
      || hints.createAndCompleteTaskTitle
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

  private matchesTaskTitleKey(value: unknown, expectedKey: string) {
    if (!expectedKey || typeof value !== 'string') {
      return false;
    }

    return toTaskMatchKey(value) === expectedKey;
  }

  private findCreatedTaskFromToolResults(
    toolResults: Array<{ tool: string; args?: any; result?: any }>,
    taskTitle: string,
  ) {
    const expectedKey = toTaskMatchKey(taskTitle);

    for (const toolResult of toolResults) {
      if (toolResult.result?.error) {
        continue;
      }

      if (toolResult.tool === 'create_task') {
        const title = toolResult.result?.title || toolResult.args?.title;
        if (this.matchesTaskTitleKey(title, expectedKey)) {
          return {
            id: toolResult.result?.id,
            title: toolResult.result?.title || toolResult.args?.title || taskTitle,
          };
        }
      }

      if (toolResult.tool === 'create_tasks') {
        const created = Array.isArray(toolResult.result?.created) ? toolResult.result.created : [];
        const matched = created.find((task: any) => this.matchesTaskTitleKey(task?.title, expectedKey));
        if (matched) {
          return {
            id: matched.id,
            title: matched.title,
          };
        }
      }
    }

    return null;
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
      if (this.isMorningPlanningMessage(message)) {
        // 晨间规划场景：先做任务编排和用户确认，最后再调 start_day
        notes.push(`检测到起床时间 ${hints.wakeUpTime}，且用户提供了时间段安排。请先按【晨间规划流程】分析时间段、列出全天任务计划并让用户确认；用户确认后再调用 start_day({"wakeUpTime":"${hints.wakeUpTime}","dayStart":"..."}) 开启今日，同时用 create_tasks 批量创建任务。不要在规划前就调用 start_day。`);
      } else {
        notes.push(`检测到起床时间 ${hints.wakeUpTime}。调用 start_day 时必须把 wakeUpTime 设为这个值，不要把起床时间原文写进 dayStart。`);
      }
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

    if (hints.createAndCompleteTaskTitle) {
      notes.push(`检测到链式任务意图：先创建任务"${hints.createAndCompleteTaskTitle}"，再立刻标记为完成。不要只创建不完成；如果 create_task 成功，应继续调用 complete_task，并优先使用新任务返回的 taskId。`);
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
      notes.push(`检测到运动记录：${hints.exerciseRecord.exerciseName} ${hints.exerciseRecord.value}。优先调用 record_exercise，参数应为 exerciseName="${hints.exerciseRecord.exerciseName}"、value=${hints.exerciseRecord.value}，并自行补充合适的 emoji 和 unit（如"次"、"km"、"分钟"）。`);
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
        const matched = await this.agentToolsService.resolveTodayPendingTask(userId, hints.pomodoro.taskTitle);
        if (matched.status === 'matched' && matched.match) {
          notes.push(`番茄目标任务已匹配到今日未完成任务：taskId="${matched.match.taskId}"，title="${matched.match.taskTitle}"。调用 start_pomodoro 时优先传 taskId。`);
        } else if (matched.status === 'ambiguous') {
          notes.push(`番茄目标任务 "${hints.pomodoro.taskTitle}" 在今日未完成任务中存在歧义，候选有：${matched.candidates.map(candidate => `"${candidate.taskTitle}"`).join('、')}。不要猜测绑定，优先向用户澄清。`);
        } else {
          const allPending = await this.prisma.task.findMany({
            where: { userId, isCompleted: false },
            select: { id: true, title: true },
          });
          if (allPending.length > 0) {
            const taskList = allPending.map(t => t.title).join('、');
            notes.push('番茄目标任务 "' + hints.pomodoro.taskTitle + '" 未精确匹配到今日任务。今日待完成任务：' + taskList + '。请用语义判断是否与其中某项匹配（考虑简称/全称、部分重叠），如果可以则传 taskId；确实无法匹配才传 taskTitle="' + hints.pomodoro.taskTitle + '"、createTaskIfMissing=true。');
          } else {
            notes.push('番茄目标任务候选为 "' + hints.pomodoro.taskTitle + '"。今日没有待完成任务，直接传 taskTitle="' + hints.pomodoro.taskTitle + '"、createTaskIfMissing=true。');
          }
        }
      }
    }

    // 复盘：用户明确要写复盘时，必须先查数据再调用 update_day_reflection 保存
    if (this.isReflectionIntentMessage(message)) {
      notes.push('用户要求写今日复盘。流程：① 调用 get_today_summary 获取数据 ② 根据数据生成复盘文字 ③ 必须调用 update_day_reflection({ dayReflection: "..." }) 将复盘保存，不要只输出文字而不保存。');
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
          return `- record_exercise: ${toolCall.args?.emoji ?? ''}${toolCall.args?.exerciseName ?? ''} ${toolCall.args?.value ?? ''}${toolCall.args?.unit ?? ''}`;
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
        return `"${result?.title || args.title}"${args.subject ? ` [${args.subject}]` : ''}${args.estimatedHours ? ` 预估${args.estimatedHours}h` : ''}`;
      case 'create_and_complete_task':
        return `"${result?.title || args.title}"`;
      case 'create_tasks':
        return Array.isArray(args.titles) ? args.titles.map((title: string) => `"${title}"`).join('、') : '{}';
      case 'complete_task': {
        const taskTitle =
          result?.title ||
          (typeof args.taskTitle === 'string' && args.taskTitle
            ? args.taskTitle
            : undefined) ||
          (typeof args.taskName === 'string' && args.taskName
            ? args.taskName
            : undefined) ||
          (typeof args.taskId === 'string' && args.taskId
            ? (await this.agentToolsService.getTaskById(userId, args.taskId))?.title
            : undefined);
        if (taskTitle) {
          return `"${taskTitle}"`;
        }
        return typeof args.taskId === 'string' && args.taskId ? `任务ID ${args.taskId}` : '未指定任务';
      }
      case 'start_pomodoro': {
        const isCountUp = args.isCountUpMode === true;
        const durationLabel = isCountUp ? '正计时' : `${args.duration || 25}分钟`;
        return `${durationLabel}${await this.formatTaskReference(userId, args, result)}${args.createTaskIfMissing ? ' (不存在则自动创建)' : ''}`;
      }
      case 'stop_pomodoro':
        return '停止当前番茄钟';
      case 'record_meal_expense': {
        const labels: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
        return `${labels[args.category] || args.category} ${args.amount}元`;
      }
      case 'record_other_expense':
        return `${args.description} ${args.amount}元`;
      case 'record_exercise':
        return `${args.emoji ?? ''}${args.exerciseName} ${args.value}${args.unit ?? ''}`;
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
  private normalizeMemoryType(type: string) {
    const normalized = String(type || 'fact').trim();
    const allowed = new Set(['preference', 'fact', 'goal', 'habit', 'constraint', 'procedure']);
    return allowed.has(normalized) ? normalized : 'fact';
  }

  private normalizeMemoryStatus(status: string) {
    const normalized = String(status || 'active').trim();
    const allowed = new Set(['active', 'archived']);
    return allowed.has(normalized) ? normalized : 'active';
  }

  private extractImportantInfoIntentContent(message: string) {
    const match = message.match(/(?:\u8bb0\u5f55|\u4fdd\u5b58|\u91cd\u8981\u4fe1\u606f|\u628a|\u5c06)(?:\u91cd\u8981\u4fe1\u606f|\u91cd\u8981\u4e8b\u9879|\u5173\u952e\u4fe1\u606f)?[\uff1a:\s]*(.+)$/u);
    return match?.[1]?.trim() || '';
  }

  private extractDayReflectionIntentContent(message: string) {
    const match = message.match(/(?:\u5199|\u66f4\u65b0|\u8bb0\u5f55)?(?:\u4eca\u65e5\u590d\u76d8|\u4eca\u5929\u590d\u76d8|\u590d\u76d8)[\uff1a:\s]*(.+)$/u);
    return match?.[1]?.trim() || '';
  }

  private isReflectionIntentMessage(message: string) {
    return /(?:\u4eca\u65e5\u590d\u76d8|\u4eca\u5929\u590d\u76d8|\u5199\u590d\u76d8|\u66f4\u65b0\u590d\u76d8|\u8bb0\u5f55\u590d\u76d8|\u603b\u7ed3\u4eca\u5929)/u.test(message);
  }

  private isExplicitMemoryIntent(message: string) {
    return /^(?:\u8bf7\u4f60)?(?:\u4ee5\u540e)?(?:\u8bb0\u4f4f|\u5fd8\u6389|\u5fd8\u8bb0|\u6211\u7684\u504f\u597d|\u4ee5\u540e\u6211|\u6211\u4e60\u60ef|\u6211\u559c\u6b22)/u.test(message.trim());
  }

  private extractMealExpenseIntents(message: string) {
    const categories = [
      { category: 'breakfast', pattern: /\u65e9\u9910(?:\u82b1\u4e86|\u82b1\u8d39|\u6d88\u8d39|\u7528\u4e86|\u5403\u4e86)?\s*(\d+(?:\.\d+)?)\s*\u5143?/u },
      { category: 'lunch', pattern: /\u5348\u9910(?:\u82b1\u4e86|\u82b1\u8d39|\u6d88\u8d39|\u7528\u4e86|\u5403\u4e86)?\s*(\d+(?:\.\d+)?)\s*\u5143?/u },
      { category: 'dinner', pattern: /\u665a\u9910(?:\u82b1\u4e86|\u82b1\u8d39|\u6d88\u8d39|\u7528\u4e86|\u5403\u4e86)?\s*(\d+(?:\.\d+)?)\s*\u5143?/u },
    ] as const;

    return categories.flatMap(({ category, pattern }) => {
      const match = message.match(pattern);
      if (!match?.[1]) {
        return [];
      }
      return [{ category, amount: Number(match[1]) }];
    });
  }

  /**
   * 根据当前对话状态计算建议回复（用于前端 chips）。
   * 出口越纯越好——只看 session 状态和 reply 文本，不做副作用。
   */
  private async computeReplySuggestions(userId: string, replyText: string): Promise<ReplySuggestion[]> {
    try {
      const session = await this.agentSessionService.getSession(userId);

      // 场景1: 晨间规划提案阶段，用户该回什么——给确认/调整/补充
      if (session?.flow === 'morning_planning' && session.state === 'plan_proposed') {
        return [
          { label: '✅ 就这样', send: '好的' },
          { label: '✏️ 调整一下', send: '调整一下：', hint: '点完后请补充具体调整内容' },
          { label: '➕ 再加一个', send: '再加一个任务：', hint: '点完后请写任务名' },
        ];
      }

      // 场景2: AI 文本里检测到典型的反问/确认句，给二选一
      const lowered = replyText.toLowerCase();
      if (/要(开始|来一个|来个).*番茄/u.test(replyText) || /要不要.*番茄/u.test(replyText)) {
        return [
          { label: '🍅 开始番茄', send: '开始第一个番茄钟' },
          { label: '⏸ 暂时不用', send: '暂时不用，先这样' },
        ];
      }
      if (/要不要.*复盘|复盘.*吗/u.test(replyText)) {
        return [
          { label: '📝 帮我写复盘', send: '帮我写一下今天的复盘' },
          { label: '⏸ 明天再说', send: '明天再说吧' },
        ];
      }
    } catch (err) {
      // suggestions 计算失败不应影响主流程
      this.logger.warn(`computeReplySuggestions failed: ${(err as Error).message}`);
    }
    return [];
  }

  /**
   * 空状态欢迎建议（前端在 messages.length === 0 时使用）。
   * 通过单独接口返回，避免每次 reply 都计算空状态。
   */
  async getEmptyStateSuggestions(_userId: string): Promise<ReplySuggestion[]> {
    return [
      { label: '🌅 开启今天', send: '开启今天，' , hint: '继续输入你今天的安排，例如"7:30起床，上午写代码，下午开会"' },
      { label: '📋 查看任务', send: '今天有哪些任务' },
      { label: '🍅 开个番茄', send: '帮我开个25分钟番茄' },
      { label: '📝 记录复盘', send: '帮我写一下今天的复盘' },
    ];
  }

  private resolveFirstRoundToolChoice(_hints: AgentMessageHints): any {
    // deepseek-reasoner (v4-pro / R1\u7cfb\u5217) \u4e0d\u652f\u6301\u5177\u540d tool_choice\uff0c\u7edf\u4e00\u7528 'auto'
    // \u610f\u56fe\u5f15\u5bfc\u6539\u4e3a\u5728 structuredGuidance \u6587\u672c\u4e2d\u5b9e\u73b0\uff08\u5df2\u9644\u52a0\u5230\u7528\u6237\u6d88\u606f\uff09
    return 'auto';
  }

  private looksLikeStartDayIntent(message: string) {
    return /(?:\u5f00\u542f\u4eca\u5929|\u5f00\u59cb\u4eca\u5929|\u4eca\u65e5\u5f00\u542f|\u4eca\u5929\u8ba1\u5212|\u4eca\u65e5\u8ba1\u5212|\u8d77\u5e8a)/u.test(message);
  }

  /**
   * \u4ece LLM \u4e4b\u524d\u63d0\u51fa\u7684\u5168\u5929\u8ba1\u5212\u91cc\uff0c\u6311\u4e00\u4e2a\u7b80\u77ed\u7684\u4e00\u53e5\u8bdd\u4e3b\u9898\u4f5c dayStart\u3002
   * \u7b80\u5355\u7b56\u7565\uff1a\u53d6\u8ba1\u5212\u91cc\u6240\u6709\u4efb\u52a1\u540d\u62fc\u63a5\uff0c\u622a\u5230 30 \u5b57\u4ee5\u5185\u3002
   */
  private deriveDayStartFromPlan(plan?: string): string | null {
    if (!plan) return null;
    // \u62bd\u53d6\u6240\u6709 emoji+\u6587\u5b57\u3001\u52a0\u7c97\u4efb\u52a1\uff08\ud83d\udd34 \u7533\u8bba\u7ec3\u4e60\u3001\ud83d\udcdd \u8d44\u6599\u5206\u6790 \u7b49\uff09
    const matches = plan.match(/(?:\ud83d\udd34|\ud83d\udcbb|\ud83d\udcda|\ud83d\udcdd|\ud83c\udf45)\s*([^\s\uff08(\n,\uff0c\u3002\u3001]+)/gu);
    if (matches && matches.length > 0) {
      const titles = matches.map(m => m.replace(/^[\s\S]*?(?:\ud83d\udd34|\ud83d\udcbb|\ud83d\udcda|\ud83d\udcdd|\ud83c\udf45)\s*/u, '').slice(0, 6));
      const joined = titles.slice(0, 3).join(' + ');
      if (joined.length > 0) return joined.length > 30 ? joined.slice(0, 28) + '..' : joined;
    }
    return null;
  }

  /**
   * \u5224\u65ad\u7528\u6237\u6d88\u606f\u662f\u5426\u5728\u786e\u8ba4 AI \u7684\u8ba1\u5212\u65b9\u6848\uff08plan_proposed \u72b6\u6001\u4e0b\u7528\uff09\u3002
   * \u89c4\u5219\uff1a\u542b\u660e\u663e\u786e\u8ba4\u5173\u952e\u8bcd\uff0c\u4e14\u4e0d\u542b\u4efb\u4f55\u8c03\u6574/\u5426\u5b9a\u5173\u952e\u8bcd\u3002
   */
  private isPlanConfirmation(message: string) {
    const trimmed = message.trim();
    if (trimmed.length === 0) return false;
    // \u542b\u8c03\u6574/\u5426\u5b9a\u5173\u952e\u8bcd\u65f6\u4e00\u5f8b\u4e0d\u7b97\u786e\u8ba4
    if (/(\u518d\u52a0|\u518d\u6765|\u52a0\u4e00\u4e2a|\u65b0\u589e|\u6539\u6210|\u6539\u4e3a|\u8c03\u6574|\u4e0d\u8981|\u4e0d\u884c|\u6362\u6210|\u5220\u6389|\u53bb\u6389|\u4e0d\u5bf9|\u52a0\u4e0a|\u53e6\u5916)/u.test(trimmed)) return false;
    // \u77ed\u53e5\u5b8c\u5168\u5339\u914d\u786e\u8ba4\u8bcd
    if (/^(?:\u597d(?:\u7684|\u554a|\u5440)?|\u53ef\u4ee5|\u786e\u8ba4|\u5bf9|\u6ca1\u95ee\u9898|\u540c\u610f|ok|OK|\u55ef|\u5c31\u8fd9\u6837(?:\u5b89\u6392)?|\u5f00\u59cb\u5427|\u521b\u5efa\u5427|\u521b\u5efa\u4efb\u52a1|\u6ca1\u6bdb\u75c5|\u884c|\ud83d\udc4d)[!\uff01\u3002\s]*$/u.test(trimmed)) return true;
    // \u542b\u786e\u8ba4\u5173\u952e\u8bcd\u4e14\u65e0\u8c03\u6574\u5173\u952e\u8bcd\uff08\u5df2\u5728\u524d\u9762\u8fc7\u6ee4\uff09
    return /(?:\u597d\u7684|\u53ef\u4ee5|\u6ca1\u95ee\u9898|\u5c31\u8fd9\u6837|\u5f00\u59cb\u5427|\u521b\u5efa\u5427|\u6267\u884c\u5427|\u521b\u5efa\u4efb\u52a1)/u.test(trimmed);
  }

  private isMorningPlanningMessage(message: string) {
    // \u7528\u6237\u63d0\u4f9b\u4e86\u65f6\u95f4\u6bb5\u5b89\u6392\uff08\u4e0a\u5348X-Y\u3001\u4e0b\u5348X-Y\u3001\u665a\u4e0aX-Y\uff09\uff0c\u8fd9\u662f\u6668\u95f4\u89c4\u5212\u573a\u666f
    // \u65f6\u95f4\u683c\u5f0f\uff1a8\u70b9\u30018:00\u30018-11:30\u3001\u4e09\u70b9\u3001\u516b\u70b9\u534a \u7b49\uff0c\u5141\u8bb8\u7701\u7565\u5206\u949f\u90e8\u5206\uff0c\u652f\u6301\u4e2d\u6587\u6570\u5b57
    const TIME = /(?:[\u96f6\u4e00\u4e8c\u4e24\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+|\d{1,2})(?:[:.\u70b9]\d{0,2}|\u534a)?/u.source;
    const hasTimeSlots = new RegExp(
      `(?:\u4e0a\u5348|\u4e0b\u5348|\u665a\u4e0a|\u65e9\u4e0a|\u4e2d\u5348)\\s*${TIME}\\s*[-~\uff5e\u5230\u81f3]\\s*${TIME}`, 'u'
    ).test(message);
    const hasScheduleKeywords = /(?:\u65f6\u95f4\u6bb5|\u65f6\u95f4\u5b89\u6392|\u53ef\u4ee5\u5b89\u6392|\u53ef\u7528\u65f6\u95f4|\u7a7a\u95f2\u65f6\u95f4|\u5e2e\u6211\u5b89\u6392|\u5e2e\u6211\u89c4\u5212|\u5e2e\u6211\u6392|\u4efb\u52a1\u5b89\u6392)/u.test(message);
    return hasTimeSlots || hasScheduleKeywords;
  }

  private isSimplePomodoroStartIntent(message: string) {
    const normalized = message.replace(/\s+/gu, '');
    return /^(?:\u5f00\u542f|\u5f00\u59cb|\u6765\u4e2a)?(?:\u4e00\u4e2a)?(?:\u756a\u8304\u949f|\u756a\u8304|\u4e13\u6ce8)(?:\u5427)?$/u.test(normalized);
  }

  private isPomodoroCandidateIntentQuery(message: string) {
    return /(?:\u756a\u8304\u949f|\u756a\u8304|\u4e13\u6ce8)/u.test(message)
      && /(?:\u7ed1\u5b9a\u54ea\u4e9b\u4eca\u65e5\u4efb\u52a1|\u7ed1\u5b9a\u4ec0\u4e48\u4eca\u65e5\u4efb\u52a1|\u53ef\u4ee5\u7ed1\u5b9a\u54ea\u4e2a\u4efb\u52a1|\u80fd\u7ed1\u5b9a\u54ea\u4e9b|\u5019\u9009|\u4efb\u52a1\u5019\u9009|\u5173\u8054\u54ea\u4e2a)/u.test(message);
  }

  private extractImportantInfoContent(message: string) {
    const match = message.match(/(?:添加|更新|记录|记一下)(?:重要信息|重要的事|重要事项)[：:\s]*(.+)$/u);
    return match?.[1]?.trim() || '';
  }

  private extractDayReflectionContent(message: string) {
    const match = message.match(/(?:写|更新|记录)?(?:今日复盘|今天复盘|复盘)[：:\s]*(.+)$/u);
    return match?.[1]?.trim() || '';
  }

  private isReflectionMessage(message: string) {
    return /(?:今日复盘|今天复盘|复盘)/u.test(message);
  }

  private isExplicitMemoryMessage(message: string) {
    return /^(?:请你)?(?:帮我)?(?:记住|忘掉|忘记|删除记忆|不要记住)/u.test(message.trim());
  }

  private extractMealExpenses(message: string) {
    const categories = [
      { category: 'breakfast', pattern: /早餐(?:花了|花费|消费|用了)?\s*(\d+(?:\.\d+)?)\s*元/u },
      { category: 'lunch', pattern: /午餐(?:花了|花费|消费|用了)?\s*(\d+(?:\.\d+)?)\s*元/u },
      { category: 'dinner', pattern: /晚餐(?:花了|花费|消费|用了)?\s*(\d+(?:\.\d+)?)\s*元/u },
    ] as const;

    return categories.flatMap(({ category, pattern }) => {
      const match = message.match(pattern);
      if (!match?.[1]) {
        return [];
      }
      return [{ category, amount: Number(match[1]) }];
    });
  }

  private extractDayStartContent(message: string, hints: AgentMessageHints) {
    const withoutWakeUpTime = hints.wakeUpTime
      ? message.replace(/\d{1,2}(?::|点)\d{0,2}\s*(?:起床|醒来|起来)?/u, '').trim()
      : message.trim();
    return withoutWakeUpTime || undefined;
  }

  private looksLikeStartDayMessage(message: string) {
    return /(?:开启今天|开启今日|新的一天|今天计划|今日计划|今天安排|今日安排|起床)/u.test(message);
  }

  private isSimplePomodoroStart(message: string) {
    const normalized = message.replace(/\s+/gu, '');
    return /^(?:帮我|给我|请)?(?:开启|开|开始)(?:一个|一轮)?(?:番茄钟|番茄|专注)(?:计时)?$/u.test(normalized);
  }

  private isPomodoroCandidateQuery(message: string) {
    return /(?:番茄|专注|计时)/u.test(message)
      && /(?:哪个任务|哪些任务|可绑定|可以绑定|候选|看看|查看|列出)/u.test(message);
  }

  /**
   * 主动触发：根据触发类型生成 AI 消息
   */
  async handleProactive(
    userId: string,
    trigger: string,
    context?: { taskId?: string; taskTitle?: string; pomodoroCount?: number },
  ) {
    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL', 'GLM-4-Flash');
    const timeout = parseInt(this.configService.get<string>('AI_TIMEOUT', '60000'), 10);

    if (!apiUrl || !apiKey) {
      throw new Error('AI_API_URL and AI_API_KEY must be configured');
    }

    // 根据 trigger 构建专属 system prompt
    const systemPrompt = this.buildProactiveSystemPrompt(trigger);

    // 加载触发相关的上下文数据
    const contextData = await this.buildProactiveContext(userId, trigger, context);
    const contextPrompt = contextData ? [{ role: 'system' as const, content: contextData }] : [];

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...contextPrompt,
      {
        role: 'user',
        content: trigger === 'morning'
          ? '请向用户发送晨间问候，引导开启今天。'
          : trigger === 'pomodoro_done'
            ? `用户刚完成一个番茄钟。请发送一条简短的消息。`
            : trigger === 'task_done'
              ? `用户刚完成一个任务。请发送一条简短的消息。`
              : '请向用户发送晚间复盘引导。',
      },
    ];

    const response = await axios.post(
      apiUrl,
      { model, messages },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout,
      },
    );

    const assistantContent = response.data?.choices?.[0]?.message?.content || '';

    // 存入 agent_messages，标记为主动消息（不进入后续 LLM 上下文）
    const saved = await this.prisma.agentMessage.create({
      data: {
        userId,
        role: 'assistant',
        content: assistantContent,
        toolCalls: { proactive: true },
      },
    });

    return {
      id: saved.id,
      reply: assistantContent,
      trigger,
      type: 'reply' as const,
    };
  }

  /**
   * 主动触发（流式）：使用 DeepSeek SSE 实时流式生成消息
   */
  async handleProactiveStream(
    userId: string,
    trigger: string,
    context: { taskId?: string; taskTitle?: string; pomodoroCount?: number } | undefined,
    callbacks: {
      onStart: (messageId: string) => void;
      onToken: (token: string) => void;
    },
  ): Promise<{ id: string; reply: string }> {
    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL', 'deepseek-v4-flash');
    const timeout = parseInt(this.configService.get<string>('AI_TIMEOUT', '60000'), 10);

    if (!apiUrl || !apiKey) {
      throw new Error('AI_API_URL and AI_API_KEY must be configured');
    }

    const saved = await this.prisma.agentMessage.create({
      data: {
        userId,
        role: 'assistant',
        content: '',
        toolCalls: { proactive: true },
      },
    });

    callbacks.onStart(saved.id);

    const systemPrompt = this.buildProactiveSystemPrompt(trigger);
    const contextData = await this.buildProactiveContext(userId, trigger, context);
    const contextPrompt = contextData ? [{ role: 'system' as const, content: contextData }] : [];

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...contextPrompt,
      {
        role: 'user',
        content: trigger === 'morning'
          ? '请向用户发送晨间问候，引导开启今天。'
          : trigger === 'pomodoro_done'
            ? '用户刚完成一个番茄钟。请发送一条简短的消息。'
            : trigger === 'task_done'
              ? '用户刚完成一个任务。请发送一条简短的消息。'
              : '请向用户发送晚间复盘引导。',
      },
    ];

    const response = await axios.post(
      apiUrl,
      {
        model,
        messages,
        stream: true,
        temperature: 1.0,
        top_p: 1.0,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout,
        responseType: 'stream',
      },
    );

    let fullContent = '';

    return new Promise((resolve, reject) => {
      let sseBuffer = '';

      response.data.on('data', (chunk: Buffer) => {
        sseBuffer += chunk.toString();
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              callbacks.onToken(delta);
            }
          } catch {
            // 跳过不完整的 JSON 行
          }
        }
      });

      response.data.on('end', async () => {
        await this.prisma.agentMessage.update({
          where: { id: saved.id },
          data: { content: fullContent },
        });
        if (trigger === 'morning') {
          await this.agentSessionService.startMorningSession(userId, saved.id);
        }
        resolve({ id: saved.id, reply: fullContent });
      });

      response.data.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * 构建主动触发专用的 system prompt
   */
  private buildProactiveSystemPrompt(trigger: string): string {
    const basePrompt = `你是 LifeTracker 的专属陪伴助手。你现在需要主动向用户发送一条消息。

【核心规则】
- 用中文回复，简洁、温暖、有情绪
- 消息长度控制在 2-4 句话，不要长篇大论
- 像一个关心用户的朋友，不是冷冰冰的工具
- 不要使用任何工具调用，只生成纯文本消息
- 不要用"你可以..."、"建议你..."这种说教语气
- 使用自然的语气，可以带一点轻松和鼓励`;

    switch (trigger) {
      case 'morning':
        return `${basePrompt}

【场景】晨间问候与规划引导
用户刚打开 LifeTracker，你需要主动发起一段温暖而有用的晨间对话，帮用户完成今天的规划。

【你的核心目标】
了解时间安排 → 整合学习计划+特殊任务 → 列出全天计划 → 用户确认 → 批量创建任务 → 询问是否开始番茄钟

【当前这条消息你要做的事】
1. 用自然温暖的方式打招呼，可以根据当前时间微调语气
2. 如果上下文中有活跃学习计划，自然地提到它，但不要强制用户按计划执行
3. 询问用户今天的空闲时间安排，例如"今天大概几点到几点有空？上午、下午、晚上哪个时段比较空？"
4. 询问是否有特殊安排，例如"今天有什么特别的事情吗？比如模考、运动或者其他安排？"
5. 语气要像朋友聊天，自然温暖，不要像填表格

【重要行为规则】
- 不要在这条消息里直接创建任务或列计划 — 你还没收集到足够的信息
- 如果上下文显示用户之前已经说过今天的安排，可以直接列出计划方案并询问确认
- 如果用户没有提到时间安排，一定要先问
- 消息保持3-5句话，不要长篇大论
- 不要用"你可以..."、"建议你..."这种说教语气
- 结束时留一个开放式问题，让用户愿意回复

【后续对话流程（在用户回复后通过聊天完成）】
1. 用户分享了时间安排 → 分析时间段，结合学习计划和特殊任务，列出全天计划表
2. 用户没分享时间 → 再次友好地询问，不要跳过
3. 用户始终不愿说具体时间 → 灵活应变，基于学习计划建议默认方案
4. 列出计划后务必先让用户确认，不要直接创建任务
5. 用户确认后，用create_tasks批量创建所有任务
6. 创建完成后，主动询问："要开始第一个番茄钟吗？"
7. 特殊安排（模考、运动等）必须纳入全天计划表中`;

      case 'pomodoro_done':
        return `${basePrompt}

【场景】番茄钟完成
用户刚完成了一个番茄钟（专注时段）。根据上下文中的番茄完成次数和任务信息，选择合适的语气：
- 第1个番茄：祝贺并简单问候
- 第3个番茄：提醒休息和活动一下
- 其他：简短鼓励

【重要】绝对不要在番茄完成后提复盘、总结、或询问"要不要结束今天"这类问题。用户还在专注工作中，只给轻松的鼓励。

消息要非常简短（1-2句话），像即时通讯的消息一样轻松。`;

      case 'task_done':
        return `${basePrompt}

【场景】任务完成
用户刚完成了一个任务。根据上下文判断：
- 还有任务且用户在番茄进行中：只发简短祝贺，绝对不要提复盘或询问任何问题，不要打扰专注状态
- 还有任务且无番茄进行中：简短祝贺 + 提示还剩几个
- 全部完成 + 当前时间较晚（21点后）：恭喜 + 询问是否需要复盘或调整明天安排
- 全部完成 + 当前时间较早：简短恭喜即可，不要强制引导复盘

消息要非常简短（1-2句话），不要过度夸奖。`;

      case 'evening':
        return `${basePrompt}

【场景】晚间复盘
一天结束，用户准备复盘。你需要：
1. 总结今天的数据（学习时间、完成的任务数）
2. 引导用户说说今天的收获
3. 用温暖的方式结束

语气要温和、有总结感，不要催促。`;

      default:
        return basePrompt;
    }
  }

  /**
   * 构建主动触发的上下文数据
   */
  private async buildProactiveContext(
    userId: string,
    trigger: string,
    context?: { taskId?: string; taskTitle?: string; pomodoroCount?: number },
  ): Promise<string | null> {
    const today = new Date().toISOString().slice(0, 10);
    const parts: string[] = [];

    try {
      // 获取今日日常数据
      const dailyData = await this.prisma.dailyData.findUnique({
        where: { userId_date: { userId, date: today } },
      });

      // 通用上下文：用户画像
      const { contextText: profileContext } = await this.agentProfileService.buildProfileContext(userId);
      if (profileContext) {
        parts.push(profileContext);
      }

      if (trigger === 'morning') {
        parts.push(`当前日期: ${today}`);
        parts.push(`当前时间: ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`);
        if (dailyData?.dayStart) {
          parts.push(`今天的计划: ${dailyData.dayStart}`);
        }

        // 获取今日学习计划
        const studyPlanSuggestion = await this.studyPlanService.getTodaySuggestion(userId);
        if (studyPlanSuggestion.plan) {
          parts.push(`活跃学习计划: "${studyPlanSuggestion.plan.title}"`);
          if (studyPlanSuggestion.plan.examName) {
            parts.push(`考试名称: ${studyPlanSuggestion.plan.examName}`);
          }
          if (studyPlanSuggestion.plan.examDate) {
            parts.push(`考试日期: ${studyPlanSuggestion.plan.examDate}`);
          }
          if (studyPlanSuggestion.slots.length > 0) {
            const slotLines = studyPlanSuggestion.slots.map(s =>
              `  ${s.subjectName}: ${s.chapterTitle} (预计${s.plannedHours}h)`
            );
            parts.push(`今日学习安排:\n${slotLines.join('\n')}`);
          } else {
            parts.push('今日暂无学习安排');
          }
        }

        // 获取当前目标
        const goal = await this.prisma.userGoal.findFirst({
          where: { userId, isActive: true },
          select: { goalName: true },
        });
        if (goal) {
          parts.push(`用户当前目标: ${goal.goalName}`);
        }

        // 任务列表
        const allTasks = await this.prisma.task.findMany({
          where: { userId },
          select: { id: true, title: true, isCompleted: true },
          orderBy: { sortOrder: 'asc' },
        });
        const completedTasks = allTasks.filter(t => t.isCompleted);
        const pendingTasks = allTasks.filter(t => !t.isCompleted);
        if (allTasks.length > 0) {
          const taskLines = allTasks.map(t =>
            `  ${t.isCompleted ? '✅' : '⬜'} ${t.title}`
          );
          parts.push(`今日任务 (${completedTasks.length}/${allTasks.length} 已完成):\n${taskLines.join('\n')}`);
        } else {
          parts.push('今日暂无任务');
        }
      }

      if (trigger === 'pomodoro_done') {
        const pomodoroCount = context?.pomodoroCount ?? (dailyData?.pomodoroCount ?? 0);
        parts.push(`今日第 ${pomodoroCount} 个番茄钟`);

        let taskTitle = context?.taskTitle;
        if (!taskTitle && context?.taskId) {
          const task = await this.prisma.task.findFirst({
            where: { id: context.taskId, userId },
            select: { title: true },
          });
          taskTitle = task?.title;
        }
        if (taskTitle) {
          parts.push(`关联任务: "${taskTitle}"`);
        }

        const exerciseCount = await this.prisma.exerciseLog.count({
          where: { userId, date: today },
        });
        parts.push(`今日运动记录: ${exerciseCount > 0 ? '已记录' : '未记录'}`);

        const allTasks = await this.prisma.task.findMany({
          where: { userId },
          select: { id: true, title: true, isCompleted: true },
        });
        const completedCount = allTasks.filter(t => t.isCompleted).length;
        if (allTasks.length > 0) {
          parts.push(`任务进度: ${completedCount}/${allTasks.length} 已完成`);
          const pendingTitles = allTasks.filter(t => !t.isCompleted).map(t => t.title);
          if (pendingTitles.length > 0) {
            parts.push(`剩余任务: ${pendingTitles.join('、')}`);
          }
        }

        if (dailyData) {
          parts.push(`今日累计学习: ${dailyData.totalMinutes || 0} 分钟`);
        }
      }

      if (trigger === 'task_done') {
        const currentHour = new Date().getHours();
        parts.push(`当前时间: ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`);
        parts.push(currentHour >= 21 ? '当前时段: 较晚（21点后）' : '当前时段: 白天/傍晚');

        let taskTitle = context?.taskTitle;
        if (!taskTitle && context?.taskId) {
          const task = await this.prisma.task.findFirst({
            where: { id: context.taskId, userId },
            select: { title: true },
          });
          taskTitle = task?.title;
        }
        if (taskTitle) {
          parts.push(`刚完成的任务: "${taskTitle}"`);
        }

        const activePomodoro = await this.prisma.pomodoroSession.findFirst({
          where: { userId, status: 'RUNNING' },
          select: { id: true },
        });
        parts.push(activePomodoro ? '番茄钟状态: 进行中（用户正在专注，不要打扰）' : '番茄钟状态: 无进行中番茄');

        const allTasks = await this.prisma.task.findMany({
          where: { userId },
          select: { id: true, title: true, isCompleted: true },
        });
        const completedCount = allTasks.filter(t => t.isCompleted).length;
        if (allTasks.length > 0) {
          parts.push(`任务进度: ${completedCount}/${allTasks.length} 已完成`);
          const pendingTitles = allTasks.filter(t => !t.isCompleted).map(t => t.title);
          if (pendingTitles.length > 0) {
            parts.push(`待完成: ${pendingTitles.join('、')}`);
          } else {
            parts.push('今日任务已全部完成！');
          }
        }

        if (dailyData) {
          parts.push(`今日已专注: ${dailyData.totalMinutes || 0} 分钟`);
          parts.push(`今日番茄数: ${dailyData.pomodoroCount || 0}`);
        }
      }

      if (trigger === 'evening') {
        if (dailyData) {
          parts.push(`今日学习时长: ${dailyData.totalMinutes || 0} 分钟`);
          parts.push(`今日番茄数: ${dailyData.pomodoroCount || 0}`);
          if (dailyData.dayReflection) {
            parts.push(`已有复盘内容: ${dailyData.dayReflection}`);
          }
        }

        const allTasks = await this.prisma.task.findMany({
          where: { userId },
          select: { id: true, title: true, isCompleted: true },
        });
        const completedCount = allTasks.filter(t => t.isCompleted).length;
        if (allTasks.length > 0) {
          const taskLines = allTasks.map(t =>
            `  ${t.isCompleted ? '✅' : '❌'} ${t.title}`
          );
          parts.push(`今日任务 (${completedCount}/${allTasks.length}):\n${taskLines.join('\n')}`);
        }

        const exerciseCount = await this.prisma.exerciseLog.count({
          where: { userId, date: today },
        });
        parts.push(`运动记录: ${exerciseCount > 0 ? '有' : '无'}`);

        // 明日学习安排
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10);
        const activePlan = await this.prisma.studyPlan.findFirst({
          where: { userId, status: 'active' },
          select: { id: true, title: true },
        });
        if (activePlan) {
          const tomorrowSlots = await this.prisma.dailyStudySlot.findMany({
            where: { userId, planId: activePlan.id, date: tomorrowStr, status: { in: ['pending', 'injected'] } },
            orderBy: { createdAt: 'asc' },
            take: 5,
          });
          if (tomorrowSlots.length > 0) {
            const slotLines = tomorrowSlots.map((s: any) => `  ${s.subjectName ?? ''}: ${s.chapterTitle ?? ''} (预计${s.plannedHours}h)`);
            parts.push(`明日学习安排（来自计划"${activePlan.title}"）:\n${slotLines.join('\n')}`);
          } else {
            parts.push('明日暂无学习安排');
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to build proactive context for ${trigger}:`, error);
    }

    if (parts.length === 0) {
      return null;
    }

    return `【当前上下文数据】\n${parts.map((p) => `- ${p}`).join('\n')}`;
  }

  async clearHistory(userId: string) {
    await this.prisma.agentMessage.deleteMany({ where: { userId } });
    return { message: '\u4f1a\u8bdd\u5386\u53f2\u5df2\u6e05\u9664' };
  }
}
