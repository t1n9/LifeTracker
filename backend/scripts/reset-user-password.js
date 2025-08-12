const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const TARGET_EMAIL = '1378006836@qq.com';
const NEW_PASSWORD = '123456'; // 简单密码，用户可以后续修改

// 数据库连接配置
const client = new Client({
  host: '120.25.232.54',
  port: 5432,
  database: 'lifetracker',
  user: 'lifetracker',
  password: 'TINGWU...123'
});

async function resetPassword() {
  try {
    console.log('🔄 开始重置用户密码...');
    console.log(`📧 目标邮箱: ${TARGET_EMAIL}`);
    
    // 连接数据库
    await client.connect();
    console.log('🔗 数据库连接成功');
    
    // 查找用户
    const userQuery = 'SELECT id FROM users WHERE email = $1';
    const userResult = await client.query(userQuery, [TARGET_EMAIL]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`👤 找到用户: ${userId}`);
    
    // 更新密码（使用bcrypt加密）
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 12);
    const updateQuery = 'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2';
    await client.query(updateQuery, [hashedPassword, userId]);
    
    console.log('✅ 密码重置成功！');
    console.log(`📧 邮箱: ${TARGET_EMAIL}`);
    console.log(`🔑 新密码: ${NEW_PASSWORD}`);
    console.log('⚠️  请提醒用户登录后修改密码');
    
  } catch (error) {
    console.error('❌ 重置密码时出错:', error);
  } finally {
    await client.end();
  }
}

// 运行重置脚本
resetPassword();
