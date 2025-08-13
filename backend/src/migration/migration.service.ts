import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getCurrentBeijingTime } from '../common/utils/date.util';
import * as fs from 'fs';
import * as path from 'path';

// JSON数据接口定义
interface JsonData {
  date: string;
  exercise: {
    pullUps: number;
    squats: number;
    pushUps: number;
    running: number;
    swimming: number;
    cycling: number;
    feeling: string;
  };
  expenses: {
    breakfast: number;
    lunch: number;
    dinner: number;
    other: any[];
  };
}

@Injectable()
export class MigrationService {
  constructor(private prisma: PrismaService) {}

  // 检查是否已经迁移过
  async checkMigrationStatus(): Promise<boolean> {
    const migrationRecord = await this.prisma.migrationLog.findFirst({
      where: { migrationName: 'daily_data_to_records_migration' }
    });
    return !!migrationRecord;
  }

  // 记录迁移状态
  async recordMigration(migrationName: string, status: 'started' | 'completed' | 'failed', details?: string) {
    return this.prisma.migrationLog.create({
      data: {
        migrationName,
        status,
        details,
        createdAt: getCurrentBeijingTime(),
      }
    });
  }

  // 清空现有的运动和消费记录
  async clearExistingRecords(userId?: string) {
    console.log('🗑️ 开始清空现有记录...');
    
    const whereClause = userId ? { userId } : {};
    
    // 清空运动记录
    const deletedExerciseRecords = await this.prisma.exerciseRecord.deleteMany({
      where: whereClause
    });
    
    // 清空消费记录
    const deletedExpenseRecords = await this.prisma.expenseRecord.deleteMany({
      where: whereClause
    });

    console.log(`✅ 已清空 ${deletedExerciseRecords.count} 条运动记录`);
    console.log(`✅ 已清空 ${deletedExpenseRecords.count} 条消费记录`);

    return {
      deletedExerciseRecords: deletedExerciseRecords.count,
      deletedExpenseRecords: deletedExpenseRecords.count
    };
  }

  // 从JSON文件迁移数据
  async migrateDailyDataToRecords(userId?: string) {
    console.log('📦 开始从JSON文件迁移数据...');

    // 检查是否已经迁移过
    if (await this.checkMigrationStatus()) {
      console.log('⚠️ 迁移已经执行过，跳过重复迁移');
      return { message: '迁移已经执行过，跳过重复迁移' };
    }

    // 记录迁移开始
    await this.recordMigration('daily_data_to_records_migration', 'started', `开始迁移用户: ${userId || 'all'}`);

    try {
      // 读取data目录下的所有JSON文件
      const dataDir = path.join(process.cwd(), '..', 'data');
      console.log(`📂 读取数据目录: ${dataDir}`);

      if (!fs.existsSync(dataDir)) {
        console.log('⚠️ 数据目录不存在，跳过迁移');
        return { message: '数据目录不存在，跳过迁移' };
      }

      const jsonFiles = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
      console.log(`📊 找到 ${jsonFiles.length} 个JSON文件`);

      let migratedExpenseCount = 0;
      let migratedExerciseCount = 0;
      let processedFiles = 0;

      for (const fileName of jsonFiles) {
        try {
          const filePath = path.join(dataDir, fileName);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const jsonData: JsonData = JSON.parse(fileContent);

          // 解析日期
          const date = new Date(jsonData.date);
          if (isNaN(date.getTime())) {
            console.log(`⚠️ 跳过无效日期文件: ${fileName}`);
            continue;
          }

          // 使用默认用户ID（如果没有指定）
          const targetUserId = userId || 'default-user-id';

          // 迁移消费数据
          if (jsonData.expenses) {
            if (jsonData.expenses.breakfast > 0) {
              await this.createExpenseRecord(targetUserId, date, 'breakfast', jsonData.expenses.breakfast);
              migratedExpenseCount++;
            }

            if (jsonData.expenses.lunch > 0) {
              await this.createExpenseRecord(targetUserId, date, 'lunch', jsonData.expenses.lunch);
              migratedExpenseCount++;
            }

            if (jsonData.expenses.dinner > 0) {
              await this.createExpenseRecord(targetUserId, date, 'dinner', jsonData.expenses.dinner);
              migratedExpenseCount++;
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

            for (const exercise of exerciseData) {
              if (exercise.value && exercise.value > 0) {
                await this.createExerciseRecord(targetUserId, date, exercise.name, exercise.value);
                migratedExerciseCount++;
              }
            }
          }

          processedFiles++;
          console.log(`✅ 处理文件: ${fileName} (${date.toISOString().split('T')[0]})`);

        } catch (fileError) {
          console.error(`❌ 处理文件 ${fileName} 失败:`, fileError.message);
        }
      }

      console.log(`✅ 迁移完成: 处理了 ${processedFiles} 个文件, ${migratedExpenseCount} 条消费记录, ${migratedExerciseCount} 条运动记录`);

      // 记录迁移完成
      await this.recordMigration('daily_data_to_records_migration', 'completed',
        `迁移完成: 处理了 ${processedFiles} 个文件, ${migratedExpenseCount} 条消费记录, ${migratedExerciseCount} 条运动记录`);

      return {
        message: '迁移完成',
        migratedExpenseCount,
        migratedExerciseCount,
        processedFiles
      };

    } catch (error) {
      console.error('❌ 迁移失败:', error);
      await this.recordMigration('daily_data_to_records_migration', 'failed', error.message);
      throw error;
    }
  }

  // 创建消费记录
  private async createExpenseRecord(userId: string, date: Date, category: string, amount: number) {
    return this.prisma.expenseRecord.create({
      data: {
        userId,
        date,
        type: 'MEAL',
        category,
        amount,
        time: '12:00', // 默认时间
        createdAt: getCurrentBeijingTime(),
        updatedAt: getCurrentBeijingTime(),
      }
    });
  }

  // 创建运动记录
  private async createExerciseRecord(userId: string, date: Date, exerciseName: string, value: number) {
    // 查找或创建运动类型
    let exerciseType = await this.prisma.exerciseType.findFirst({
      where: { userId, name: exerciseName }
    });

    if (!exerciseType) {
      // 创建默认运动类型
      const exerciseTypeData = this.getDefaultExerciseTypeData(exerciseName);
      exerciseType = await this.prisma.exerciseType.create({
        data: {
          userId,
          ...exerciseTypeData,
          sortOrder: 1,
        }
      });
    }

    return this.prisma.exerciseRecord.create({
      data: {
        userId,
        exerciseId: exerciseType.id,
        date,
        value,
        unit: exerciseType.unit,
        createdAt: getCurrentBeijingTime(),
        updatedAt: getCurrentBeijingTime(),
      }
    });
  }

  // 获取默认运动类型数据
  private getDefaultExerciseTypeData(exerciseName: string) {
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
}
