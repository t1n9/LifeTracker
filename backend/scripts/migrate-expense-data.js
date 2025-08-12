const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const USER_ID = 'eb8c8975-1db5-400c-8250-c2c99e36b335';

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

async function migrateExpenseData() {
  try {
    console.log('🔄 开始迁移消费数据到优化后的结构...');
    
    // 连接数据库
    await client.connect();
    console.log('🔗 数据库连接成功');
    
    // 1. 从本地JSON文件获取数据
    console.log('📊 从本地JSON文件获取数据...');
    const dataDir = path.join(__dirname, '../../data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));

    const expenseDataList = [];
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (data.date && data.expenses) {
        const expenses = data.expenses;
        const hasExpenseData = expenses.breakfast > 0 ||
                              expenses.lunch > 0 ||
                              expenses.dinner > 0 ||
                              (expenses.other && expenses.other.length > 0) ||
                              (expenses.customCategories && Object.keys(expenses.customCategories).length > 0);

        if (hasExpenseData) {
          expenseDataList.push({
            date: data.date,
            expenses: expenses,
            createdAt: new Date(data.date).toISOString()
          });
        }
      }
    }

    console.log(`✅ 找到 ${expenseDataList.length} 个有消费数据的日期`);
    
    // 2. 清空现有的 expense_records 表中的数据（避免重复）
    console.log('🧹 清理现有的 expense_records 数据...');
    await client.query('DELETE FROM expense_records WHERE user_id = $1', [USER_ID]);
    
    let migratedCount = 0;
    
    // 3. 将数据转换为新格式并插入
    for (const expenseData of expenseDataList) {
      const date = expenseData.date;
      const expenses = expenseData.expenses;
      
      // 插入早餐记录
      if (expenses.breakfast > 0) {
        await client.query(`
          INSERT INTO expense_records (id, user_id, date, type, category, amount, description, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        `, [
          generateUUID(),
          USER_ID,
          date,
          'MEAL',
          'breakfast',
          expenses.breakfast,
          '早餐',
          expenseData.createdAt
        ]);
        migratedCount++;
      }
      
      // 插入午餐记录
      if (expenses.lunch > 0) {
        await client.query(`
          INSERT INTO expense_records (id, user_id, date, type, category, amount, description, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        `, [
          generateUUID(),
          USER_ID,
          date,
          'MEAL',
          'lunch',
          expenses.lunch,
          '午餐',
          expenseData.createdAt
        ]);
        migratedCount++;
      }

      // 插入晚餐记录
      if (expenses.dinner > 0) {
        await client.query(`
          INSERT INTO expense_records (id, user_id, date, type, category, amount, description, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        `, [
          generateUUID(),
          USER_ID,
          date,
          'MEAL',
          'dinner',
          expenses.dinner,
          '晚餐',
          expenseData.createdAt
        ]);
        migratedCount++;
      }
      
      // 插入自定义类别消费
      if (expenses.customCategories && typeof expenses.customCategories === 'object') {
        const customCategories = expenses.customCategories;
        for (const [category, amount] of Object.entries(customCategories)) {
          if (amount > 0) {
            await client.query(`
              INSERT INTO expense_records (id, user_id, date, type, category, amount, description, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            `, [
              generateUUID(),
              USER_ID,
              date,
              'OTHER',
              category,
              amount,
              category,
              expenseData.createdAt
            ]);
            migratedCount++;
          }
        }
      }
      
      // 插入其他消费记录
      if (expenses.other && Array.isArray(expenses.other)) {
        for (const otherExpense of expenses.other) {
          if (otherExpense.amount > 0) {
            await client.query(`
              INSERT INTO expense_records (id, user_id, date, type, category, amount, description, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            `, [
              generateUUID(),
              USER_ID,
              date,
              'OTHER',
              'other',
              otherExpense.amount,
              otherExpense.name || otherExpense.description || '其他消费',
              expenseData.createdAt
            ]);
            migratedCount++;
          }
        }
      }
      
      console.log(`✅ 迁移 ${date} 的消费数据`);
    }
    
    // 4. 验证迁移结果
    console.log('\n🔍 验证迁移结果...');
    const newRecordsQuery = `
      SELECT 
        date,
        type,
        category,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM expense_records 
      WHERE user_id = $1 
      GROUP BY date, type, category 
      ORDER BY date, type, category
    `;
    const newRecordsResult = await client.query(newRecordsQuery, [USER_ID]);
    
    console.log('\n📊 迁移后的数据统计:');
    for (const record of newRecordsResult.rows) {
      console.log(`${record.date} - ${record.type}(${record.category}): ${record.count}条记录, 总计${record.total_amount}元`);
    }
    
    console.log(`\n🎉 数据迁移完成!`);
    console.log(`✅ 总共迁移了 ${migratedCount} 条消费记录`);
    console.log(`📊 从 ${expenseDataList.length} 个日期的数据转换而来`);
    
  } catch (error) {
    console.error('❌ 迁移数据时出错:', error);
  } finally {
    await client.end();
  }
}

// 运行迁移脚本
migrateExpenseData();
