export interface AgentTaskCandidate {
  id: string;
  title: string;
}

export interface TaskMatchResult {
  taskId: string;
  taskTitle: string;
  matchType: 'exact' | 'contains';
  score: number;
}

export interface TaskMatchResolution {
  status: 'matched' | 'ambiguous' | 'none';
  match?: TaskMatchResult;
  candidates: TaskMatchResult[];
}

export interface AgentPomodoroHint {
  durationMinutes?: number;
  taskTitle?: string;
}

export interface AgentExerciseRecordHint {
  exerciseName: string;
  value: number;
  mode: 'record' | 'increment';
}

export type AgentExerciseFeelingHint = 'excellent' | 'good' | 'normal' | 'tired';

export interface AgentMessageHints {
  wakeUpTime?: string;
  explicitTaskTitles: string[];
  completionTaskTitle?: string;
  createAndCompleteTaskTitle?: string;
  pomodoro?: AgentPomodoroHint;
  exerciseRecord?: AgentExerciseRecordHint;
  exerciseFeeling?: AgentExerciseFeelingHint;
}

const POMODORO_KEYWORDS = /番茄|专注|计时/u;
const EXERCISE_CONTEXT_KEYWORDS = /运动|跑步|跑了?|骑行|骑了?|游泳|游了?|深蹲|蹲了?|俯卧撑|撑了?|引体向上/u;
const TASK_ACTION_PATTERN =
  /(?:现在|当前|这会儿|接下来|想|想要|准备|打算|先|开始|继续|马上|去|来|再|正在)?(?:做|学|学习|写|刷|背|看|复习|处理|完成|推进|弄|搞)([^，,。；;！!？?\n]+)/u;
const TASK_LIST_PATTERNS = [
  /(?:今天任务|今日任务|今天待办|今日待办|待办清单|任务清单|今天安排|今日安排|今天计划|今日计划)(?:是|有|为|:|：)?([\s\S]+)/u,
  /(?:任务是|待办是|安排是|计划是)([\s\S]+)/u,
];
const TASK_COMPLETION_PATTERNS = [
  /(?:把|将)?([^，,。；;！？?\n]+?)(?:任务|待办)?(?:完成了|完成啦|完成)$/u,
  /(?:把|将)?([^，,。；;！？?\n]+?)(?:任务|待办)?(?:做完了|搞定了|结束了)$/u,
];
const TASK_CREATE_AND_COMPLETE_PATTERNS = [
  /(?:创建|新建|添加|建(?:个|一个)?)([^，,。；;！？?\n]+?)(?:的)?(?:任务|待办)?(?:后|之后|然后|再|并|并且)?(?:标记(?:为)?完成|标记已完成|设为完成|直接完成|完成)$/u,
  /(?:创建|新建|添加|建(?:个|一个)?)([^，,。；;！？?\n]+?)(?:的)?(?:任务|待办)?(?:并|并且)(?:把它|将它|其)?(?:标记(?:为)?完成|标记已完成|设为完成|完成)$/u,
];
const EXERCISE_RECORD_PATTERNS: Array<{ exerciseName: string; pattern: RegExp }> = [
  { exerciseName: '跑步', pattern: /(?:跑步|跑了?|去跑)\s*([零一二两三四五六七八九十\d]+(?:\.\d+)?)\s*(?:公里|km)/u },
  { exerciseName: '骑行', pattern: /(?:骑行|骑车|骑了?)\s*([零一二两三四五六七八九十\d]+(?:\.\d+)?)\s*(?:公里|km)/u },
  { exerciseName: '游泳', pattern: /(?:游泳|游了?)\s*([零一二两三四五六七八九十\d]+(?:\.\d+)?)\s*(?:公里|km)/u },
  { exerciseName: '深蹲', pattern: /(?:深蹲|蹲了?)\s*([零一二两三四五六七八九十\d]+)\s*(?:个|次|下)/u },
  { exerciseName: '俯卧撑', pattern: /(?:俯卧撑|撑了?)\s*([零一二两三四五六七八九十\d]+)\s*(?:个|次|下)/u },
  { exerciseName: '引体向上', pattern: /引体向上\s*([零一二两三四五六七八九十\d]+)\s*(?:个|次|下)?/u },
];

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function parseLooseNumber(raw: string): number | undefined {
  const text = raw.trim();
  if (!text) {
    return undefined;
  }

  if (/^\d+(?:\.\d+)?$/u.test(text)) {
    return Number(text);
  }

  if (text === '半') {
    return 0.5;
  }

  if (text === '十') {
    return 10;
  }

  if (text.includes('十')) {
    const [tensRaw, onesRaw] = text.split('十');
    const tens = tensRaw ? CHINESE_DIGITS[tensRaw] : 1;
    const ones = onesRaw ? CHINESE_DIGITS[onesRaw] ?? 0 : 0;

    if (tens !== undefined) {
      return tens * 10 + ones;
    }
  }

  return CHINESE_DIGITS[text];
}

