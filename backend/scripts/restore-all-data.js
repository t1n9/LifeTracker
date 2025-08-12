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

async function restoreAllData() {
  try {
    console.log('🔄 开始恢复所有数据...');
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
        INSERT INTO users (id, email, password_hash, name, target_name, target_date, exam_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `;
      await client.query(createUserQuery, [
        USER_ID,
        'test@example.com',
        '$2b$12$dummy.hash.for.restored.user',
        'Restored User',
        '雅思',
        '2025-08-27',
        '2025-12-20'
      ]);
      console.log('✅ 用户创建成功');
    } else {
      console.log('✅ 用户已存在');
    }
    
    // 读取data文件夹中的所有JSON文件
    const dataDir = path.join(__dirname, '../../data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
    
    console.log(`📁 找到 ${files.length} 个数据文件`);
    
    let restoredCounts = {
      tasks: 0,
      studyRecords: 0,
      pomodoroSessions: 0,
      exerciseRecords: 0,
      expenses: 0,
      healthRecords: 0,
      dailyData: 0
    };
    
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      const dateStr = data.date;
      if (!dateStr) {
        console.log(`⚠️  跳过文件 ${file}: 没有日期信息`);
        continue;
      }
      
      const date = new Date(dateStr);
      console.log(`📊 处理 ${dateStr} 的数据...`);
      
      // 1. 恢复任务数据
      if (data.tasks && data.tasks.length > 0) {
        for (const task of data.tasks) {
          try {
            const taskQuery = `
              INSERT INTO tasks (id, user_id, title, description, is_completed, priority, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
              ON CONFLICT (id) DO NOTHING
            `;
            await client.query(taskQuery, [
              task.id.toString(),
              USER_ID,
              task.text || task.title || '未命名任务',
              task.description || null,
              task.completed || false,
              task.priority || 1,
              task.createdAt || new Date(dateStr).toISOString()
            ]);
            restoredCounts.tasks++;
          } catch (error) {
            console.log(`⚠️  任务恢复失败: ${error.message}`);
          }
        }
      }
      
      // 2. 恢复学习记录
      if (data.study && data.study.sessions && data.study.sessions.length > 0) {
        for (const session of data.study.sessions) {
          try {
            const studyQuery = `
              INSERT INTO study_records (id, user_id, duration, subject, task_id, started_at, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $6)
              ON CONFLICT (id) DO NOTHING
            `;
            await client.query(studyQuery, [
              generateUUID(),
              USER_ID,
              session.duration || 25,
              session.subject || '学习',
              session.taskId ? session.taskId.toString() : null,
              session.timestamp || new Date(dateStr).toISOString()
            ]);
            restoredCounts.studyRecords++;
          } catch (error) {
            console.log(`⚠️  学习记录恢复失败: ${error.message}`);
          }
        }
      }
      
      // 3. 恢复番茄钟记录
      if (data.study && data.study.sessions && data.study.sessions.length > 0) {
        for (const session of data.study.sessions) {
          try {
            const pomodoroQuery = `
              INSERT INTO pomodoro_sessions (id, user_id, task_id, duration, status, type, started_at, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
              ON CONFLICT (id) DO NOTHING
            `;
            await client.query(pomodoroQuery, [
              generateUUID(),
              USER_ID,
              session.taskId ? session.taskId.toString() : null,
              session.duration || 25,
              'COMPLETED',
              'WORK',
              session.timestamp || new Date(dateStr).toISOString()
            ]);
            restoredCounts.pomodoroSessions++;
          } catch (error) {
            console.log(`⚠️  番茄钟记录恢复失败: ${error.message}`);
          }
        }
      }

      // 4. 恢复运动记录
      if (data.exercise) {
        const exerciseTypes = ['running', 'pushUps', 'pullUps', 'squats', 'swimming', 'cycling'];
        for (const exerciseType of exerciseTypes) {
          const value = data.exercise[exerciseType];
          if (value && value > 0) {
            try {
              // 先创建运动类型（如果不存在）
              const exerciseTypeQuery = `
                INSERT INTO exercise_types (id, user_id, name, type, unit, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                ON CONFLICT (user_id, name) DO NOTHING
                RETURNING id
              `;
              const typeNames = {
                running: '跑步',
                pushUps: '俯卧撑',
                pullUps: '单杠',
                squats: '深蹲',
                swimming: '游泳',
                cycling: '骑车'
              };
              const typeUnits = {
                running: 'km',
                pushUps: '个',
                pullUps: '个',
                squats: '个',
                swimming: 'km',
                cycling: 'km'
              };
              const exerciseTypeId = generateUUID();
              await client.query(exerciseTypeQuery, [
                exerciseTypeId,
                USER_ID,
                typeNames[exerciseType],
                exerciseType.includes('running') || exerciseType.includes('swimming') || exerciseType.includes('cycling') ? 'DISTANCE' : 'COUNT',
                typeUnits[exerciseType]
              ]);

              // 创建运动记录
              const exerciseRecordQuery = `
                INSERT INTO exercise_records (id, user_id, exercise_id, date, value, unit, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
              `;
              await client.query(exerciseRecordQuery, [
                generateUUID(),
                USER_ID,
                exerciseTypeId,
                dateStr,
                value,
                typeUnits[exerciseType]
              ]);
              restoredCounts.exerciseRecords++;
            } catch (error) {
              console.log(`⚠️  运动记录恢复失败: ${error.message}`);
            }
          }
        }
      }

      // 5. 恢复健康记录
      if (data.health) {
        try {
          const healthQuery = `
            INSERT INTO health_records (id, user_id, date, weight, sleep_hours, sleep_quality, phone_usage, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (user_id, date) DO NOTHING
          `;
          await client.query(healthQuery, [
            generateUUID(),
            USER_ID,
            dateStr,
            data.health.weight || null,
            data.health.sleepHours || null,
            data.health.sleepQuality || null,
            data.health.phoneUsage || null
          ]);
          restoredCounts.healthRecords++;
        } catch (error) {
          console.log(`⚠️  健康记录恢复失败: ${error.message}`);
        }
      }

      // 6. 恢复每日数据
      if (data.dayStart || data.dayReflection || data.exercise?.feeling) {
        try {
          const dailyDataQuery = `
            INSERT INTO daily_data (id, user_id, date, day_start, day_reflection, reflection_time, exercise_feeling, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (user_id, date) DO NOTHING
          `;
          await client.query(dailyDataQuery, [
            generateUUID(),
            USER_ID,
            dateStr,
            data.dayStart || null,
            data.dayReflection || null,
            data.reflectionTime || null,
            data.exercise?.feeling || null
          ]);
          restoredCounts.dailyData++;
        } catch (error) {
          console.log(`⚠️  每日数据恢复失败: ${error.message}`);
        }
      }

      // 7. 恢复消费记录（如果有的话）
      if (data.expenses && (data.expenses.total > 0 || (data.expenses.other && data.expenses.other.length > 0))) {
        try {
          const expenseQuery = `
            INSERT INTO expenses (id, user_id, date, breakfast, lunch, dinner, custom_categories, other, total, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            ON CONFLICT (user_id, date) DO NOTHING
          `;
          await client.query(expenseQuery, [
            generateUUID(),
            USER_ID,
            dateStr,
            data.expenses.breakfast || 0,
            data.expenses.lunch || 0,
            data.expenses.dinner || 0,
            JSON.stringify(data.expenses.customCategories || {}),
            JSON.stringify(data.expenses.other || []),
            data.expenses.total || 0
          ]);
          restoredCounts.expenses++;
        } catch (error) {
          console.log(`⚠️  消费记录恢复失败: ${error.message}`);
        }
      }
    }

    console.log(`\n🎉 数据恢复完成!`);
    console.log(`✅ 任务: ${restoredCounts.tasks} 条`);
    console.log(`✅ 学习记录: ${restoredCounts.studyRecords} 条`);
    console.log(`✅ 番茄钟: ${restoredCounts.pomodoroSessions} 条`);
    console.log(`✅ 运动记录: ${restoredCounts.exerciseRecords} 条`);
    console.log(`✅ 消费记录: ${restoredCounts.expenses} 条`);
    console.log(`✅ 健康记录: ${restoredCounts.healthRecords} 条`);
    console.log(`✅ 每日数据: ${restoredCounts.dailyData} 条`);
    
  } catch (error) {
    console.error('❌ 恢复数据时出错:', error);
  } finally {
    await client.end();
  }
}

// 运行恢复脚本
restoreAllData();
