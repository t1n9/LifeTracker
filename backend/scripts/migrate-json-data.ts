import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface JsonData {
  date: string;
  study: {
    totalMinutes: number;
    sessions: Array<{
      duration: number;
      time: string;
      timestamp: string;
      taskId?: number; // 可选，早期数据没有
    }>;
    pomodoroCount: number;
  };
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
    customCategories: Record<string, any>;
    customCategoryNames?: Record<string, any>; // 可选
    other: any[];
    total: number;
  };
  tasks: Array<{
    id: number;
    text: string;
    completed: boolean;
    pomodoroCount: number;
    createdAt: string;
  }>;
  subjectGoals?: Record<string, any>; // 可选
  health: {
    weight: number;
    sleepHours: number;
    sleepQuality: number;
    phoneUsage: number;
  };
  theme: string;
  importantInfo?: string; // 可选
  examDate: string;
  dayStart?: string; // 可选
  dayReflection?: string; // 可选
  reflectionTime?: string; // 可选
  isServerOnline?: boolean; // 可选
  isLoading?: boolean; // 可选
  currentBoundTask?: any; // 可选
  pomodoroRunning?: boolean; // 可选
  focusMode?: boolean; // 可选
  focusQuoteIndex?: number; // 可选
  breakMode?: boolean; // 可选
  breakTimeLeft?: number; // 可选
  config: {
    target: {
      name: string;
      date: string;
      dailyGoal?: number; // 可选
    };
    studySubjects?: Record<string, any>; // 可选，早期数据没有
    exerciseTypes: Record<string, any>;
    expenseCategories: Record<string, any>;
    theme: Record<string, any>;
  };
  metadata: {
    created: string;
    lastModified: string;
  };
}