function padTimePart(value: number) {
  return value.toString().padStart(2, '0');
}

function stripSecondaryActionTail(text: string) {
  return text
    .replace(/(?:帮我|给我|顺便|然后|再|并且|并|同时).*(?:番茄|专注|计时).*$/u, '')
    .replace(/(?:开启|开个|开一个|开始).*(?:番茄|专注|计时).*$/u, '')
    .trim();
}

export function sanitizeTaskTitle(raw: string) {
  let cleaned = stripSecondaryActionTail(raw)
    .replace(/^[：:，,\s]+/u, '')
    .replace(/[。；;！!？?\s]+$/u, '')
    .trim();

  cleaned = cleaned
    .replace(/^(?:今天|今日|现在|当前|这会儿|接下来|先|马上|准备|想|想要|打算|开始|继续|请|帮我|给我|我想|我要)+/u, '')
    .replace(/^(?:做|学|学习|写|刷|背|看|复习|处理|完成|推进|弄|搞)+/u, '')
    .replace(/^(?:一套|一份|一张|一个|一道|一节|一下|一下子)+/u, '')
    .replace(/(?:任务|待办)$/u, '')
    .trim();

  return cleaned;
}

export function toTaskMatchKey(raw: string) {
  return sanitizeTaskTitle(raw)
    .replace(/的/gu, '')
    .replace(/\s+/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase();
}

function isLikelyTaskTitle(title: string) {
  if (!title || title.length < 2) {
    return false;
  }

  if (POMODORO_KEYWORDS.test(title)) {
    return false;
  }

  return !/(起床|花了|花费|消费|早餐|午餐|晚餐|非常棒|不错|一般|疲惫|状态|感觉|复盘|总结|重要信息|公里|km|分钟|小时|元|块)/u.test(title);
}

export function splitTaskTitles(raw: string) {
  const titles: string[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(/\s*(?:\+|＋|、|,|，|和|以及|及|&|\/|\n)\s*/u)) {
    const cleaned = sanitizeTaskTitle(part);
    const key = toTaskMatchKey(cleaned);

    if (!key || seen.has(key) || !isLikelyTaskTitle(cleaned)) {
      continue;
    }

    seen.add(key);
    titles.push(cleaned);
  }

  return titles;
}

export function extractWakeUpTime(message: string) {
  const normalized = message.replace(/：/gu, ':');
  const match = normalized.match(/(\d{1,2})(?::|点)(\d{1,2}|半)?\s*(?:起床|醒来|起来)/u);

  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);
  const minutes = match[2] === '半' ? 30 : Number(match[2] || 0);

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return undefined;
  }

  return `${padTimePart(hours)}:${padTimePart(minutes)}`;
}

export function extractDurationMinutes(message: string) {
  const normalized = message.replace(/：/gu, ':');

  const hourHalfMatch = normalized.match(/([零一二两三四五六七八九十\d]+)\s*小时半/u);
  if (hourHalfMatch) {
    const hours = parseLooseNumber(hourHalfMatch[1]);
    if (hours !== undefined) {
      return hours * 60 + 30;
    }
  }

  if (/半小时/u.test(normalized)) {
    return 30;
  }

  const hourMinuteMatch = normalized.match(/([零一二两三四五六七八九十\d]+)\s*小时(?:([零一二两三四五六七八九十\d]+)\s*分钟?)?/u);
  if (hourMinuteMatch) {
    const hours = parseLooseNumber(hourMinuteMatch[1]);
    const minutes = hourMinuteMatch[2] ? parseLooseNumber(hourMinuteMatch[2]) : 0;
    if (hours !== undefined) {
      return hours * 60 + (minutes ?? 0);
    }
  }

  const minuteMatch = normalized.match(/([零一二两三四五六七八九十\d]+)\s*分钟/u);
  if (minuteMatch) {
    const minutes = parseLooseNumber(minuteMatch[1]);
    if (minutes !== undefined) {
      return minutes;
    }
  }

  return undefined;
}

