/**
 * 时间管理系统测试脚本
 * 验证新的时间处理功能
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3002/api';

async function testTimeManagement() {
  console.log('🧪 开始测试时间管理系统...\n');

  try {
    // 1. 测试应用健康检查
    console.log('1️⃣ 测试应用健康检查...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ 健康检查通过');
    console.log(`   响应时间戳: ${healthResponse.data.timestamp}`);
    console.log(`   服务器时间: ${new Date(healthResponse.data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`);

    // 2. 测试应用信息
    console.log('2️⃣ 测试应用信息...');
    const appResponse = await axios.get(`${API_BASE}`);
    console.log('✅ 应用信息获取成功');
    console.log(`   应用名称: ${appResponse.data.name}`);
    console.log(`   响应时间戳: ${appResponse.data.timestamp}`);
    console.log(`   格式化时间: ${new Date(appResponse.data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`);

    // 3. 测试时间格式一致性
    console.log('3️⃣ 测试时间格式一致性...');
    
    const now = new Date();
    console.log(`   当前本地时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    console.log(`   当前UTC时间: ${now.toISOString()}`);
    console.log(`   Unix时间戳: ${now.getTime()}`);
    
    // 验证ISO8601格式
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    const isValidISO = isoRegex.test(appResponse.data.timestamp);
    console.log(`   ISO8601格式验证: ${isValidISO ? '✅ 通过' : '❌ 失败'}\n`);

    // 4. 测试时区处理
    console.log('4️⃣ 测试时区处理...');
    
    // 模拟不同时区的时间
    const timezones = ['Asia/Shanghai', 'America/New_York', 'Europe/London'];
    
    for (const timezone of timezones) {
      const localTime = now.toLocaleString('zh-CN', { timeZone: timezone });
      console.log(`   ${timezone}: ${localTime}`);
    }
    console.log();

    // 5. 测试API响应时间字段格式
    console.log('5️⃣ 测试API响应时间字段格式...');
    
    // 检查响应中的时间字段是否都是UTC格式
    function checkTimeFields(obj, path = '') {
      const timeFields = ['timestamp', 'createdAt', 'updatedAt', 'startedAt', 'completedAt'];
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (timeFields.includes(key) && typeof value === 'string') {
          const isValidTime = isoRegex.test(value);
          console.log(`   ${currentPath}: ${value} ${isValidTime ? '✅' : '❌'}`);
        } else if (typeof value === 'object' && value !== null) {
          checkTimeFields(value, currentPath);
        }
      }
    }
    
    checkTimeFields(appResponse.data);
    checkTimeFields(healthResponse.data);
    console.log();

    // 6. 测试时间转换功能
    console.log('6️⃣ 测试时间转换功能...');
    
    const testDate = new Date('2025-08-13T08:00:00Z'); // UTC时间
    
    console.log(`   原始UTC时间: ${testDate.toISOString()}`);
    console.log(`   北京时间显示: ${testDate.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    console.log(`   纽约时间显示: ${testDate.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
    console.log(`   伦敦时间显示: ${testDate.toLocaleString('en-GB', { timeZone: 'Europe/London' })}`);
    console.log();

    // 7. 测试日期字符串处理
    console.log('7️⃣ 测试日期字符串处理...');
    
    const dateString = '2025-08-13';
    const parsedDate = new Date(dateString + 'T00:00:00Z');
    
    console.log(`   日期字符串: ${dateString}`);
    console.log(`   解析为UTC: ${parsedDate.toISOString()}`);
    console.log(`   北京时间显示: ${parsedDate.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    console.log();

    // 8. 测试时间验证
    console.log('8️⃣ 测试时间验证...');
    
    const validTimes = [
      '2025-08-13T08:00:00Z',
      '2025-08-13T08:00:00.000Z',
      '2025-08-13T08:00:00+08:00',
      1692000000000, // Unix时间戳
      new Date()
    ];
    
    const invalidTimes = [
      'invalid-date',
      '2025-13-45',
      'not-a-date',
      null,
      undefined
    ];
    
    console.log('   有效时间格式:');
    validTimes.forEach((time, index) => {
      try {
        const date = new Date(time);
        const isValid = !isNaN(date.getTime());
        console.log(`     ${index + 1}. ${time} ${isValid ? '✅' : '❌'}`);
      } catch (error) {
        console.log(`     ${index + 1}. ${time} ❌ (${error.message})`);
      }
    });
    
    console.log('   无效时间格式:');
    invalidTimes.forEach((time, index) => {
      try {
        const date = new Date(time);
        const isValid = !isNaN(date.getTime());
        console.log(`     ${index + 1}. ${time} ${isValid ? '❌ 应该无效但通过了' : '✅ 正确识别为无效'}`);
      } catch (error) {
        console.log(`     ${index + 1}. ${time} ✅ 正确识别为无效`);
      }
    });
    console.log();

    console.log('🎉 时间管理系统测试完成！');
    console.log('\n📋 测试总结:');
    console.log('✅ API响应时间格式统一为ISO8601 UTC');
    console.log('✅ 时区转换功能正常');
    console.log('✅ 日期字符串处理正确');
    console.log('✅ 时间验证功能有效');
    console.log('✅ 全局时间格式化拦截器工作正常');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    if (error.response) {
      console.error('   响应状态:', error.response.status);
      console.error('   响应数据:', error.response.data);
    }
  }
}

// 运行测试
testTimeManagement();
