/**
 * 本地单元测试：意图提取（hints）
 * 运行：npx ts-node --transpile-only test-hints.spec.ts
 */
import { extractAgentMessageHints, extractTimeBlockTaskTitles } from './src/agent/agent-intent.utils';

interface Case {
  label: string;
  msg: string;
  expectWakeUp?: string;
  expectTitlesIncludes?: string[];
  expectTitlesExcludes?: string[];
  expectTitlesEmpty?: boolean;
}

const cases: Case[] = [
  {
    label: '①自然时段+学习描述（之前漏抽）',
    msg: '开启今天，今天早上7点半起床，白天有事，今晚八点开始进行资料分析学习，一直到10点',
    expectWakeUp: '07:30',
    expectTitlesIncludes: ['资料分析学习'],
    expectTitlesExcludes: ['白天有事', '起床'],
  },
  {
    label: '②多时段拆分',
    msg: '开启今天，7:30起床，上午9-12点写代码，下午2-5点开会，晚上7-9点跑步',
    expectWakeUp: '07:30',
    expectTitlesIncludes: ['写代码', '开会', '跑步'],
  },
  {
    label: '③清单式（原有功能保持）',
    msg: '开启今日，今天任务是：刷申论真题、背单词、看刑法',
    expectTitlesIncludes: ['申论真题', '单词', '刑法'],
  },
  {
    label: '④"白天有事"不应被识别为任务',
    msg: '开启今天，白天有事',
    expectTitlesEmpty: true,
  },
  {
    label: '⑤纯起床',
    msg: '今天8点起床',
    expectWakeUp: '08:00',
    expectTitlesEmpty: true,
  },
  {
    label: '⑥"晚上8点-10点 X" 时段',
    msg: '晚上8点-10点 看刑法',
    expectTitlesIncludes: ['刑法'],
  },
  {
    label: '⑦中文数字时段',
    msg: '下午3点到五点进行申论练习',
    expectTitlesIncludes: ['申论练习'],
  },
];

let pass = 0, fail = 0;
console.log('=== Hints 提取单元测试 ===\n');

for (const c of cases) {
  const h = extractAgentMessageHints(c.msg);
  const titles = h.explicitTaskTitles;
  const issues: string[] = [];

  if (c.expectWakeUp && h.wakeUpTime !== c.expectWakeUp) {
    issues.push(`wakeUp 期望=${c.expectWakeUp} 实际=${h.wakeUpTime}`);
  }
  if (c.expectTitlesEmpty && titles.length > 0) {
    issues.push(`期望空，实际=[${titles.join(',')}]`);
  }
  for (const want of c.expectTitlesIncludes ?? []) {
    if (!titles.some(t => t.includes(want) || want.includes(t))) {
      issues.push(`缺少标题"${want}"`);
    }
  }
  for (const forbid of c.expectTitlesExcludes ?? []) {
    if (titles.some(t => t.includes(forbid))) {
      issues.push(`不该出现"${forbid}"`);
    }
  }

  if (issues.length === 0) {
    pass++;
    console.log(`✅ ${c.label}\n   titles=[${titles.join(',')}]${h.wakeUpTime ? ' wakeUp=' + h.wakeUpTime : ''}\n`);
  } else {
    fail++;
    console.log(`❌ ${c.label}`);
    console.log(`   ${issues.join(' | ')}`);
    console.log(`   actual: titles=[${titles.join(',')}] wakeUp=${h.wakeUpTime ?? '-'}\n`);
  }
}

console.log(`\n通过 ${pass}/${pass + fail}, 失败 ${fail}`);
process.exit(fail > 0 ? 1 : 0);
