import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始播种数据库...');

  // 清理现有数据（开发环境）
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 清理现有数据...');
    await prisma.pomodoroSession.deleteMany();
    await prisma.studyRecord.deleteMany();
    await prisma.exerciseRecord.deleteMany();
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();
  }

  // 创建示例用户
  console.log('👤 创建示例用户...');
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@lifetracker.com',
      passwordHash: hashedPassword,
      name: '演示用户',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const testUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      passwordHash: hashedPassword,
      name: '测试用户',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`✅ 创建用户: ${demoUser.email}, ${testUser.email}`);

  // 创建示例任务
  console.log('📋 创建示例任务...');
  const tasks = await Promise.all([
    // 演示用户的任务
    prisma.task.create({
      data: {
        title: '复习高等数学',
        description: '复习第一章：函数与极限',
        priority: 2,
        isCompleted: false,
        sortOrder: 0,
        userId: demoUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.task.create({
      data: {
        title: '英语单词背诵',
        description: '背诵考研英语核心词汇 100 个',
        priority: 1,
        isCompleted: false,
        sortOrder: 1,
        userId: demoUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.task.create({
      data: {
        title: '专业课笔记整理',
        description: '整理计算机网络课程笔记',
        priority: 1,
        isCompleted: true,
        sortOrder: 2,
        userId: demoUser.id,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 昨天创建
        updatedAt: new Date(),
      },
    }),
    prisma.task.create({
      data: {
        title: '政治知识点梳理',
        description: '梳理马克思主义基本原理',
        priority: 0,
        isCompleted: false,
        sortOrder: 3,
        userId: demoUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    // 测试用户的任务
    prisma.task.create({
      data: {
        title: '学习 React',
        description: '学习 React Hooks 和状态管理',
        priority: 2,
        isCompleted: false,
        sortOrder: 0,
        userId: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  console.log(`✅ 创建 ${tasks.length} 个任务`);

  // 创建学习记录
  console.log('📚 创建学习记录...');
  const studyRecords = [];
  
  // 为过去7天创建学习记录
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // 每天2-4条学习记录
    const recordsPerDay = Math.floor(Math.random() * 3) + 2;
    
    for (let j = 0; j < recordsPerDay; j++) {
      const subjects = ['数学', '英语', '专业课', '政治'];
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      const duration = Math.floor(Math.random() * 3600) + 1800; // 30分钟到2小时
      
      const record = await prisma.studyRecord.create({
        data: {
          subject,
          duration,
          notes: `学习${subject}相关内容`,
          userId: demoUser.id,
          taskId: tasks[Math.floor(Math.random() * 3)].id, // 随机关联任务
          startedAt: date,
          completedAt: new Date(date.getTime() + duration * 1000),
          createdAt: date,
        },
      });
      
      studyRecords.push(record);
    }
  }

  console.log(`✅ 创建 ${studyRecords.length} 条学习记录`);

  // 创建番茄钟会话
  console.log('🍅 创建番茄钟会话...');
  const pomodoroSessions = [];
  
  // 为过去3天创建番茄钟会话
  for (let i = 0; i < 3; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // 每天3-6个番茄钟
    const sessionsPerDay = Math.floor(Math.random() * 4) + 3;
    
    for (let j = 0; j < sessionsPerDay; j++) {
      const duration = 1500; // 25分钟
      const actualDuration = Math.floor(Math.random() * 300) + 1200; // 20-30分钟
      const status = Math.random() > 0.2 ? 'COMPLETED' : 'CANCELLED'; // 80%完成率

      const session = await prisma.pomodoroSession.create({
        data: {
          duration,
          actualDuration: status === 'COMPLETED' ? actualDuration : Math.floor(actualDuration * 0.6),
          status,
          type: 'WORK',
          userId: demoUser.id,
          taskId: tasks[Math.floor(Math.random() * 3)].id,
          startedAt: date,
          completedAt: status === 'COMPLETED' ? new Date(date.getTime() + actualDuration * 1000) : null,
          createdAt: date,
        },
      });
      
      pomodoroSessions.push(session);
    }
  }

  console.log(`✅ 创建 ${pomodoroSessions.length} 个番茄钟会话`);

  // 创建运动类型和记录
  console.log('🏃 创建运动记录...');

  // 首先创建运动类型
  const exerciseTypes = await Promise.all([
    prisma.exerciseType.create({
      data: {
        userId: demoUser.id,
        name: '跑步',
        type: 'DISTANCE',
        unit: 'km',
        increment: 0.1,
        icon: '🏃',
        color: '#FF6B6B',
        sortOrder: 0,
      },
    }),
    prisma.exerciseType.create({
      data: {
        userId: demoUser.id,
        name: '骑行',
        type: 'DISTANCE',
        unit: 'km',
        increment: 0.5,
        icon: '🚴',
        color: '#4ECDC4',
        sortOrder: 1,
      },
    }),
  ]);

  const exerciseRecords = [];

  // 为过去5天创建运动记录
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0); // 设置为当天开始

    // 每天0-2条运动记录
    const recordsPerDay = Math.floor(Math.random() * 3);

    for (let j = 0; j < recordsPerDay; j++) {
      const exerciseType = exerciseTypes[Math.floor(Math.random() * exerciseTypes.length)];
      const value = exerciseType.name === '跑步' ?
        Math.random() * 5 + 2 : // 2-7km
        Math.random() * 15 + 5; // 5-20km

      const record = await prisma.exerciseRecord.create({
        data: {
          exerciseId: exerciseType.id,
          userId: demoUser.id,
          date: date,
          value: Math.round(value * 100) / 100, // 保留2位小数
          unit: exerciseType.unit,
          notes: `${exerciseType.name}训练`,
          createdAt: date,
        },
      });

      exerciseRecords.push(record);
    }
  }

  console.log(`✅ 创建 ${exerciseRecords.length} 条运动记录`);

  // 输出统计信息
  console.log('\n📊 数据库播种完成！');
  console.log('==========================================');
  console.log(`👥 用户数量: 2`);
  console.log(`📋 任务数量: ${tasks.length}`);
  console.log(`📚 学习记录: ${studyRecords.length}`);
  console.log(`🍅 番茄钟会话: ${pomodoroSessions.length}`);
  console.log(`🏃 运动记录: ${exerciseRecords.length}`);
  console.log('==========================================');
  console.log('\n🎯 测试账户信息:');
  console.log('邮箱: demo@lifetracker.com');
  console.log('密码: 123456');
  console.log('\n邮箱: test@example.com');
  console.log('密码: 123456');
  console.log('==========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ 数据库播种失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
