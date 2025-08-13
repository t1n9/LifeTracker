/**
 * 数据迁移脚本 - 使用新的时间管理系统
 * 从data文件夹导入用户数据，验证时间处理的正确性
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 简化的时间工具函数
function parseDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function formatDateString(date) {
  return date.toISOString().split('T')[0];
}

async function main() {
  try {
    console.log('🚀 开始数据迁移...\n');

    // 创建测试用户
    const testUser = await createTestUser();
    console.log(`✅ 创建测试用户: ${testUser.email}\n`);

    // 获取data文件夹中的所有JSON文件
    const dataDir = path.join(__dirname, '..', 'data');
    const files = fs.readdirSync(dataDir)
      .filter(file => file.startsWith('daily-data-') && file.endsWith('.json'))
      .sort();

    console.log(`📁 找到 ${files.length} 个数据文件\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        console.log(`📄 处理文件: ${file}`);
        
        const filePath = path.join(dataDir, file);
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);
        
        await migrateDataFile(testUser.id, data);
        successCount++;
        
        console.log(`  ✅ 成功迁移`);
      } catch (error) {
        console.error(`  ❌ 迁移失败: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 迁移统计:`);
    console.log(`  成功: ${successCount} 个文件`);
    console.log(`  失败: ${errorCount} 个文件`);

    // 验证迁移结果
    await validateMigration(testUser.id);

  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 创建测试用户
 */
async function createTestUser() {
  const bcrypt = require('bcrypt');

  // 删除现有的测试用户（如果存在）
  await prisma.user.deleteMany({
    where: { email: 'test@test.com' }
  });

  // 创建密码哈希
  const passwordHash = await bcrypt.hash('test123', 10);

  // 创建新的测试用户
  return await prisma.user.create({
    data: {
      email: 'test@test.com',
      passwordHash: passwordHash,
      name: '测试用户',
      timezone: 'Asia/Shanghai',
      targetName: '雅思',
      targetDate: new Date('2025-08-27T00:00:00Z'),
      examDate: new Date('2025-12-20T00:00:00Z'),
    }
  });
}

/**
 * 迁移单个数据文件
 */
async function migrateDataFile(userId, data) {
  const date = data.date; // YYYY-MM-DD格式
  const dateObj = parseDateString(date);

  // 1. 迁移学习记录
  if (data.study && data.study.sessions) {
    for (const session of data.study.sessions) {
      await prisma.studyRecord.create({
        data: {
          userId,
          duration: session.duration,
          subject: '学习',
          startedAt: new Date(session.timestamp),
          completedAt: new Date(new Date(session.timestamp).getTime() + session.duration * 60000),
        }
      });
    }
  }

  // 2. 迁移任务
  if (data.tasks) {
    for (const task of data.tasks) {
      await prisma.task.create({
        data: {
          userId,
          title: task.text,
          isCompleted: task.completed,
          createdAt: new Date(task.createdAt),
        }
      });
    }
  }

  // 3. 迁移运动记录
  if (data.exercise) {
    const exerciseTypes = ['pullUps', 'squats', 'pushUps', 'running', 'swimming', 'cycling'];
    
    for (const type of exerciseTypes) {
      const value = data.exercise[type];
      if (value && value > 0) {
        // 确保运动类型存在
        let exerciseType = await prisma.exerciseType.findFirst({
          where: { userId, name: getExerciseName(type) }
        });

        if (!exerciseType) {
          exerciseType = await prisma.exerciseType.create({
            data: {
              userId,
              name: getExerciseName(type),
              type: getExerciseType(type),
              unit: getExerciseUnit(type),
            }
          });
        }

        // 创建运动记录
        await prisma.exerciseRecord.create({
          data: {
            userId,
            exerciseId: exerciseType.id,
            date: dateObj,
            value: value,
            unit: getExerciseUnit(type),
          }
        });
      }
    }
  }

  // 4. 迁移消费记录
  if (data.expenses) {
    const meals = ['breakfast', 'lunch', 'dinner'];
    
    for (const meal of meals) {
      const amount = data.expenses[meal];
      if (amount && amount > 0) {
        await prisma.expenseRecord.create({
          data: {
            userId,
            date: dateObj,
            type: 'MEAL',
            category: meal,
            amount: amount,
            time: '12:00', // 默认时间
          }
        });
      }
    }

    // 其他消费
    if (data.expenses.other && Array.isArray(data.expenses.other)) {
      for (const expense of data.expenses.other) {
        await prisma.expenseRecord.create({
          data: {
            userId,
            date: dateObj,
            type: 'OTHER',
            category: 'other',
            description: expense.description || '其他消费',
            amount: expense.amount,
            time: expense.time || '12:00',
          }
        });
      }
    }
  }

  // 5. 迁移健康记录
  if (data.health) {
    await prisma.healthRecord.create({
      data: {
        userId,
        date: dateObj,
        weight: data.health.weight || null,
        sleepHours: data.health.sleepHours || null,
        sleepQuality: data.health.sleepQuality || null,
        phoneUsage: data.health.phoneUsage || null,
      }
    });
  }

  // 6. 迁移每日数据
  await prisma.dailyData.create({
    data: {
      userId,
      date: dateObj,
      totalMinutes: data.study?.totalMinutes || 0,
      pomodoroCount: data.study?.pomodoroCount || 0,
      dayStart: data.dayStart || null,
      dayReflection: data.dayReflection || null,
      reflectionTime: data.reflectionTime || null,
      focusMode: data.focusMode || false,
      focusQuoteIndex: data.focusQuoteIndex || 0,
      exerciseFeeling: data.exercise?.feeling || null,
    }
  });
}

