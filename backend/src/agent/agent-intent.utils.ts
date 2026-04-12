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

  return [];
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

  return undefined;
}

export function extractCreateAndCompleteTaskTitle(message: string) {
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

export function extractAgentMessageHints(message: string): AgentMessageHints {
  const explicitTaskTitles = extractExplicitTaskTitles(message);
  const completionTaskTitle = extractCompletionTaskTitle(message);
  const createAndCompleteTaskTitle = extractCreateAndCompleteTaskTitle(message);
  const taskTitle = extractPomodoroTaskTitle(message, explicitTaskTitles);
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
      score = 90 - Math.abs(taskKey.length - lookupKey.length);
      matchType = 'contains';
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
