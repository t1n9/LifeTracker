const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 获取当前北京时间
function getCurrentBeijingTime() {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
}

// 获取默认运动类型数据
function getDefaultExerciseTypeData(exerciseName) {
  const exerciseTypeMap = {
    '跑步': { name: '跑步', type: 'DISTANCE', unit: 'km', increment: 0.5, icon: '🏃', color: '#FF6B6B' },
    '俯卧撑': { name: '俯卧撑', type: 'COUNT', unit: '个', increment: 5, icon: '💪', color: '#4ECDC4' },
    '引体向上': { name: '引体向上', type: 'COUNT', unit: '个', increment: 1, icon: '🤸', color: '#45B7D1' },
    '深蹲': { name: '深蹲', type: 'COUNT', unit: '个', increment: 10, icon: '🦵', color: '#96CEB4' },
    '骑行': { name: '骑行', type: 'DISTANCE', unit: 'km', increment: 1, icon: '🚴', color: '#FFEAA7' },
    '游泳': { name: '游泳', type: 'DISTANCE', unit: 'km', increment: 0.1, icon: '🏊', color: '#74B9FF' }
  };

  return exerciseTypeMap[exerciseName] || {
    name: exerciseName,
    type: 'COUNT',
    unit: '次',
    increment: 1,
    icon: '🏃',
    color: '#95A5A6'
  };
}

