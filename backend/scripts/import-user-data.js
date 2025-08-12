const fs = require('fs');
const path = require('path');
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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function importUserData() {
  try {
    console.log('🔄 开始导入用户数据...');
    console.log(`📧 目标邮箱: ${TARGET_EMAIL}`);
    
    // 连接数据库
    await client.connect();
    console.log('🔗 数据库连接成功');
    
    // 1. 创建或获取用户
    let userId;
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUserResult = await client.query(existingUserQuery, [TARGET_EMAIL]);
    
    if (existingUserResult.rows.length > 0) {
      userId = existingUserResult.rows[0].id;
      console.log(`✅ 用户已存在: ${userId}`);
      
      // 清理现有数据
      console.log('🧹 清理现有数据...');
      await client.query('DELETE FROM expense_records WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM exercise_records WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM health_records WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM daily_data WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM study_records WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM pomodoro_sessions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM tasks WHERE user_id = $1', [userId]);
      console.log('✅ 现有数据清理完成');
    } else {
      // 创建新用户
      console.log('👤 创建新用户...');
      userId = generateUUID();
      const hashedPassword = '$2b$12$dummy.hash.for.imported.user'; // 临时密码哈希
      
      const createUserQuery = `
        INSERT INTO users (id, email, password_hash, name, target_name, target_date, exam_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `;
      await client.query(createUserQuery, [
        userId,
        TARGET_EMAIL,
        hashedPassword,
        '数据导入用户',
        '雅思',
        '2025-08-27',
        '2025-12-20'
      ]);
      
      // 创建用户设置
      const createSettingsQuery = `
        INSERT INTO user_settings (id, user_id, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
      `;
      await client.query(createSettingsQuery, [generateUUID(), userId]);
      
      console.log(`✅ 用户创建成功: ${userId}`);
    }
    
    // 2. 读取所有数据文件
    console.log('📁 读取数据文件...');
    const dataDir = path.join(__dirname, '../../data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
    console.log(`📊 找到 ${files.length} 个数据文件`);
    
    let importCounts = {
      tasks: 0,
      studyRecords: 0,
      pomodoroSessions: 0,
      exerciseRecords: 0,
      expenseRecords: 0,
      healthRecords: 0,
      dailyData: 0
    };
    
    // 3. 导入数据
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
      
      // 导入任务数据
      if (data.tasks && data.tasks.length > 0) {
        for (const task of data.tasks) {
          try {
            const taskQuery = `
              INSERT INTO tasks (id, user_id, title, description, is_completed, priority, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `;
            await client.query(taskQuery, [
              generateUUID(), // 总是生成新的UUID避免冲突
              userId,
              task.text || task.title || '未命名任务',
              task.description || null,
              task.completed || false,
              task.priority || 1,
              task.createdAt || new Date(dateStr).toISOString()
            ]);
            importCounts.tasks++;
          } catch (error) {
            console.log(`⚠️  任务导入失败: ${error.message}`);
          }
        }
      }
      
      // 导入学习记录
      if (data.study && data.study.sessions && data.study.sessions.length > 0) {
        for (const session of data.study.sessions) {
          try {
            const studyQuery = `
              INSERT INTO study_records (id, user_id, duration, subject, task_id, started_at, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $6)
            `;
            await client.query(studyQuery, [
              generateUUID(),
              userId,
              session.duration || 25,
              session.subject || '学习',
              session.taskId ? session.taskId.toString() : null,
              session.timestamp || new Date(dateStr).toISOString()
            ]);
            importCounts.studyRecords++;
          } catch (error) {
            console.log(`⚠️  学习记录导入失败: ${error.message}`);
          }
        }
      }
      
      // 导入番茄钟记录
      if (data.study && data.study.sessions && data.study.sessions.length > 0) {
        for (const session of data.study.sessions) {
          try {
            const pomodoroQuery = `
              INSERT INTO pomodoro_sessions (id, user_id, task_id, duration, status, type, started_at, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
            `;
            await client.query(pomodoroQuery, [
              generateUUID(),
              userId,
              session.taskId ? session.taskId.toString() : null,
              session.duration || 25,
              'COMPLETED',
              'WORK',
              session.timestamp || new Date(dateStr).toISOString()
            ]);
            importCounts.pomodoroSessions++;
          } catch (error) {
            console.log(`⚠️  番茄钟记录导入失败: ${error.message}`);
          }
        }
      }

      // 导入运动记录
      if (data.exercise) {
        const exerciseTypes = [
          { key: 'running', name: '跑步', value: data.exercise.running, unit: 'km', type: 'DISTANCE' },
          { key: 'pushUps', name: '俯卧撑', value: data.exercise.pushUps, unit: '个', type: 'COUNT' },
          { key: 'pullUps', name: '单杠', value: data.exercise.pullUps, unit: '个', type: 'COUNT' },
          { key: 'squats', name: '深蹲', value: data.exercise.squats, unit: '个', type: 'COUNT' },
          { key: 'swimming', name: '游泳', value: data.exercise.swimming, unit: 'km', type: 'DISTANCE' },
          { key: 'cycling', name: '骑车', value: data.exercise.cycling, unit: 'km', type: 'DISTANCE' }
        ];

        for (const exerciseType of exerciseTypes) {
          if (exerciseType.value > 0) {
            try {
              // 确保运动类型存在
              const exerciseTypeQuery = `
                INSERT INTO exercise_types (id, user_id, name, type, unit, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                ON CONFLICT (user_id, name) DO UPDATE SET updated_at = NOW()
                RETURNING id
              `;
              const exerciseTypeId = generateUUID();
              await client.query(exerciseTypeQuery, [
                exerciseTypeId,
                userId,
                exerciseType.name,
                exerciseType.type,
                exerciseType.unit
              ]);

              // 获取运动类型ID
              const getTypeIdQuery = `SELECT id FROM exercise_types WHERE user_id = $1 AND name = $2`;
              const typeIdResult = await client.query(getTypeIdQuery, [userId, exerciseType.name]);
              const actualExerciseTypeId = typeIdResult.rows[0]?.id || exerciseTypeId;

              // 插入运动记录
              const exerciseRecordQuery = `
                INSERT INTO exercise_records (id, user_id, exercise_id, date, value, unit, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                ON CONFLICT (user_id, exercise_id, date) DO UPDATE SET
                  value = EXCLUDED.value,
                  updated_at = NOW()
              `;
              await client.query(exerciseRecordQuery, [
                generateUUID(),
                userId,
                actualExerciseTypeId,
                dateStr,
                exerciseType.value,
                exerciseType.unit
              ]);
              importCounts.exerciseRecords++;
            } catch (error) {
              console.log(`⚠️  运动记录导入失败 (${exerciseType.name}): ${error.message}`);
            }
          }
        }
      }

      // 导入消费记录
      if (data.expenses) {
        const expenses = data.expenses;

        // 导入早餐记录
        if (expenses.breakfast > 0) {
          try {
            await client.query(`
              INSERT INTO expense_records (id, user_id, date, type, category, amount, description, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            `, [
              generateUUID(),
              userId,
              dateStr,
              'MEAL',
              'breakfast',
              expenses.breakfast,
              '早餐',
              new Date(dateStr).toISOString()
            ]);
            importCounts.expenseRecords++;
          } catch (error) {
            console.log(`⚠️  早餐记录导入失败: ${error.message}`);
          }
        }

        // 导入午餐记录
        if (expenses.lunch > 0) {
          try {
            await client.query(`
              INSERT INTO expense_records (id, user_id, date, type, category, amount, description, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            `, [
              generateUUID(),
              userId,
              dateStr,
              'MEAL',
              'lunch',
              expenses.lunch,
              '午餐',
              new Date(dateStr).toISOString()
            ]);
            importCounts.expenseRecords++;
          } catch (error) {
            console.log(`⚠️  午餐记录导入失败: ${error.message}`);
          }
        }

        // 导入晚餐记录
        if (expenses.dinner > 0) {
          try {
            await client.query(`
              INSERT INTO expense_records (id, user_id, date, type, category, amount, description, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            `, [
              generateUUID(),
              userId,
              dateStr,
              'MEAL',
              'dinner',
              expenses.dinner,
              '晚餐',
              new Date(dateStr).toISOString()
            ]);
            importCounts.expenseRecords++;
          } catch (error) {
            console.log(`⚠️  晚餐记录导入失败: ${error.message}`);
          }
        }

        // 导入其他消费记录
        if (expenses.other && Array.isArray(expenses.other)) {
          for (const otherExpense of expenses.other) {
            if (otherExpense.amount > 0) {
              try {
                await client.query(`
                  INSERT INTO expense_records (id, user_id, date, type, category, amount, description, created_at, updated_at)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
                `, [
                  generateUUID(),
                  userId,
                  dateStr,
                  'OTHER',
                  'other',
                  otherExpense.amount,
                  otherExpense.name || otherExpense.description || '其他消费',
                  new Date(dateStr).toISOString()
                ]);
                importCounts.expenseRecords++;
              } catch (error) {
                console.log(`⚠️  其他消费记录导入失败: ${error.message}`);
              }
            }
          }
        }
      }

      // 导入健康记录
      if (data.health) {
        try {
          const healthQuery = `
            INSERT INTO health_records (id, user_id, date, weight, sleep_hours, sleep_quality, phone_usage, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (user_id, date) DO UPDATE SET
              weight = EXCLUDED.weight,
              sleep_hours = EXCLUDED.sleep_hours,
              sleep_quality = EXCLUDED.sleep_quality,
              phone_usage = EXCLUDED.phone_usage,
              updated_at = NOW()
          `;
          await client.query(healthQuery, [
            generateUUID(),
            userId,
            dateStr,
            data.health.weight || null,
            data.health.sleepHours || null,
            data.health.sleepQuality || null,
            data.health.phoneUsage || null
          ]);
          importCounts.healthRecords++;
        } catch (error) {
          console.log(`⚠️  健康记录导入失败: ${error.message}`);
        }
      }

      // 导入每日数据
      if (data.dayStart || data.dayReflection || data.exercise?.feeling) {
        try {
          const dailyDataQuery = `
            INSERT INTO daily_data (id, user_id, date, day_start, day_reflection, reflection_time, exercise_feeling, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (user_id, date) DO UPDATE SET
              day_start = EXCLUDED.day_start,
              day_reflection = EXCLUDED.day_reflection,
              reflection_time = EXCLUDED.reflection_time,
              exercise_feeling = EXCLUDED.exercise_feeling,
              updated_at = NOW()
          `;
          await client.query(dailyDataQuery, [
            generateUUID(),
            userId,
            dateStr,
            data.dayStart || null,
            data.dayReflection || null,
            data.reflectionTime || null,
            data.exercise?.feeling || null
          ]);
          importCounts.dailyData++;
        } catch (error) {
          console.log(`⚠️  每日数据导入失败: ${error.message}`);
        }
      }
    }

    console.log(`\n🎉 数据导入完成!`);
    console.log(`👤 用户ID: ${userId}`);
    console.log(`📧 邮箱: ${TARGET_EMAIL}`);
    console.log(`🔑 注意: 请通过管理员重置密码`);
    console.log(`\n📊 导入统计:`);
    console.log(`✅ 任务: ${importCounts.tasks} 条`);
    console.log(`✅ 学习记录: ${importCounts.studyRecords} 条`);
    console.log(`✅ 番茄钟: ${importCounts.pomodoroSessions} 条`);
    console.log(`✅ 运动记录: ${importCounts.exerciseRecords} 条`);
    console.log(`✅ 消费记录: ${importCounts.expenseRecords} 条`);
    console.log(`✅ 健康记录: ${importCounts.healthRecords} 条`);
    console.log(`✅ 每日数据: ${importCounts.dailyData} 条`);
    
  } catch (error) {
    console.error('❌ 导入数据时出错:', error);
  } finally {
    await client.end();
  }
}

// 运行导入脚本
importUserData();
