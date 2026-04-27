const fs = require('fs');
const path = require('path');

const casesPath = path.join(__dirname, '..', 'agent-evals', 'cases.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

const raw = fs.readFileSync(casesPath, 'utf8');
const cases = JSON.parse(raw);

assert(Array.isArray(cases), 'cases.json 必须是数组');
assert(cases.length >= 20, '至少需要 20 条 Agent eval 用例');

const names = new Set();

cases.forEach((item, index) => {
  const label = `第 ${index + 1} 条用例`;

  assert(item && typeof item === 'object', `${label} 必须是对象`);
  assert(typeof item.name === 'string' && item.name.trim(), `${label} 缺少 name`);
  assert(!names.has(item.name), `${label} name 重复：${item.name}`);
  names.add(item.name);

  assert(typeof item.input === 'string' && item.input.trim(), `${label} 缺少 input`);
  assert(typeof item.confirmMode === 'boolean', `${label} confirmMode 必须是 boolean`);
  assert(isStringArray(item.expectedTools), `${label} expectedTools 必须是字符串数组`);
  assert(Number.isInteger(item.expectedConfirmationCount), `${label} expectedConfirmationCount 必须是整数`);
  assert(item.expectedConfirmationCount >= 0, `${label} expectedConfirmationCount 不能小于 0`);

  if (item.mustContain !== undefined) {
    assert(isStringArray(item.mustContain), `${label} mustContain 必须是字符串数组`);
  }
  if (item.mustNotContain !== undefined) {
    assert(isStringArray(item.mustNotContain), `${label} mustNotContain 必须是字符串数组`);
  }
  if (item.chatMustNotContain !== undefined) {
    assert(isStringArray(item.chatMustNotContain), `${label} chatMustNotContain 必须是字符串数组`);
  }
  if (item.memorySeed !== undefined) {
    assert(isStringArray(item.memorySeed), `${label} memorySeed 必须是字符串数组`);
  }
  if (item.taskSeed !== undefined) {
    assert(
      Array.isArray(item.taskSeed) && item.taskSeed.every((seed) => (
        typeof seed === 'string'
        || (seed && typeof seed === 'object' && typeof seed.title === 'string')
      )),
      `${label} taskSeed 必须是字符串数组或任务对象数组`,
    );
  }
  if (item.expectedMemoryWrite !== undefined) {
    assert(typeof item.expectedMemoryWrite === 'boolean', `${label} expectedMemoryWrite 必须是 boolean`);
  }
});

console.log(`Agent eval 用例校验通过：${cases.length} 条`);