export function extractExplicitTaskTitles(message: string) {
  for (const pattern of TASK_LIST_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const titles = splitTaskTitles(match[1]);
      if (titles.length > 0) {
        return titles;
      }
    }
  }

  // 时段+动作描述：识别 "X点-Y点 做 Z" / "晚上8点开始 Z" / "上午9-12点 Z" 等自然语言计划
  const timeBlockTitles = extractTimeBlockTaskTitles(message);
  if (timeBlockTitles.length > 0) {
    return timeBlockTitles;
  }

  return [];
}

/**
 * 从自然语言时段描述中抽取任务标题。
 * 例：
 *   "今晚八点开始进行资料分析学习" → ["资料分析学习"]
 *   "上午9-12点写代码，下午2-5点开会，晚上7-9点跑步" → ["写代码", "开会", "跑步"]
 *   "晚上8点-10点 看刑法" → ["看刑法"]
 *
 * 跳过：含 "起床/有事/休息/吃饭/睡觉" 等非任务的时段描述。
 */
const NON_TASK_TIME_BLOCK_KEYWORDS =
  /(起床|睡觉|睡眠|休息|吃饭|早餐|午餐|晚餐|有事|没事|外出|出门|上班|下班|开会但已确认非任务)/u;

// 时间数字部分：阿拉伯数字 或 中文数字（一二两三四五六七八九十）
const TIME_NUM = '(?:[零一二两三四五六七八九十]+|\\d{1,2})';
const TIME_PERIOD = '(?:早上|上午|中午|下午|傍晚|晚上|今早|今晚|今天上午|今天下午|今天晚上)?';

const TIME_BLOCK_PATTERNS: RegExp[] = [
  // "上午9-12点 X" / "晚上7-9点 X" / "下午2-5点 X"
  new RegExp(
    `${TIME_PERIOD}\\s*${TIME_NUM}\\s*(?:点|:|：)?\\s*${TIME_NUM}?\\s*[-到~至]\\s*${TIME_NUM}\\s*(?:点|:|：)?\\s*${TIME_NUM}?\\s*(?:计划|安排|要|想|打算|准备)?\\s*(?:进行|做|开始)?\\s*([^，,。；;！!？?\\n]+)`,
    'u',
  ),
  // "晚上8点开始 X" / "今晚八点开始进行资料分析"
  new RegExp(
    `${TIME_PERIOD}\\s*${TIME_NUM}\\s*(?:点|:|：)\\s*${TIME_NUM}?\\s*(?:开始|起)\\s*(?:计划|安排|要|想|打算|准备)?\\s*(?:进行|做)?\\s*([^，,。；;！!？?\\n]+)`,
    'u',
  ),
];

export function extractTimeBlockTaskTitles(message: string): string[] {
  const titles: string[] = [];
  const seen = new Set<string>();

  // 按段切，每段独立尝试匹配（避免一个正则吞下整句）
  const segments = message.split(/[，,。；;！!？?\n]/u);
  for (const seg of segments) {
    if (!seg.trim()) continue;
    if (NON_TASK_TIME_BLOCK_KEYWORDS.test(seg)) continue;

    for (const pattern of TIME_BLOCK_PATTERNS) {
      const match = seg.match(pattern);
      if (!match?.[1]) continue;

      let raw = match[1].trim();
      // 去掉尾部 "一直到X点" / "到X点" 这种时间结尾
      raw = raw.replace(/\s*(?:一直)?到\s*\d{1,2}\s*(?:点|:|：)?\s*\d{0,2}\s*$/u, '').trim();
      const cleaned = sanitizeTaskTitle(raw);
      const key = toTaskMatchKey(cleaned);

      if (!key || seen.has(key) || !isLikelyTaskTitle(cleaned)) continue;
      seen.add(key);
      titles.push(cleaned);
      break; // 一段只抽一个标题
    }
  }

  return titles;
}

export function extractCompletionTaskTitle(message: string) {
  for (const pattern of TASK_COMPLETION_PATTERNS) {
    const match = message.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const cleaned = sanitizeTaskTitle(match[1]);
    if (isLikelyTaskTitle(cleaned)) {
      return cleaned;
    }
  }

  const directMatch = message.match(/(?:完成|做完|搞定|结束)([^，,。；;！!？?\n]+)/u);
  if (directMatch?.[1]) {
    const cleaned = sanitizeTaskTitle(directMatch[1]);
    if (isLikelyTaskTitle(cleaned)) {
      return cleaned;
    }
  }

  return undefined;
}

