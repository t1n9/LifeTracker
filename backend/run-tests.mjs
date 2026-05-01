import http from 'http';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTAwMSIsImVtYWlsIjoiZGVtb0BsaWZldHJhY2tlci5jb20iLCJyb2xlIjoiVVNFUiIsImlhdCI6MTc3NzU0NzUwMywiZXhwIjoxNzc4MTUyMzAzfQ.Z8_GV8Dwn2PakLcFFfKHDkYxcO2eSy6c-vLzNF0C-sM';

const TESTS = [
  { label: '①纯起床时间',           msg: '今天7点半起床',                              expectTools: ['start_day'],       forbidTools: [] },
  { label: '②起床+任务列表',         msg: '今天8点起床，今天任务是行测套卷+申论写作',   expectTools: ['start_day','create_tasks'], forbidTools: [] },
  { label: '③简单开番茄',            msg: '帮我开个25分钟番茄钟',                       expectTools: ['start_pomodoro'],  forbidTools: [] },
  { label: '④番茄+新任务',           msg: '现在做行政法复习，开1小时番茄',              expectTools: ['start_pomodoro'],  forbidTools: [] },
  { label: '⑤记录跑步',             msg: '今天跑了5公里',                              expectTools: ['record_exercise'], forbidTools: [] },
  { label: '⑥跑步+感受',            msg: '今天跑了3公里，状态非常棒',                  expectTools: ['record_exercise','set_exercise_feeling'], forbidTools: [] },
  { label: '⑦运动+感受+番茄',       msg: '今天跑了3公里，非常棒，现在做民法，帮我开2小时番茄', expectTools: ['record_exercise','set_exercise_feeling','start_pomodoro'], forbidTools: [] },
  { label: '⑧记录午餐',             msg: '午饭花了28元',                               expectTools: ['record_meal_expense'], forbidTools: [] },
  { label: '⑨完成任务',             msg: '行测套卷完成了',                             expectTools: ['complete_task'],   forbidTools: [] },
  { label: '⑩查今日任务',           msg: '今天的任务有哪些',                           expectTools: ['get_today_tasks'], forbidTools: [] },
  { label: '⑪拒绝写代码',           msg: '帮我写一段Python排序代码',                   expectTools: [],                  forbidTools: ['create_task'] },
  { label: '⑫复盘',                 msg: '帮我写一下今天的复盘总结',                   expectTools: ['update_day_reflection'], forbidTools: [] },

  // ===== 晨间规划提案阶段：第一轮绝不能调任何工具，只输出文字方案 =====
  { label: '⑬晨间-自然描述',         msg: '开启今天，今天早上7点半起床，白天有事，今晚八点开始进行资料分析学习，一直到10点',
    expectTools: [], forbidTools: ['start_day','create_tasks','create_task'],
    expectReplyContains: ['资料分析'] },
  { label: '⑭晨间-多时段',           msg: '开启今天，7:30起床，上午9-12点写代码，下午2-5点开会，晚上7-9点跑步',
    expectTools: [], forbidTools: ['start_day','create_tasks','create_task'] },
  { label: '⑮晨间-清单式',           msg: '开启今日，今天任务是：刷申论真题、背单词、看刑法',
    expectTools: [], forbidTools: ['start_day','create_tasks','create_task'] },
];

function post(message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ message, confirmMode: false });
    const req = http.request({
      hostname: 'localhost', port: 3002, path: '/api/agent/chat', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve({ error: 'parse_fail', raw: d.substring(0, 100) }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let pass = 0, fail = 0;

console.log('========================================');
console.log(' LifeTracker Agent 自动化测试');
console.log('========================================\n');

for (const t of TESTS) {
  const resp = await post(t.msg);
  const tools = (resp.toolResults || []).map(r => r.tool);
  const reply = (resp.reply || resp.error || '').substring(0, 80);

  const missingTools = t.expectTools.filter(e => !tools.includes(e));
  const forbidHit = t.forbidTools.filter(e => tools.includes(e));
  const replyText = resp.reply || '';
  const missingReply = (t.expectReplyContains || []).filter(s => !replyText.includes(s));

  const ok = missingTools.length === 0 && forbidHit.length === 0 && missingReply.length === 0;
  if (ok) {
    pass++;
    console.log(`✅ ${t.label} | tools=[${tools.join(',')}]`);
  } else {
    fail++;
    const issues = [
      missingTools.length ? `缺少工具: [${missingTools.join(',')}]` : '',
      forbidHit.length   ? `不该调用: [${forbidHit.join(',')}]` : '',
      missingReply.length ? `回复缺关键词: [${missingReply.join(',')}]` : '',
    ].filter(Boolean).join(' | ');
    console.log(`❌ ${t.label}`);
    console.log(`   ${issues}`);
    console.log(`   actual tools: [${tools.join(',') || 'NONE'}]`);
    console.log(`   reply: ${reply}`);
  }

  await sleep(3000);
}

console.log(`\n========================================`);
console.log(` 通过: ${pass} / ${pass + fail}`);
console.log(` 失败: ${fail} / ${pass + fail}`);
console.log('========================================');
