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

async function restoreExerciseData() {
  try {
    console.log('🔄 开始恢复运动数据...');
    
    // 连接数据库
    await client.connect();
    console.log('🔗 数据库连接成功');
    
    // 读取data文件夹中的所有JSON文件
    const dataDir = path.join(__dirname, '../../data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
    
    console.log(`📁 找到 ${files.length} 个数据文件`);
    
    let restoredCount = 0;
    
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      const dateStr = data.date;
      if (!dateStr || !data.exercise) {
        continue;
      }
      
      const date = new Date(dateStr);
      const exercise = data.exercise;
      
      // 检查是否有运动数据
      const hasExerciseData = exercise.running > 0 || exercise.pushUps > 0 || 
                             exercise.pullUps > 0 || exercise.squats > 0 || 
                             exercise.swimming > 0 || exercise.cycling > 0;
      
      if (!hasExerciseData) {
        continue;
      }
      
      console.log(`📊 处理 ${dateStr} 的运动数据...`);
      
      // 直接插入到 exercise_records 表，使用简化的结构
      const exerciseTypes = [
        { key: 'running', name: '跑步', value: exercise.running, unit: 'km' },
        { key: 'pushUps', name: '俯卧撑', value: exercise.pushUps, unit: '个' },
        { key: 'pullUps', name: '单杠', value: exercise.pullUps, unit: '个' },
        { key: 'squats', name: '深蹲', value: exercise.squats, unit: '个' },
        { key: 'swimming', name: '游泳', value: exercise.swimming, unit: 'km' },
        { key: 'cycling', name: '骑车', value: exercise.cycling, unit: 'km' }
      ];
      
      for (const exerciseType of exerciseTypes) {
        if (exerciseType.value > 0) {
          try {
            // 首先确保运动类型存在
            const exerciseTypeQuery = `
              INSERT INTO exercise_types (id, user_id, name, type, unit, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
              ON CONFLICT (user_id, name) DO UPDATE SET updated_at = NOW()
              RETURNING id
            `;
            const exerciseTypeId = generateUUID();
            const typeResult = await client.query(exerciseTypeQuery, [
              exerciseTypeId,
              USER_ID,
              exerciseType.name,
              exerciseType.key.includes('running') || exerciseType.key.includes('swimming') || exerciseType.key.includes('cycling') ? 'DISTANCE' : 'COUNT',
              exerciseType.unit
            ]);

            // 获取运动类型ID
            const getTypeIdQuery = `SELECT id FROM exercise_types WHERE user_id = $1 AND name = $2`;
            const typeIdResult = await client.query(getTypeIdQuery, [USER_ID, exerciseType.name]);
            const actualExerciseTypeId = typeIdResult.rows[0]?.id || exerciseTypeId;

            // 插入运动记录
            const exerciseRecordQuery = `
              INSERT INTO exercise_records (id, user_id, exercise_id, date, value, unit, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            `;
            await client.query(exerciseRecordQuery, [
              generateUUID(),
              USER_ID,
              actualExerciseTypeId,
              dateStr,
              exerciseType.value,
              exerciseType.unit
            ]);
            restoredCount++;
          } catch (error) {
            console.log(`⚠️  运动记录恢复失败 (${exerciseType.name}): ${error.message}`);
          }
        }
      }
    }
    
    console.log(`\n🎉 运动数据恢复完成!`);
    console.log(`✅ 成功恢复: ${restoredCount} 条运动记录`);
    
  } catch (error) {
    console.error('❌ 恢复运动数据时出错:', error);
  } finally {
    await client.end();
  }
}

// 运行恢复脚本
restoreExerciseData();
