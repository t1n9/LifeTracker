const axios = require('axios');

// 配置
const API_BASE = 'http://localhost:3002/api';
const EMAIL = 'test@example.com';
const PASSWORD = 'password123';

async function testAPITimezone() {
  try {
    console.log('🧪 测试API时区修复...\n');

    // 1. 登录获取token
    console.log('🔐 正在登录...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    const token = loginResponse.data.access_token;
    console.log('✅ 登录成功');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. 测试获取今日消费记录
    console.log('\n💰 测试获取今日消费记录...');
    const expenseResponse = await axios.get(`${API_BASE}/expense/today`, { headers });
    console.log('今日消费记录:', JSON.stringify(expenseResponse.data, null, 2));

    // 3. 测试获取今日运动记录
    console.log('\n🏃 测试获取今日运动记录...');
    const exerciseResponse = await axios.get(`${API_BASE}/exercise/today`, { headers });
    console.log('今日运动记录:', JSON.stringify(exerciseResponse.data, null, 2));

    // 4. 测试更新今日消费
    console.log('\n💰 测试更新今日消费...');
    const updateExpenseResponse = await axios.put(`${API_BASE}/expense/meals`, {
      breakfast: 20.5,
      lunch: 30.0,
      dinner: 25.0
    }, { headers });
    console.log('更新消费结果:', JSON.stringify(updateExpenseResponse.data, null, 2));

    // 5. 再次获取今日消费记录验证
    console.log('\n💰 验证更新后的今日消费记录...');
    const verifyExpenseResponse = await axios.get(`${API_BASE}/expense/today`, { headers });
    console.log('验证消费记录:', JSON.stringify(verifyExpenseResponse.data, null, 2));

    // 6. 测试更新今日运动
    console.log('\n🏃 测试更新今日运动...');
    const updateExerciseResponse = await axios.put(`${API_BASE}/exercise/records/today`, {
      records: [
        { exerciseId: null, exerciseName: '跑步', value: 5.0 },
        { exerciseId: null, exerciseName: '俯卧撑', value: 50 }
      ]
    }, { headers });
    console.log('更新运动结果:', JSON.stringify(updateExerciseResponse.data, null, 2));

    // 7. 再次获取今日运动记录验证
    console.log('\n🏃 验证更新后的今日运动记录...');
    const verifyExerciseResponse = await axios.get(`${API_BASE}/exercise/today`, { headers });
    console.log('验证运动记录:', JSON.stringify(verifyExerciseResponse.data, null, 2));

    // 8. 检查日期是否正确
    console.log('\n📅 检查日期正确性...');
    const currentDate = new Date().toLocaleDateString('zh-CN');
    console.log(`当前本地日期: ${currentDate}`);
    
    // 检查消费记录的日期
    if (verifyExpenseResponse.data.success && verifyExpenseResponse.data.data.length > 0) {
      const expenseDate = new Date(verifyExpenseResponse.data.data[0].date).toLocaleDateString('zh-CN');
      console.log(`消费记录日期: ${expenseDate}`);
      console.log(`日期匹配: ${currentDate === expenseDate ? '✅ 正确' : '❌ 错误'}`);
    }
    
    // 检查运动记录的日期
    if (verifyExerciseResponse.data.success && verifyExerciseResponse.data.data.length > 0) {
      const exerciseDate = new Date(verifyExerciseResponse.data.data[0].date).toLocaleDateString('zh-CN');
      console.log(`运动记录日期: ${exerciseDate}`);
      console.log(`日期匹配: ${currentDate === exerciseDate ? '✅ 正确' : '❌ 错误'}`);
    }

    // 9. 测试历史数据查询
    console.log('\n📊 测试历史数据查询...');
    const historyResponse = await axios.get(`${API_BASE}/history/dates`, { headers });
    console.log('历史日期列表:', JSON.stringify(historyResponse.data, null, 2));

    // 10. 测试统计数据
    console.log('\n📈 测试统计数据...');
    const statsResponse = await axios.get(`${API_BASE}/expense/stats`, { headers });
    console.log('消费统计:', JSON.stringify(statsResponse.data, null, 2));

    console.log('\n✅ API时区测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('💡 提示: 用户名或密码错误，请检查凭据');
    }
  }
}

testAPITimezone();