/**
 * 获取运动名称
 */
function getExerciseName(type) {
  const names = {
    pullUps: '引体向上',
    squats: '深蹲',
    pushUps: '俯卧撑',
    running: '跑步',
    swimming: '游泳',
    cycling: '骑行',
  };
  return names[type] || type;
}

/**
 * 获取运动类型
 */
function getExerciseType(type) {
  const types = {
    pullUps: 'COUNT',
    squats: 'COUNT',
    pushUps: 'COUNT',
    running: 'DISTANCE',
    swimming: 'DISTANCE',
    cycling: 'DISTANCE',
  };
  return types[type] || 'COUNT';
}

/**
 * 获取运动单位
 */
function getExerciseUnit(type) {
  const units = {
    pullUps: '次',
    squats: '次',
    pushUps: '次',
    running: '公里',
    swimming: '公里',
    cycling: '公里',
  };
  return units[type] || '次';
}

/**
 * 验证迁移结果
 */
async function validateMigration(userId) {
  console.log('\n🔍 验证迁移结果...\n');

  // 统计各类数据
  const stats = await Promise.all([
    prisma.studyRecord.count({ where: { userId } }),
    prisma.task.count({ where: { userId } }),
    prisma.exerciseRecord.count({ where: { userId } }),
    prisma.expenseRecord.count({ where: { userId } }),
    prisma.healthRecord.count({ where: { userId } }),
    prisma.dailyData.count({ where: { userId } }),
  ]);

  console.log('📊 迁移数据统计:');
  console.log(`  学习记录: ${stats[0]} 条`);
  console.log(`  任务: ${stats[1]} 条`);
  console.log(`  运动记录: ${stats[2]} 条`);
  console.log(`  消费记录: ${stats[3]} 条`);
  console.log(`  健康记录: ${stats[4]} 条`);
  console.log(`  每日数据: ${stats[5]} 条`);

  // 验证时间字段格式
  console.log('\n⏰ 验证时间字段格式...');
  
  const sampleStudyRecord = await prisma.studyRecord.findFirst({
    where: { userId }
  });
  
  if (sampleStudyRecord) {
    console.log('  学习记录时间格式:');
    console.log(`    startedAt: ${sampleStudyRecord.startedAt.toISOString()}`);
    console.log(`    completedAt: ${sampleStudyRecord.completedAt?.toISOString()}`);
    console.log(`    createdAt: ${sampleStudyRecord.createdAt.toISOString()}`);
  }

  console.log('\n✅ 迁移验证完成！');
}

// 运行迁移
main().catch(console.error);