export function extractCreateAndCompleteTaskTitle(message: string) {
  const directMatch = message.match(/(?:创建|新建|添加)(?:一个|一条|任务)?[：:\s]*([^，,。；;！!？?\n]+?)(?:，|,|\s)*(?:并|然后|同时)?(?:把它|将它|直接)?(?:标记(?:为)?完成|设为完成|完成)$/u);
  if (directMatch?.[1]) {
    const cleaned = sanitizeTaskTitle(directMatch[1].replace(/的$/u, ''));
    if (isLikelyTaskTitle(cleaned)) {
      return cleaned;
    }
  }

  for (const pattern of TASK_CREATE_AND_COMPLETE_PATTERNS) {
    const match = message.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const cleaned = sanitizeTaskTitle(match[1].replace(/的$/u, ''));
    if (isLikelyTaskTitle(cleaned)) {
      return cleaned;
    }
  }

  return undefined;
}

export function extractPomodoroTaskTitle(message: string, explicitTaskTitles: string[] = []) {
  if (!POMODORO_KEYWORDS.test(message)) {
    return undefined;
  }

  const clauses = message.split(/[。；;！？!?]/u).map(clause => clause.trim()).filter(Boolean);
  for (const clause of clauses) {
    const actionMatch = clause.match(TASK_ACTION_PATTERN);
    if (actionMatch?.[1]) {
      const cleaned = sanitizeTaskTitle(actionMatch[1]);
      if (isLikelyTaskTitle(cleaned)) {
        return cleaned;
      }
    }

    const taskMatch = clause.match(/(?:任务|内容)(?:是|为)?([^，,。；;！!？?\n]+)/u);
    if (taskMatch?.[1]) {
      const cleaned = sanitizeTaskTitle(taskMatch[1]);
      if (isLikelyTaskTitle(cleaned)) {
        return cleaned;
      }
    }

    // 匹配"番茄钟，XXX"模式
    const pomodoroTaskAfter = clause.match(/(?:番茄(?:钟)?|专注|计时)[：:，,、\s]+([^，,。；;！!？?\n]+)/u);
    if (pomodoroTaskAfter?.[1]) {
      const cleaned = sanitizeTaskTitle(pomodoroTaskAfter[1]);
      if (isLikelyTaskTitle(cleaned)) {
        return cleaned;
      }
    }
  }

  if (explicitTaskTitles.length === 1) {
    return explicitTaskTitles[0];
  }

  return undefined;
}

export function extractExerciseRecord(message: string): AgentExerciseRecordHint | undefined {
  for (const { exerciseName, pattern } of EXERCISE_RECORD_PATTERNS) {
    const match = message.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const value = parseLooseNumber(match[1]);
    if (value === undefined || value <= 0) {
      continue;
    }

    return {
      exerciseName,
      value,
      mode: /(又|再|追加|多做了|多拉了|再来|再做|又做了|又拉了|再拉)/u.test(message) ? 'increment' : 'record',
    };
  }

  return undefined;
}

export function extractExerciseFeeling(
  message: string,
  hasExerciseContext = false,
): AgentExerciseFeelingHint | undefined {
  const hasContext = hasExerciseContext || EXERCISE_CONTEXT_KEYWORDS.test(message);
  if (!hasContext) {
    return undefined;
  }

  if (/(非常棒|很棒|超棒|棒极了|太棒了)/u.test(message)) {
    return 'excellent';
  }

  if (/(不错|还不错|挺好|很好)/u.test(message)) {
    return 'good';
  }

  if (/(一般|还行|普通)/u.test(message)) {
    return 'normal';
  }

  if (/(疲惫|累了|很累|好累)/u.test(message)) {
    return 'tired';
  }

  return undefined;
}

function extractBoundPomodoroTaskTitle(message: string) {
  if (!POMODORO_KEYWORDS.test(message)) {
    return undefined;
  }

  const match = message.match(/(?:绑定|关联)?(?:番茄|专注|计时)(?:任务)?[：:\s]*([^，,。；;！!？?\n]+)/u);
  if (!match?.[1]) {
    return undefined;
  }

  const cleaned = sanitizeTaskTitle(match[1]);
  return isLikelyTaskTitle(cleaned) ? cleaned : undefined;
}