async function migrateJsonData(jsonFilePath: string, userEmail: string) {
  try {
    console.log('开始迁移JSON数据...');

    // 读取JSON文件
    const jsonContent = fs.readFileSync(jsonFilePath, 'utf-8');
    const jsonData: JsonData = JSON.parse(jsonContent);

    console.log(`处理日期: ${jsonData.date}`);
    
    // 创建或获取用户
    let user = await prisma.user.findUnique({
      where: { email: userEmail }
    });
    
    if (!user) {
      console.log('创建新用户...');
      const hashedPassword = await bcrypt.hash('defaultPassword123', 12);
      
      user = await prisma.user.create({
        data: {
          email: userEmail,
          passwordHash: hashedPassword,
          name: '用户',
          targetName: jsonData.config.target.name,
          targetDate: new Date(jsonData.config.target.date),
          examDate: new Date(jsonData.examDate),
          theme: jsonData.theme,
        }
      });

      // 创建用户设置
      await prisma.userSettings.create({
        data: {
          userId: user.id,
          studySubjects: jsonData.config.studySubjects || {},
          exerciseTypes: jsonData.config.exerciseTypes || {},
          expenseCategories: jsonData.config.expenseCategories || {},
          themeConfig: jsonData.config.theme || {},
        }
      });
    }
    
    const dataDate = new Date(jsonData.date);

    // 迁移每日数据
    await prisma.dailyData.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: dataDate
        }
      },
      update: {
        totalMinutes: jsonData.study.totalMinutes,
        pomodoroCount: jsonData.study.pomodoroCount,
        dayStart: jsonData.dayStart || '',
        dayReflection: jsonData.dayReflection || '',
        reflectionTime: jsonData.reflectionTime || '',
        importantInfo: jsonData.importantInfo || '',
        focusMode: jsonData.focusMode || false,
        focusQuoteIndex: jsonData.focusQuoteIndex || 0,
      },
      create: {
        userId: user.id,
        date: dataDate,
        totalMinutes: jsonData.study.totalMinutes,
        pomodoroCount: jsonData.study.pomodoroCount,
        dayStart: jsonData.dayStart || '',
        dayReflection: jsonData.dayReflection || '',
        reflectionTime: jsonData.reflectionTime || '',
        importantInfo: jsonData.importantInfo || '',
        focusMode: jsonData.focusMode || false,
        focusQuoteIndex: jsonData.focusQuoteIndex || 0,
      }
    });
    
    // 迁移任务
    for (const task of jsonData.tasks) {
      await prisma.task.upsert({
        where: {
          id: task.id.toString()
        },
        update: {
          title: task.text,
          isCompleted: task.completed,
          actualHours: task.pomodoroCount * 0.5, // 假设每个番茄钟30分钟
        },
        create: {
          id: task.id.toString(),
          userId: user.id,
          title: task.text,
          isCompleted: task.completed,
          actualHours: task.pomodoroCount * 0.5,
          createdAt: new Date(task.createdAt),
        }
      });
    }

    // 迁移学习记录
    for (const session of jsonData.study.sessions) {
      // 处理早期数据没有taskId的情况
      const taskId = session.taskId ? session.taskId.toString() : null;

      await prisma.studyRecord.create({
        data: {
          userId: user.id,
          taskId: taskId,
          duration: session.duration,
          startedAt: new Date(session.timestamp),
          completedAt: new Date(new Date(session.timestamp).getTime() + session.duration * 60000),
        }
      });

      // 创建番茄钟会话
      await prisma.pomodoroSession.create({
        data: {
          userId: user.id,
          taskId: taskId,
          duration: session.duration,
          status: 'COMPLETED',
          type: 'WORK',
          startedAt: new Date(session.timestamp),
          completedAt: new Date(new Date(session.timestamp).getTime() + session.duration * 60000),
        }
      });
    }
    
    // 迁移运动记录
    await prisma.exercise.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: dataDate
        }
      },
      update: {
        pullUps: jsonData.exercise.pullUps,
        squats: jsonData.exercise.squats,
        pushUps: jsonData.exercise.pushUps,
        running: jsonData.exercise.running,
        swimming: jsonData.exercise.swimming,
        cycling: jsonData.exercise.cycling,
        feeling: jsonData.exercise.feeling,
      },
      create: {
        userId: user.id,
        date: dataDate,
        pullUps: jsonData.exercise.pullUps,
        squats: jsonData.exercise.squats,
        pushUps: jsonData.exercise.pushUps,
        running: jsonData.exercise.running,
        swimming: jsonData.exercise.swimming,
        cycling: jsonData.exercise.cycling,
        feeling: jsonData.exercise.feeling,
      }
    });
    
    // 迁移支出记录
    await prisma.expense.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: dataDate
        }
      },
      update: {
        breakfast: jsonData.expenses.breakfast,
        lunch: jsonData.expenses.lunch,
        dinner: jsonData.expenses.dinner,
        customCategories: jsonData.expenses.customCategories,
        other: jsonData.expenses.other,
        total: jsonData.expenses.total,
      },
      create: {
        userId: user.id,
        date: dataDate,
        breakfast: jsonData.expenses.breakfast,
        lunch: jsonData.expenses.lunch,
        dinner: jsonData.expenses.dinner,
        customCategories: jsonData.expenses.customCategories,
        other: jsonData.expenses.other,
        total: jsonData.expenses.total,
      }
    });
    
    // 迁移健康记录
    await prisma.healthRecord.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: dataDate
        }
      },
      update: {
        weight: jsonData.health.weight || null,
        sleepHours: jsonData.health.sleepHours || null,
        sleepQuality: jsonData.health.sleepQuality || null,
        phoneUsage: jsonData.health.phoneUsage || null,
      },
      create: {
        userId: user.id,
        date: dataDate,
        weight: jsonData.health.weight || null,
        sleepHours: jsonData.health.sleepHours || null,
        sleepQuality: jsonData.health.sleepQuality || null,
        phoneUsage: jsonData.health.phoneUsage || null,
      }
    });

    console.log(`✅ 成功迁移 ${jsonData.date} 的数据`);
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  }
}

// 批量迁移多个JSON文件
async function migrateMultipleFiles(dataDirectory: string, userEmail: string) {
  try {
    const files = fs.readdirSync(dataDirectory)
      .filter(file => file.endsWith('.json'))
      .sort();
    
    console.log(`找到 ${files.length} 个JSON文件`);
    
    for (const file of files) {
      const filePath = path.join(dataDirectory, file);
      console.log(`\n处理文件: ${file}`);
      await migrateJsonData(filePath, userEmail);
    }
    
    console.log('\n🎉 所有数据迁移完成！');
    
  } catch (error) {
    console.error('批量迁移失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 使用示例
if (require.main === module) {
  const dataDirectory = process.argv[2] || './data';
  const userEmail = process.argv[3] || 'user@example.com';
  
  migrateMultipleFiles(dataDirectory, userEmail);
}

export { migrateJsonData, migrateMultipleFiles };
