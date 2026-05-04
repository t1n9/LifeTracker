import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * AI 意图分类结果。
 * 通过一次 LLM 调用替换多个硬编码正则检测，减少维护成本且覆盖更多口语变体。
 */
export interface IntentFlags {
  /** 用户只是查今天任务/待办，没有其他操作意图 */
  isSimpleTodayTasksQuery: boolean;
  /** 用户要写/看今日复盘或总结 */
  isReflectionIntent: boolean;
  /** 用户要开启/来一个番茄钟（无复杂附加操作） */
  isSimplePomodoroStart: boolean;
  /** 用户给出了时段安排，触发晨间规划流程 */
  isMorningPlanning: boolean;
  /** 用户要开启今天/告知起床/开始新的一天 */
  isStartDay: boolean;
}

const CLASSIFIER_SYSTEM_PROMPT = `你是 LifeTracker 助手的意图分析器。
用户发来一条消息，你必须输出一个 JSON 对象，包含以下 boolean 字段（true/false）：

- isSimpleTodayTasksQuery：用户只是查看今天的任务/待办/安排，没有其他写操作意图
- isReflectionIntent：用户要写今日复盘、总结今天、回顾今天的内容
- isSimplePomodoroStart：用户只是想开启一个番茄钟，没有其他复杂操作
- isMorningPlanning：用户提供了时段安排（如"上午9-12点做X，下午2-5点做Y"），要进行晨间规划
- isStartDay：用户要开启今天、告知起床时间、或开始新的一天（不包含完整时段规划）

规则：
- 只输出 JSON，不要有任何其他内容
- isSimpleTodayTasksQuery 为 true 时，其他一般为 false（查任务是单一意图）
- isMorningPlanning 为 true 时，isStartDay 可以同时为 true（包含了起床信息）
- 消息中有明确时间段区间（X点-Y点、上午/下午+时间范围）才能触发 isMorningPlanning

示例输出：{"isSimpleTodayTasksQuery":false,"isReflectionIntent":false,"isSimplePomodoroStart":true,"isMorningPlanning":false,"isStartDay":false}`;

const DEFAULT_FLAGS: IntentFlags = {
  isSimpleTodayTasksQuery: false,
  isReflectionIntent: false,
  isSimplePomodoroStart: false,
  isMorningPlanning: false,
  isStartDay: false,
};

@Injectable()
export class AgentIntentClassifierService {
  private readonly logger = new Logger(AgentIntentClassifierService.name);

  constructor(private configService: ConfigService) {}

  async classify(message: string): Promise<IntentFlags> {
    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL', 'deepseek-v4-flash');

    if (!apiUrl || !apiKey) {
      return this.classifyWithRules(message);
    }

    try {
      const response = await axios.post(
        apiUrl,
        {
          model,
          messages: [
            { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
            { role: 'user', content: message },
          ],
          max_tokens: 80,
          temperature: 0,
          thinking: { type: 'disabled' },
          response_format: { type: 'json_object' },
        },
        {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 8000,
        },
      );

      const content = response.data?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return this.classifyWithRules(message);
      }

      const parsed = JSON.parse(content);
      return this.mergeWithRuleFallback(message, {
        isSimpleTodayTasksQuery: Boolean(parsed.isSimpleTodayTasksQuery),
        isReflectionIntent: Boolean(parsed.isReflectionIntent),
        isSimplePomodoroStart: Boolean(parsed.isSimplePomodoroStart),
        isMorningPlanning: Boolean(parsed.isMorningPlanning),
        isStartDay: Boolean(parsed.isStartDay),
      });
    } catch (err) {
      this.logger.warn(`[IntentClassifier] failed: ${(err as Error).message}, falling back to local rules`);
      return this.classifyWithRules(message);
    }
  }

  private mergeWithRuleFallback(message: string, aiFlags: IntentFlags): IntentFlags {
    const ruleFlags = this.classifyWithRules(message);
    return {
      isSimpleTodayTasksQuery: aiFlags.isSimpleTodayTasksQuery || ruleFlags.isSimpleTodayTasksQuery,
      isReflectionIntent: aiFlags.isReflectionIntent || ruleFlags.isReflectionIntent,
      isSimplePomodoroStart: aiFlags.isSimplePomodoroStart || ruleFlags.isSimplePomodoroStart,
      isMorningPlanning: aiFlags.isMorningPlanning || ruleFlags.isMorningPlanning,
      isStartDay: aiFlags.isStartDay || ruleFlags.isStartDay,
    };
  }

  private classifyWithRules(message: string): IntentFlags {
    const trimmed = message.trim();
    const normalized = trimmed.replace(/\s+/gu, '');
    const hasWriteSignals = /(?:创建|添加|完成|修改|删除|开启|开始|番茄|起床|复盘|总结|记录|花了|运动|跑步|俯卧撑|单杠)/u.test(trimmed);
    const timeText = /(?:[零一二两三四五六七八九十]+|\d{1,2})(?:[:.点]\d{0,2}|半)?/u.source;
    const hasTimeSlots = new RegExp(
      `(?:上午|下午|晚上|早上|中午)\\s*${timeText}\\s*[-~～到至]\\s*${timeText}`,
      'u',
    ).test(trimmed);

    const isSimpleTodayTasksQuery = !hasWriteSignals && (
      /^(?:帮我|给我|麻烦|请)?(?:看|查|列出|展示|告诉我)?(?:一下|一眼)?(?:今天|今日)(?:的)?(?:任务|待办|安排|计划)(?:列表|情况)?$/u.test(normalized)
      || /^(?:今天|今日)(?:有什么|有啥|有哪些)(?:任务|待办|安排|计划)$/u.test(normalized)
    );
    const isReflectionIntent = /(?:今日复盘|今天复盘|写复盘|更新复盘|记录复盘|总结今天|今天总结|回顾今天)/u.test(trimmed);
    const isSimplePomodoroStart = /^(?:开启|开始|来个|来一个|帮我开个)?(?:\d+\s*(?:分钟|小时))?(?:番茄钟|番茄|专注)(?:吧)?$/u.test(normalized);
    const isMorningPlanning = hasTimeSlots
      || /(?:时间段|时间安排|可以安排|可用时间|空闲时间|帮我安排|帮我规划|帮我排|任务安排)/u.test(trimmed);
    const isStartDay = /(?:开启今天|开始今天|今日开启|今天计划|今日计划|新的一天|起床|醒来)/u.test(trimmed);

    return {
      ...DEFAULT_FLAGS,
      isSimpleTodayTasksQuery,
      isReflectionIntent,
      isSimplePomodoroStart,
      isMorningPlanning,
      isStartDay,
    };
  }
}
