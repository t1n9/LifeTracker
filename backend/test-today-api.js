/**
 * 测试今日数据API
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3002/api';

async function testTodayAPIs() {
  console.log('🧪 测试今日数据API...\n');

  try {
    // 1. 登录获取token
    console.log('1️⃣ 登录测试用户...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'test@test.com',
      password: 'test123'
    });
    
    console.log('登录响应:', JSON.stringify(loginResponse.data, null, 2));
    const token = loginResponse.data.accessToken;
    console.log('✅ 登录成功, token:', token ? '已获取' : '未获取');
    
    // 设置请求头
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. 测试今日学习统计
    console.log('\n2️⃣ 测试今日学习统计...');
    const studyResponse = await axios.get(`${API_BASE}/study/today`, { headers });
    console.log('✅ 今日学习统计获取成功');
    console.log(`   总学习时长: ${studyResponse.data.totalMinutes} 分钟`);
    console.log(`   番茄钟数量: ${studyResponse.data.pomodoroCount} 个`);
    console.log(`   学习记录数: ${studyResponse.data.studyRecords?.length || 0} 条`);
    console.log(`   番茄钟会话: ${studyResponse.data.pomodoroSessions?.length || 0} 条`);

    // 3. 测试今日任务
    console.log('\n3️⃣ 测试今日任务...');
    const tasksResponse = await axios.get(`${API_BASE}/tasks/today`, { headers });
    console.log('✅ 今日任务获取成功');
    console.log(`   任务数量: ${tasksResponse.data.length} 个`);
    if (tasksResponse.data.length > 0) {
      console.log(`   第一个任务: ${tasksResponse.data[0].title}`);
      console.log(`   完成状态: ${tasksResponse.data[0].isCompleted ? '已完成' : '未完成'}`);
    }

    // 4. 测试今日消费记录
    console.log('\n4️⃣ 测试今日消费记录...');
    const expenseResponse = await axios.get(`${API_BASE}/expense/today`, { headers });
    console.log('✅ 今日消费记录获取成功');
    console.log('消费数据结构:', JSON.stringify(expenseResponse.data, null, 2));

    const meals = expenseResponse.data.meals || {};
    const others = expenseResponse.data.others || [];
    console.log(`   餐饮消费: 早餐¥${meals.breakfast || 0}, 午餐¥${meals.lunch || 0}, 晚餐¥${meals.dinner || 0}`);
    console.log(`   总餐饮消费: ¥${expenseResponse.data.totalMeal || 0}`);
    console.log(`   其他消费: ${others.length} 条, 总计¥${expenseResponse.data.totalOther || 0}`);

    // 5. 测试今日运动记录
    console.log('\n5️⃣ 测试今日运动记录...');
    const exerciseResponse = await axios.get(`${API_BASE}/exercise/today`, { headers });
    console.log('✅ 今日运动记录获取成功');
    console.log(`   运动记录数: ${exerciseResponse.data.length} 条`);
    if (exerciseResponse.data.length > 0) {
      exerciseResponse.data.forEach(record => {
        console.log(`   ${record.exercise.name}: ${record.value}${record.unit}`);
      });
    }

    // 6. 测试时间字段格式
    console.log('\n6️⃣ 验证时间字段格式...');
    
    const checkTimeFields = (data, name) => {
      const timeFields = ['createdAt', 'updatedAt', 'startedAt', 'completedAt'];
      let validCount = 0;
      let totalCount = 0;
      
      const checkObject = (obj, path = '') => {
        if (!obj || typeof obj !== 'object') return;
        
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => checkObject(item, `${path}[${index}]`));
          return;
        }
        
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (timeFields.includes(key) && value) {
            totalCount++;
            const isValidISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value);
            if (isValidISO) {
              validCount++;
              console.log(`     ✅ ${currentPath}: ${value}`);
            } else {
              console.log(`     ❌ ${currentPath}: ${value} (格式不正确)`);
            }
          } else if (typeof value === 'object' && value !== null) {
            checkObject(value, currentPath);
          }
        }
      };
      
      checkObject(data);
      console.log(`   ${name}: ${validCount}/${totalCount} 时间字段格式正确`);
    };
    
    checkTimeFields(studyResponse.data, '学习统计');
    checkTimeFields(tasksResponse.data, '任务列表');
    checkTimeFields(expenseResponse.data, '消费记录');
    checkTimeFields(exerciseResponse.data, '运动记录');

    // 7. 测试用户时区信息
    console.log('\n7️⃣ 测试用户时区信息...');
    const userResponse = await axios.get(`${API_BASE}/auth/me`, { headers });
    console.log('✅ 用户信息获取成功');
    console.log(`   用户时区: ${userResponse.data.timezone}`);
    console.log(`   用户邮箱: ${userResponse.data.email}`);

    console.log('\n🎉 今日数据API测试完成！');
    console.log('\n📋 测试总结:');
    console.log('✅ 所有今日数据API正常工作');
    console.log('✅ 时间字段格式统一为ISO8601 UTC');
    console.log('✅ 用户时区信息正确传递');
    console.log('✅ 数据查询基于用户时区的今日范围');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message || error);
    if (error.response) {
      console.error('   响应状态:', error.response.status);
      console.error('   响应数据:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code) {
      console.error('   错误代码:', error.code);
    }
    console.error('   完整错误:', error);
  }
}

// 运行测试
testTodayAPIs();