export function extractAgentMessageHints(message: string): AgentMessageHints {
  const explicitTaskTitles = extractExplicitTaskTitles(message);
  const completionTaskTitle = extractCompletionTaskTitle(message);
  const createAndCompleteTaskTitle = extractCreateAndCompleteTaskTitle(message);
  const taskTitle = extractBoundPomodoroTaskTitle(message) || extractPomodoroTaskTitle(message, explicitTaskTitles);
  const durationMinutes = POMODORO_KEYWORDS.test(message) ? extractDurationMinutes(message) : undefined;
  const exerciseRecord = extractExerciseRecord(message);
  const exerciseFeeling = extractExerciseFeeling(message, Boolean(exerciseRecord));

  return {
    wakeUpTime: extractWakeUpTime(message),
    explicitTaskTitles,
    completionTaskTitle,
    createAndCompleteTaskTitle,
    pomodoro: taskTitle || durationMinutes
      ? {
          durationMinutes,
          taskTitle,
        }
      : undefined,
    exerciseRecord,
    exerciseFeeling,
  };
}

export function findTaskMatches(taskTitle: string, tasks: AgentTaskCandidate[]): TaskMatchResult[] {
  const lookupKey = toTaskMatchKey(taskTitle);
  if (!lookupKey) {
    return [];
  }

  const matches: TaskMatchResult[] = [];

  for (const task of tasks) {
    const taskKey = toTaskMatchKey(task.title);
    if (!taskKey) {
      continue;
    }

    let score = 0;
    let matchType: TaskMatchResult['matchType'] | null = null;

    if (lookupKey === taskKey) {
      score = 120;
      matchType = 'exact';
    } else if (lookupKey.length >= 2 && taskKey.length >= 2 && (taskKey.includes(lookupKey) || lookupKey.includes(taskKey))) {
      // 子串包含：要求较短的那个至少 2 字，且两者长度差不要太离谱
      // 注意：模糊的"字符级重叠"已被移除——它会把"申论练习"误吞到"申论真题练习"
      // 现在只保留"完全相等"和"子串包含"两种匹配方式，宁愿多创建任务也不静默忽略
      const minLen = Math.min(lookupKey.length, taskKey.length);
      const maxLen = Math.max(lookupKey.length, taskKey.length);
      if (minLen >= 2 && maxLen <= minLen * 3) {
        score = 90 - Math.abs(taskKey.length - lookupKey.length);
        matchType = 'contains';
      }
    }

    if (!matchType) {
      continue;
    }

    matches.push({
      taskId: task.id,
      taskTitle: task.title,
      matchType,
      score,
    });
  }

  return matches.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.matchType !== right.matchType) {
      return left.matchType === 'exact' ? -1 : 1;
    }

    return left.taskTitle.length - right.taskTitle.length;
  });
}

export function resolveTaskMatch(taskTitle: string, tasks: AgentTaskCandidate[]): TaskMatchResolution {
  const lookupKey = toTaskMatchKey(taskTitle);
  const candidates = findTaskMatches(taskTitle, tasks);

  if (!lookupKey || candidates.length === 0) {
    return {
      status: 'none',
      candidates: [],
    };
  }

  const [bestMatch, secondMatch] = candidates;
  const exactMatches = candidates.filter(candidate => candidate.matchType === 'exact');

  if (exactMatches.length === 1) {
    return {
      status: 'matched',
      match: exactMatches[0],
      candidates,
    };
  }

  if (exactMatches.length > 1) {
    return {
      status: 'ambiguous',
      candidates: exactMatches.slice(0, 3),
    };
  }

  if (!secondMatch) {
    return {
      status: 'matched',
      match: bestMatch,
      candidates,
    };
  }

  const scoreGap = bestMatch.score - secondMatch.score;
  const isClearlyBetter =
    (lookupKey.length >= 6 && scoreGap >= 12) ||
    (lookupKey.length >= 4 && scoreGap >= 18);

  if (isClearlyBetter) {
    return {
      status: 'matched',
      match: bestMatch,
      candidates,
    };
  }

  return {
    status: 'ambiguous',
    candidates: candidates.slice(0, 3),
  };
}

export function findBestTaskMatch(taskTitle: string, tasks: AgentTaskCandidate[]): TaskMatchResult | null {
  const resolution = resolveTaskMatch(taskTitle, tasks);
  return resolution.status === 'matched' ? resolution.match ?? null : null;
}
