const { Client } = require('pg');

// 数据库连接配置
const client = new Client({
  host: '120.25.232.54',
  port: 5432,
  database: 'lifetracker',
  user: 'lifetracker',
  password: 'TINGWU...123'
});

async function addRegistrationControl() {
  try {
    console.log('🚀 开始添加注册控制功能...');
    
    // 连接数据库
    await client.connect();
    console.log('🔗 数据库连接成功');
    
    // 1. 为用户表添加 isAdmin 字段
    console.log('📝 添加用户管理员字段...');
    try {
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
      `);
      console.log('✅ 用户管理员字段添加成功');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  用户管理员字段已存在，跳过');
      } else {
        throw error;
      }
    }
    
    // 2. 启用UUID扩展（如果需要）
    console.log('📝 启用UUID扩展...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      console.log('✅ UUID扩展启用成功');
    } catch (error) {
      console.log('ℹ️  UUID扩展启用失败，尝试其他方法:', error.message);
    }

    // 3. 创建系统配置表
    console.log('📝 创建系统配置表...');
    try {
      await client.query(`
        CREATE TABLE system_configs (
          id SERIAL PRIMARY KEY,
          key VARCHAR(255) UNIQUE NOT NULL,
          value TEXT NOT NULL,
          description TEXT,
          is_public BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('✅ 系统配置表创建成功');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  系统配置表已存在，跳过');
      } else {
        throw error;
      }
    }
    
    // 4. 插入默认配置
    console.log('📝 插入默认系统配置...');
    const defaultConfigs = [
      {
        key: 'registration_enabled',
        value: 'false',
        description: '是否允许用户注册',
        isPublic: true,
      },
      {
        key: 'site_name',
        value: 'LifeTracker',
        description: '网站名称',
        isPublic: true,
      },
      {
        key: 'site_description',
        value: '生活记录系统',
        description: '网站描述',
        isPublic: true,
      },
    ];
    
    for (const config of defaultConfigs) {
      try {
        await client.query(`
          INSERT INTO system_configs (key, value, description, is_public)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (key) DO NOTHING;
        `, [config.key, config.value, config.description, config.isPublic]);
        console.log(`✅ 配置 ${config.key} 插入成功`);
      } catch (error) {
        console.log(`⚠️  配置 ${config.key} 插入失败:`, error.message);
      }
    }
    
    // 5. 设置第一个用户为管理员
    console.log('📝 设置管理员用户...');
    const adminEmail = '1378006836@qq.com'; // 你的邮箱
    
    try {
      const result = await client.query(`
        UPDATE users 
        SET is_admin = TRUE 
        WHERE email = $1;
      `, [adminEmail]);
      
      if (result.rowCount > 0) {
        console.log(`✅ 用户 ${adminEmail} 已设置为管理员`);
      } else {
        console.log(`⚠️  用户 ${adminEmail} 不存在，请先创建用户`);
      }
    } catch (error) {
      console.log('⚠️  设置管理员失败:', error.message);
    }
    
    // 6. 创建更新时间触发器
    console.log('📝 创建更新时间触发器...');
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      
      await client.query(`
        DROP TRIGGER IF EXISTS update_system_configs_updated_at ON system_configs;
        CREATE TRIGGER update_system_configs_updated_at
          BEFORE UPDATE ON system_configs
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
      
      console.log('✅ 更新时间触发器创建成功');
    } catch (error) {
      console.log('⚠️  触发器创建失败:', error.message);
    }
    
    console.log('🎉 注册控制功能添加完成！');
    console.log('');
    console.log('📋 功能说明:');
    console.log('  1. 用户表新增 is_admin 字段');
    console.log('  2. 新增 system_configs 表用于系统配置');
    console.log('  3. 默认关闭注册功能 (registration_enabled = false)');
    console.log('  4. 管理员可以通过 API 开启/关闭注册功能');
    console.log(`  5. 用户 ${adminEmail} 已设置为管理员`);
    console.log('');
    console.log('🔧 使用方法:');
    console.log('  - 管理员登录后可访问 /api/system-config 管理配置');
    console.log('  - 前端可通过 /api/system-config/public 获取公开配置');
    console.log('  - 注册功能受 registration_enabled 配置控制');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 数据库连接已关闭');
  }
}

// 运行迁移
if (require.main === module) {
  addRegistrationControl()
    .then(() => {
      console.log('✅ 迁移完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 迁移失败:', error);
      process.exit(1);
    });
}

module.exports = { addRegistrationControl };
