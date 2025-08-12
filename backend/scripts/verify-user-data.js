const { Client } = require('pg');

const TARGET_EMAIL = '1378006836@qq.com';

// 数据库连接配置
const client = new Client({
  host: '120.25.232.54',
  port: 5432,
  database: 'lifetracker',
  user: 'lifetracker',
  password: 'TINGWU...123'
});

async function verifyUserData() {
  try {
    console.log('🔍 开始验证用户数据...');
    console.log(`📧 目标邮箱: ${TARGET_EMAIL}`);
    
    // 连接数据库
    await client.connect();
    console.log('🔗 数据库连接成功');
    
    // 查找用户
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await client.query(userQuery, [TARGET_EMAIL]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }
    
    const user = userResult.rows[0];
    const userId = user.id;
    
    console.log('\n👤 用户信息:');
    console.log(`   ID: ${user.id}`);
    console.log(`   邮箱: ${user.email}`);
    console.log(`   姓名: ${user.name}`);
    console.log(`   目标: ${user.target_name}`);
    console.log(`   目标日期: ${user.target_date}`);
    console.log(`   考试日期: ${user.exam_date}`);
    
    // 统计各类数据
    const queries = [
      { name: '任务', table: 'tasks', field: 'user_id' },
      { name: '学习记录', table: 'study_records', field: 'user_id' },
      { name: '番茄钟', table: 'pomodoro_sessions', field: 'user_id' },
      { name: '运动记录', table: 'exercise_records', field: 'user_id' },
      { name: '消费记录', table: 'expense_records', field: 'user_id' },
      { name: '健康记录', table: 'health_records', field: 'user_id' },
      { name: '每日数据', table: 'daily_data', field: 'user_id' }
    ];
    
    console.log('\n📊 数据统计:');
    for (const query of queries) {
      const countQuery = `SELECT COUNT(*) as count FROM ${query.table} WHERE ${query.field} = $1`;
      const result = await client.query(countQuery, [userId]);
      const count = result.rows[0].count;
      console.log(`   ${query.name}: ${count} 条`);
    }
    
    // 显示最近的一些数据样例
    console.log('\n📋 最近的任务 (前5条):');
    const tasksQuery = 'SELECT title, is_completed, created_at FROM tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5';
    const tasksResult = await client.query(tasksQuery, [userId]);
    tasksResult.rows.forEach((task, index) => {
      console.log(`   ${index + 1}. ${task.title} ${task.is_completed ? '✅' : '⏳'} (${task.created_at.toISOString().split('T')[0]})`);
    });
    
    console.log('\n💰 最近的消费记录 (前5条):');
    const expensesQuery = 'SELECT type, category, amount, description, date FROM expense_records WHERE user_id = $1 ORDER BY date DESC LIMIT 5';
    const expensesResult = await client.query(expensesQuery, [userId]);
    expensesResult.rows.forEach((expense, index) => {
      console.log(`   ${index + 1}. ${expense.date.toISOString().split('T')[0]} - ${expense.description}: ¥${expense.amount} (${expense.type}/${expense.category})`);
    });
    
    console.log('\n🏃 运动记录:');
    const exerciseQuery = `
      SELECT er.date, et.name, er.value, er.unit 
      FROM exercise_records er 
      JOIN exercise_types et ON er.exercise_id = et.id 
      WHERE er.user_id = $1 
      ORDER BY er.date DESC 
      LIMIT 5
    `;
    const exerciseResult = await client.query(exerciseQuery, [userId]);
    exerciseResult.rows.forEach((exercise, index) => {
      console.log(`   ${index + 1}. ${exercise.date.toISOString().split('T')[0]} - ${exercise.name}: ${exercise.value}${exercise.unit}`);
    });
    
    console.log('\n✅ 数据验证完成！');
    console.log('\n🎯 用户可以使用以下信息登录:');
    console.log(`   邮箱: ${TARGET_EMAIL}`);
    console.log(`   密码: 123456`);
    console.log(`   建议登录后立即修改密码`);
    
  } catch (error) {
    console.error('❌ 验证数据时出错:', error);
  } finally {
    await client.end();
  }
}

// 运行验证脚本
verifyUserData();
