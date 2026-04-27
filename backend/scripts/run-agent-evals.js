const fs = require('fs');
const path = require('path');

const casesPath = path.join(__dirname, '..', 'agent-evals', 'cases.json');
const baseUrl = process.env.AGENT_EVAL_BASE_URL || 'http://localhost:3002/api';
const tokenFromEnv = process.env.AGENT_EVAL_TOKEN;
const email = process.env.AGENT_EVAL_EMAIL;
const password = process.env.AGENT_EVAL_PASSWORD;
const executeConfirmations = process.env.AGENT_EVAL_EXECUTE === 'true';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertCase(condition, message, detail) {
  if (!condition) {
    const error = new Error(message);
    error.evalDetail = detail;
    throw error;
  }
}

async function request(method, urlPath, body, token) {
  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`${method} ${urlPath} failed: ${response.status} ${text}`);
  }

  return data;
}

async function getToken() {
  if (tokenFromEnv) {
    return tokenFromEnv;
  }

  if (!email || !password) {
    throw new Error('请设置 AGENT_EVAL_TOKEN，或设置 AGENT_EVAL_EMAIL 和 AGENT_EVAL_PASSWORD');
  }

  const result = await request('POST', '/auth/login', { email, password });
  if (!result?.accessToken) {
    throw new Error('登录成功但没有返回 accessToken');
  }
  return result.accessToken;
}

async function seedMemories(token, memorySeed) {
  if (!Array.isArray(memorySeed) || memorySeed.length === 0) {
    return;
  }

  for (const content of memorySeed) {
    await request('POST', '/agent/memories', {
      type: detectMemoryType(content),
      content,
    }, token);
  }
  await request('POST', '/agent/profile/rebuild', {}, token);
}

async function seedTasks(token, taskSeed) {
  if (!Array.isArray(taskSeed) || taskSeed.length === 0) {
    return;
  }

  for (const item of taskSeed) {
    const title = typeof item === 'string' ? item : item?.title;
    if (!title) {
      continue;
    }
    await request('POST', '/tasks', {
      title,
      ...(typeof item === 'object' && item ? item : {}),
    }, token);
  }
}

function detectMemoryType(content) {
  if (/默认|喜欢|偏好|习惯|希望|倾向/u.test(content)) {
    return 'preference';
  }
  if (/不喜欢|不要|避免|禁止/u.test(content)) {
    return 'constraint';
  }
  if (/目标|备考|计划|长期|训练/u.test(content)) {
    return 'goal';
  }
  return 'fact';
}

function collectToolNames(result) {
  const names = [];

  if (Array.isArray(result?.confirms)) {
    for (const confirm of result.confirms) {
      if (confirm?.action?.name) {
        names.push(confirm.action.name);
      }
    }
  }

  if (Array.isArray(result?.toolResults)) {
    for (const toolResult of result.toolResults) {
      if (toolResult?.tool) {
        names.push(toolResult.tool);
      }
    }
  }

  return [...new Set(names)];
}

function collectVisibleText(result) {
  const pieces = [
    result?.reply,
    result?.previewReply,
  ];

  if (Array.isArray(result?.confirms)) {
    for (const confirm of result.confirms) {
      pieces.push(confirm.summary);
    }
  }

  if (Array.isArray(result?.toolResults)) {
    pieces.push(JSON.stringify(result.toolResults));
  }

  return pieces.filter(Boolean).join('\n');
}

function collectChatText(result) {
  return [result?.reply, result?.previewReply].filter(Boolean).join('\n');
}

async function assertRunSteps(token, result, item) {
  if (!result?.runId) {
    return;
  }

  const stepResult = await request('GET', `/agent/runs/${result.runId}/steps`, undefined, token);
  const steps = Array.isArray(stepResult?.steps) ? stepResult.steps : [];

  if (item.expectedMemoryWrite) {
    const memoryStep = steps.find((step) => step.type === 'memory_write');
    assert(memoryStep, '期望写入记忆，但没有 memory_write step');
    assert(memoryStep.status === 'success', `期望 memory_write success，实际为 ${memoryStep.status}`);
  }
}

