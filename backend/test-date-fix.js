// 模拟修复后的日期函数
function getTodayStart() {
  const now = new Date();
  // 获取北京时间的偏移量（UTC+8）
  const beijingOffset = 8 * 60; // 8小时 = 480分钟
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const beijingTime = new Date(utcTime + (beijingOffset * 60000));
  
  // 使用UTC方式构造日期，避免时区转换问题
  return new Date(Date.UTC(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), 0, 0, 0, 0));
}

function parseDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function formatDateString(date) {
  return date.toISOString().split('T')[0];
}

function getCurrentBeijingTime() {
  return new Date(); // 直接返回当前UTC时间
}

console.log('🧪 测试修复后的日期函数...\n');

// 获取当前时间信息
const now = new Date();
console.log(`🌍 系统UTC时间: ${now.toISOString()}`);
console.log(`🌍 系统本地时间: ${now.toLocaleString()}`);
console.log(`🌍 系统时区偏移: ${now.getTimezoneOffset()} 分钟`);

// 测试修复后的函数
console.log('\n📅 测试修复后的getTodayStart():');
const todayStart = getTodayStart();
console.log(`  ISO: ${todayStart.toISOString()}`);
console.log(`  本地显示: ${todayStart.toLocaleString()}`);
console.log(`  日期字符串: ${todayStart.toLocaleDateString('zh-CN')}`);

// 测试日期字符串解析
console.log('\n📅 测试日期字符串解析:');
const testDateStr = '2025-08-13';
const parsedDate = parseDateString(testDateStr);
console.log(`  输入: ${testDateStr}`);
console.log(`  解析结果 ISO: ${parsedDate.toISOString()}`);
console.log(`  解析结果 本地: ${parsedDate.toLocaleString()}`);
console.log(`  解析结果 日期: ${parsedDate.toLocaleDateString('zh-CN')}`);

// 测试日期格式化
console.log('\n📅 测试日期格式化:');
const formattedDate = formatDateString(parsedDate);
console.log(`  格式化结果: ${formattedDate}`);

// 测试当前时间
console.log('\n🕐 测试当前时间:');
const currentTime = getCurrentBeijingTime();
console.log(`  当前时间 ISO: ${currentTime.toISOString()}`);
console.log(`  当前时间 本地: ${currentTime.toLocaleString()}`);

// 验证日期匹配
console.log('\n✅ 验证日期匹配:');
const expectedDate = '2025-08-13';
const actualDate = formatDateString(todayStart);
console.log(`  预期日期: ${expectedDate}`);
console.log(`  实际日期: ${actualDate}`);
console.log(`  匹配结果: ${expectedDate === actualDate ? '✅ 正确' : '❌ 错误'}`);

// 测试不同时区的情况
console.log('\n🌏 测试时区处理:');
const testDates = [
  '2025-01-01', // 冬季
  '2025-07-01', // 夏季
  '2025-12-31'  // 年末
];

testDates.forEach(dateStr => {
  const parsed = parseDateString(dateStr);
  const formatted = formatDateString(parsed);
  console.log(`  ${dateStr} -> ${parsed.toISOString()} -> ${formatted} (${parsed.toLocaleDateString('zh-CN')})`);
});

console.log('\n🎉 测试完成！');