async function directMigration() {
  try {
    console.log('🚀 开始直接数据库迁移...');

    // 1. 获取所有用户
    const users = await prisma.user.findMany();
    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }

    console.log(`👥 找到 ${users.length} 个用户:`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (ID: ${user.id})`);
    });

    // 2. 检查是否已经迁移过
    const migrationLog = await prisma.migrationLog.findFirst({
      where: { migrationName: 'daily_data_to_records_migration' }
    });

    if (migrationLog) {
      console.log('⚠️ 迁移已经执行过，删除旧的迁移记录重新开始...');
      await prisma.migrationLog.deleteMany({
        where: { migrationName: 'daily_data_to_records_migration' }
      });
    }

    // 3. 记录迁移开始
    await prisma.migrationLog.create({
      data: {
        migrationName: 'daily_data_to_records_migration',
        status: 'started',
        details: `开始迁移所有用户数据`,
        createdAt: getCurrentBeijingTime(),
      }
    });

    // 4. 清空所有用户的记录
    console.log('🗑️ 清空所有用户的现有记录...');
    const deletedExerciseRecords = await prisma.exerciseRecord.deleteMany({});
    const deletedExpenseRecords = await prisma.expenseRecord.deleteMany({});
    const deletedExerciseTypes = await prisma.exerciseType.deleteMany({});
    console.log(`✅ 已清空 ${deletedExerciseRecords.count} 条运动记录、${deletedExpenseRecords.count} 条消费记录、${deletedExerciseTypes.count} 条运动类型`);

    // 5. 读取JSON文件
    const dataDir = path.join(process.cwd(), '..', 'data');
    console.log(`📂 读取数据目录: ${dataDir}`);
    
    if (!fs.existsSync(dataDir)) {
      console.log('⚠️ 数据目录不存在，跳过迁移');
      return;
    }

    const jsonFiles = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
    console.log(`📊 找到 ${jsonFiles.length} 个JSON文件`);

    let totalMigratedExpenseCount = 0;
    let totalMigratedExerciseCount = 0;
    let processedFiles = 0;

    // 6. 为每个用户创建运动类型
    const exerciseTypeMap = new Map(); // 存储每个用户的运动类型映射

    for (const user of users) {
      console.log(`\n🏃 为用户 ${user.email} 创建运动类型...`);
      const userExerciseTypes = {};

      const exerciseNames = ['跑步', '俯卧撑', '引体向上', '深蹲', '骑行', '游泳'];
      for (const exerciseName of exerciseNames) {
        const exerciseTypeData = getDefaultExerciseTypeData(exerciseName);
        const exerciseType = await prisma.exerciseType.create({
          data: {
            userId: user.id,
            ...exerciseTypeData,
            sortOrder: 1,
          }
        });
        userExerciseTypes[exerciseName] = exerciseType;
      }

      exerciseTypeMap.set(user.id, userExerciseTypes);
      console.log(`✅ 为用户 ${user.email} 创建了 ${exerciseNames.length} 种运动类型`);
    }

    // 7. 处理每个JSON文件，为每个用户都导入数据
    for (const fileName of jsonFiles) {
      try {
        const filePath = path.join(dataDir, fileName);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        // 解析日期
        const date = new Date(jsonData.date);
        if (isNaN(date.getTime())) {
          console.log(`⚠️ 跳过无效日期文件: ${fileName}`);
          continue;
        }

        // 为每个用户导入数据
        for (const user of users) {
          const userId = user.id;

          // 迁移消费数据
          if (jsonData.expenses) {
            if (jsonData.expenses.breakfast > 0) {
              await prisma.expenseRecord.create({
                data: {
                  userId,
                  date,
                  type: 'MEAL',
                  category: 'breakfast',
                  amount: jsonData.expenses.breakfast,
                  time: '08:00',
                  createdAt: getCurrentBeijingTime(),
                  updatedAt: getCurrentBeijingTime(),
                }
              });
              totalMigratedExpenseCount++;
            }

            if (jsonData.expenses.lunch > 0) {
              await prisma.expenseRecord.create({
                data: {
                  userId,
                  date,
                  type: 'MEAL',
                  category: 'lunch',
                  amount: jsonData.expenses.lunch,
                  time: '12:00',
                  createdAt: getCurrentBeijingTime(),
                  updatedAt: getCurrentBeijingTime(),
                }
              });
              totalMigratedExpenseCount++;
            }

            if (jsonData.expenses.dinner > 0) {
              await prisma.expenseRecord.create({
                data: {
                  userId,
                  date,
                  type: 'MEAL',
                  category: 'dinner',
                  amount: jsonData.expenses.dinner,
                  time: '18:00',
                  createdAt: getCurrentBeijingTime(),
                  updatedAt: getCurrentBeijingTime(),
                }
              });
              totalMigratedExpenseCount++;
            }
          }

          // 迁移运动数据
          if (jsonData.exercise) {
            const exerciseData = [
              { name: '跑步', value: jsonData.exercise.running },
              { name: '俯卧撑', value: jsonData.exercise.pushUps },
              { name: '引体向上', value: jsonData.exercise.pullUps },
              { name: '深蹲', value: jsonData.exercise.squats },
              { name: '骑行', value: jsonData.exercise.cycling },
              { name: '游泳', value: jsonData.exercise.swimming }
            ];

            const userExerciseTypes = exerciseTypeMap.get(userId);

            for (const exercise of exerciseData) {
              if (exercise.value && exercise.value > 0) {
                const exerciseType = userExerciseTypes[exercise.name];

                if (exerciseType) {
                  await prisma.exerciseRecord.create({
                    data: {
                      userId,
                      exerciseId: exerciseType.id,
                      date,
                      value: exercise.value,
                      unit: exerciseType.unit,
                      createdAt: getCurrentBeijingTime(),
                      updatedAt: getCurrentBeijingTime(),
                    }
                  });
                  totalMigratedExerciseCount++;
                }
              }
            }
          }
        }

        processedFiles++;
        console.log(`✅ 处理文件: ${fileName} (${date.toISOString().split('T')[0]}) - 为 ${users.length} 个用户导入数据`);

      } catch (fileError) {
        console.error(`❌ 处理文件 ${fileName} 失败:`, fileError.message);
      }
    }

    // 8. 记录迁移完成
    await prisma.migrationLog.updateMany({
      where: { migrationName: 'daily_data_to_records_migration' },
      data: {
        status: 'completed',
        details: `迁移完成: 处理了 ${processedFiles} 个文件, 为 ${users.length} 个用户导入了 ${totalMigratedExpenseCount} 条消费记录, ${totalMigratedExerciseCount} 条运动记录`
      }
    });

    console.log(`\n🎉 迁移完成！`);
    console.log(`📊 统计信息:`);
    console.log(`  - 用户数量: ${users.length} 个`);
    console.log(`  - 处理文件: ${processedFiles} 个`);
    console.log(`  - 总消费记录: ${totalMigratedExpenseCount} 条`);
    console.log(`  - 总运动记录: ${totalMigratedExerciseCount} 条`);
    console.log(`  - 平均每用户消费记录: ${Math.round(totalMigratedExpenseCount / users.length)} 条`);
    console.log(`  - 平均每用户运动记录: ${Math.round(totalMigratedExerciseCount / users.length)} 条`);

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    
    // 记录迁移失败
    try {
      await prisma.migrationLog.create({
        data: {
          migrationName: 'daily_data_to_records_migration',
          status: 'failed',
          details: error.message,
          createdAt: getCurrentBeijingTime(),
        }
      });
    } catch (logError) {
      console.error('记录错误日志失败:', logError);
    }
  } finally {
    await prisma.$disconnect();
  }
}

directMigration();
