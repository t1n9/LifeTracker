/**
 * 意图识别纯 AI 测试脚本
 * 测试用 deepseek-v4-flash 直接做意图分类，不用任何正则/关键词
 *
 * 运行：node scripts/test-intent.mjs
 */

const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = 'sk-4a86b61cea7b436aabfc8a6f988f8139';
const MODEL = 'deepseek-v4-flash';

// ── 意图定义 ──────────────────────────────────────────────────────
const INTENTS = [
  'start_day',          // 开启今天 / 设置起床时间
  'query_tasks',        // 查看今天任务
  'create_task',        // 创建任务
  'complete_task',      // 标记任务完成
  'start_pomodoro',     // 开启番茄钟
  'record_meal',        // 记录饮食/消费
  'record_exercise',    // 记录运动
  'update_reflection',  // 写今日复盘
  'chat',               // 闲聊 / 不需要操作
];

// ── 测试用例 ──────────────────────────────────────────────────────
// 每条：{ input, expected, note }
const CASES = [
  // start_day
  { input: '早上好，我7点半起床了', expected: 'start_day', note: '标准起床' },
  { input: '新的一天开始了，今天9点起', expected: 'start_day', note: '隐式起床' },
  { input: '开始今天吧', expected: 'start_day', note: '模糊开启' },
  { input: 'Good morning, woke up at 8am', expected: 'start_day', note: '英文' },
  { input: '我剛起床，7點半', expected: 'start_day', note: '繁体' },
  { input: 'Bonjour, je me suis levé à 8h', expected: 'start_day', note: '法语' },
  { input: '起きた、朝7時', expected: 'start_day', note: '日文' },

  // query_tasks
  { input: '今天有啥要做的', expected: 'query_tasks', note: '标准查询' },
  { input: '我有哪些任务没完成', expected: 'query_tasks', note: '未完成' },
  { input: '帮我看看待办', expected: 'query_tasks', note: '口语' },
  { input: "what's on my todo list today", expected: 'query_tasks', note: '英文' },
  { input: '今日のタスクを見せて', expected: 'query_tasks', note: '日文' },
  { input: '목록 보여줘', expected: 'query_tasks', note: '韩文' },

  // create_task
  { input: '帮我加个任务：下午3点开会', expected: 'create_task', note: '明确创建' },
  { input: '记一下，晚上要健身', expected: 'create_task', note: '隐式创建' },
  { input: '提醒我明天买菜', expected: 'create_task', note: '提醒类' },
  { input: 'add a task: review PR at 2pm', expected: 'create_task', note: '英文' },
  { input: 'リマインド：今夜メールを送る', expected: 'create_task', note: '日文' },

  // complete_task
  { input: '开会搞定了', expected: 'complete_task', note: '口语完成' },
  { input: '把健身标记成完成', expected: 'complete_task', note: '明确标记' },
  { input: '刚跑完步了', expected: 'complete_task', note: '隐式完成' },
  { input: 'done with the PR review', expected: 'complete_task', note: '英文' },
  { input: '미팅 끝났어', expected: 'complete_task', note: '韩文' },

  // start_pomodoro
  { input: '来个番茄钟', expected: 'start_pomodoro', note: '标准' },
  { input: '开始专注25分钟', expected: 'start_pomodoro', note: '带时长' },
  { input: '帮我计时，我要写代码了', expected: 'start_pomodoro', note: '隐式' },
  { input: 'start a pomodoro for writing', expected: 'start_pomodoro', note: '英文' },
  { input: 'ポモドーロ開始', expected: 'start_pomodoro', note: '日文' },

  // record_meal
  { input: '午饭花了35块，吃的沙县', expected: 'record_meal', note: '标准' },
  { input: '早上喝了杯咖啡，18元', expected: 'record_meal', note: '早餐' },
  { input: 'spent 12 bucks on lunch', expected: 'record_meal', note: '英文' },
  { input: '昼飯500円だった', expected: 'record_meal', note: '日文' },

  // record_exercise
  { input: '跑了5公里，30分钟', expected: 'record_exercise', note: '标准' },
  { input: '今天做了40分钟瑜伽', expected: 'record_exercise', note: '瑜伽' },
  { input: 'just finished a 20min run', expected: 'record_exercise', note: '英文' },
  { input: '오늘 헬스장 1시간 했어', expected: 'record_exercise', note: '韩文' },

  // update_reflection
  { input: '写一下今天的复盘', expected: 'update_reflection', note: '标准' },
  { input: '今天整体感觉不错，完成了3个任务', expected: 'update_reflection', note: '内容型' },
  { input: "let's do today's review", expected: 'update_reflection', note: '英文' },
  { input: '今日の振り返りを書いて', expected: 'update_reflection', note: '日文' },

  // chat (不需要操作)
  { input: '你好呀', expected: 'chat', note: '打招呼' },
  { input: '今天天气怎么样', expected: 'chat', note: '无关问题' },
  { input: '感觉好累', expected: 'chat', note: '情绪' },
  { input: 'how are you doing', expected: 'chat', note: '英文闲聊' },
  { input: '給我講個笑話', expected: 'chat', note: '繁体无关' },
];

// ── Prompt ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `你是一个生活助理 App 的意图分类器。
用户发来一条消息，你必须从以下意图中选出唯一最匹配的一个，只输出意图 key，不要有任何其他内容。

可选意图：
- start_day：开启今天 / 告知起床时间 / 开始新的一天
- query_tasks：查看今天的任务/待办/安排
- create_task：创建/添加/记录一个新任务或提醒
- complete_task：标记某个任务已完成 / 某件事做完了
- start_pomodoro：开启番茄钟 / 开始专注计时
- record_meal：记录餐食消费 / 吃了什么 / 花了多少钱在餐饮上
- record_exercise：记录运动 / 跑步 / 健身等体育活动
- update_reflection：写今日复盘/总结/反思
- chat：闲聊 / 无需执行任何操作

只输出 key，例如：start_day`;

async function classify(input) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: input },
      ],
      max_tokens: 50,
      temperature: 0,
      thinking: { type: 'disabled' },
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? 'ERROR';
}

// ── Run ───────────────────────────────────────────────────────────
const results = [];
let correct = 0;

console.log('\n测试开始...\n');
console.log('输入'.padEnd(35), '期望'.padEnd(22), '实际'.padEnd(22), '结果');
console.log('─'.repeat(90));

for (const c of CASES) {
  const actual = await classify(c.input);
  const ok = actual === c.expected;
  if (ok) correct++;
  results.push({ ...c, actual, ok });
  const status = ok ? '✅' : '❌';
  console.log(
    c.input.slice(0, 33).padEnd(35),
    c.expected.padEnd(22),
    actual.padEnd(22),
    `${status} ${c.note}`,
  );
}

console.log('\n─'.repeat(90));
console.log(`\n总计 ${CASES.length} 条，正确 ${correct} 条，准确率 ${((correct / CASES.length) * 100).toFixed(1)}%`);

// 输出错误汇总
const errors = results.filter(r => !r.ok);
if (errors.length > 0) {
  console.log('\n❌ 识别错误的用例：');
  for (const e of errors) {
    console.log(`  "${e.input}" → 期望 ${e.expected}，实际 ${e.actual}  [${e.note}]`);
  }
}
