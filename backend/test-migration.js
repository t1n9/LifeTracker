const axios = require('axios');

// 配置
const API_BASE = 'http://localhost:3002/api';
const EMAIL = 'test@example.com'; // 你的邮箱
const PASSWORD = 'password123'; // 你的密码

async function testMigration() {
  try {
    console.log('🔐 正在登录...');
    console.log('API地址:', `${API_BASE}/auth/login`);
    console.log('邮箱:', EMAIL);

    // 1. 登录获取token
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    }, {
      timeout: 10000 // 10秒超时
    });

    const token = loginResponse.data.access_token;
    console.log('✅ 登录成功，Token:', token.substring(0, 20) + '...');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // 2. 检查迁移状态
    console.log('\n📊 检查迁移状态...');
    const statusResponse = await axios.get(`${API_BASE}/migration/status`, { headers });
    console.log('迁移状态:', statusResponse.data);
    
    // 3. 如果还没有迁移，执行完整迁移
    if (!statusResponse.data.data.isCompleted) {
      console.log('\n🚀 开始执行完整迁移...');
      const migrationResponse = await axios.post(`${API_BASE}/migration/full-migration`, {}, { headers });
      console.log('迁移结果:', migrationResponse.data);
    } else {
      console.log('⚠️ 迁移已经完成过了');
    }
    
    // 4. 检查今日消费记录
    console.log('\n💰 检查今日消费记录...');
    const expenseResponse = await axios.get(`${API_BASE}/expense/today`, { headers });
    console.log('今日消费:', expenseResponse.data);
    
    // 5. 检查今日运动记录
    console.log('\n🏃 检查今日运动记录...');
    const exerciseResponse = await axios.get(`${API_BASE}/exercise/today`, { headers });
    console.log('今日运动:', exerciseResponse.data);
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 错误:', error.response?.data || error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 提示: 请确保后端服务正在运行 (npm run start:dev)');
    }
    if (error.response?.status === 401) {
      console.error('💡 提示: 用户名或密码错误，请检查凭据');
    }
  }
}

testMigration();
