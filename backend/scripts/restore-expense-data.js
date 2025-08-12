const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const USER_ID = 'eb8c8975-1db5-400c-8250-c2c99e36b335'; // 从日志中获取的用户ID

// 数据库连接配置
const client = new Client({
  host: '120.25.232.54',
  port: 5432,
  database: 'lifetracker',
  user: 'lifetracker',
  password: 'TINGWU...123'
});

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function restoreExpenseData() {
  try {
    console.log('🔄 开始恢复消费数据...');
    console.log(`👤 使用用户ID: ${USER_ID}`);

    // 连接数据库
    await client.connect();
    console.log('🔗 数据库连接成功');

    // 确保用户存在
    const userCheckQuery = 'SELECT id FROM users WHERE id = $1';
    const userResult = await client.query(userCheckQuery, [USER_ID]);

    if (userResult.rows.length === 0) {
      console.log('👤 用户不存在，创建用户...');
      const createUserQuery = `
        INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
      `;
      await client.query(createUserQuery, [
        USER_ID,
        'test@example.com',
        '$2b$12$dummy.hash.for.restored.user',
        'Restored User'
      ]);
      console.log('✅ 用户创建成功');
    } else {
      console.log('✅ 用户已存在');
    }
    
    // 读取data文件夹中的所有JSON文件
    const dataDir = path.join(__dirname, '../../data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
    
    console.log(`📁 找到 ${files.length} 个数据文件`);
    
    let restoredCount = 0;
    let skippedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // 提取日期
      const dateStr = data.date;
      if (!dateStr) {
        console.log(`⚠️  跳过文件 ${file}: 没有日期信息`);
        skippedCount++;
        continue;
      }
      
      const date = new Date(dateStr);
      
      // 检查是否有消费数据
      const expenses = data.expenses;
      if (!expenses) {
        console.log(`⚠️  跳过文件 ${file}: 没有消费数据`);
        skippedCount++;
        continue;
      }
      
      // 检查是否有实际的消费记录
      const hasExpenseData = expenses.breakfast > 0 || 
                            expenses.lunch > 0 || 
                            expenses.dinner > 0 || 
                            (expenses.other && expenses.other.length > 0) ||
                            (expenses.customCategories && Object.keys(expenses.customCategories).length > 0);
      
      if (!hasExpenseData) {
        console.log(`⚠️  跳过文件 ${file}: 没有实际消费记录`);
        skippedCount++;
        continue;
      }
      
      console.log(`📊 处理 ${dateStr} 的消费数据...`);
      
      // 插入数据到数据库
      const insertQuery = `
        INSERT INTO expenses (id, user_id, date, breakfast, lunch, dinner, custom_categories, other, total, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (user_id, date) DO NOTHING
      `;

      const values = [
        generateUUID(),
        USER_ID,
        dateStr,
        expenses.breakfast || 0,
        expenses.lunch || 0,
        expenses.dinner || 0,
        JSON.stringify(expenses.customCategories || {}),
        JSON.stringify(expenses.other || []),
        expenses.total || 0
      ];

      const result = await client.query(insertQuery, values);
      
      console.log(`✅ 恢复 ${dateStr} 的消费数据: 总计 ${expenses.total} 元`);
      restoredCount++;
    }
    
    console.log(`\n🎉 数据恢复完成!`);
    console.log(`✅ 成功恢复: ${restoredCount} 条记录`);
    console.log(`⚠️  跳过: ${skippedCount} 条记录`);
    
  } catch (error) {
    console.error('❌ 恢复数据时出错:', error);
  } finally {
    await client.end();
  }
}

// 运行恢复脚本
restoreExpenseData();
