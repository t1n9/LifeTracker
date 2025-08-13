const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('👤 创建测试用户...\n');

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });

    if (existingUser) {
      console.log('✅ 用户已存在:', existingUser.email);
      console.log('用户ID:', existingUser.id);
      return;
    }

    // 创建新用户
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const newUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: hashedPassword,
        name: '测试用户',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    console.log('✅ 用户创建成功:');
    console.log('邮箱:', newUser.email);
    console.log('姓名:', newUser.name);
    console.log('用户ID:', newUser.id);
    console.log('创建时间:', newUser.createdAt.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'}));

  } catch (error) {
    console.error('❌ 创建用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