async function runCase(token, item, index) {
  await seedTasks(token, item.taskSeed);
  await seedMemories(token, item.memorySeed);

  const result = await request('POST', '/agent/chat', {
    message: item.input,
    confirmMode: item.confirmMode,
  }, token);

  const confirms = Array.isArray(result?.confirms) ? result.confirms : [];
  const queueResult = await request('GET', '/agent/confirmations?status=pending&limit=20', undefined, token);
  const pendingQueue = Array.isArray(queueResult?.confirmations) ? queueResult.confirmations : [];
  const currentRunQueue = result?.runId
    ? pendingQueue.filter((confirmation) => confirmation.runId === result.runId)
    : pendingQueue;
  const toolNames = collectToolNames(result);
  const visibleText = collectVisibleText(result);
  const chatText = collectChatText(result);

  const detail = {
    resultType: result?.type,
    runId: result?.runId,
    expectedTools: item.expectedTools || [],
    actualTools: toolNames,
    expectedConfirmationCount: item.expectedConfirmationCount,
    actualConfirmationCount: confirms.length,
    queueConfirmationCount: currentRunQueue.length,
    visibleText: visibleText.slice(0, 500),
    chatText: chatText.slice(0, 500),
  };

  assertCase(
    confirms.length === item.expectedConfirmationCount,
    `确认卡数量不匹配：期望 ${item.expectedConfirmationCount}，实际 ${confirms.length}`,
    detail,
  );
  assertCase(
    currentRunQueue.length === item.expectedConfirmationCount,
    `确认队列数量不匹配：期望 ${item.expectedConfirmationCount}，实际 ${currentRunQueue.length}`,
    detail,
  );

  for (const tool of item.expectedTools || []) {
    assertCase(toolNames.includes(tool), `缺少期望工具：${tool}，实际工具：${toolNames.join(', ') || '无'}`, detail);
  }

  for (const text of item.mustContain || []) {
    assertCase(visibleText.includes(text), `结果中缺少文本：${text}`, detail);
  }

  for (const text of item.mustNotContain || []) {
    assertCase(!visibleText.includes(text), `结果中不应包含文本：${text}`, detail);
  }

  for (const text of item.chatMustNotContain || []) {
    assertCase(!chatText.includes(text), `聊天文本中不应包含文本：${text}`, detail);
  }

  await assertRunSteps(token, result, item);

  if (executeConfirmations && confirms.length > 0) {
    for (const confirm of confirms) {
      await request('POST', '/agent/confirm', { messageId: confirm.id }, token);
    }
  }

  return {
    index,
    name: item.name,
    type: result?.type,
    runId: result?.runId,
    tools: toolNames,
    confirmations: confirms.length,
    visibleText,
    chatText,
  };
}

async function main() {
  const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
  const selected = process.argv.slice(2);
  const selectedCases = selected.length > 0
    ? cases.filter((item) => selected.includes(item.name) || selected.includes(String(cases.indexOf(item) + 1)))
    : cases;

  assert(selectedCases.length > 0, '没有匹配到要运行的 eval 用例');

  const token = await getToken();
  const results = [];
  const failures = [];

  for (const [index, item] of selectedCases.entries()) {
    const globalIndex = cases.indexOf(item) + 1;
    try {
      const result = await runCase(token, item, globalIndex);
      results.push(result);
      console.log(`✅ ${globalIndex}. ${item.name}`);
    } catch (error) {
      const detail = error && typeof error === 'object' && 'evalDetail' in error ? error.evalDetail : null;
      failures.push({
        index: globalIndex,
        name: item.name,
        error: error instanceof Error ? error.message : String(error),
        detail,
      });
      console.error(`❌ ${globalIndex}. ${item.name}: ${failures[failures.length - 1].error}`);
    }
  }

  console.log(`\nAgent eval 完成：通过 ${results.length}，失败 ${failures.length}`);

  if (failures.length > 0) {
    console.log('\n失败用例：');
    for (const failure of failures) {
      console.log(`- ${failure.index}. ${failure.name}: ${failure.error}`);
      if (failure.detail) {
        console.log(`  detail: ${JSON.stringify(failure.detail).slice(0, 800)}`);
      }
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
