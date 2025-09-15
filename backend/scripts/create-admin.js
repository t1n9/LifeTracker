const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('🔧 开始创建系统管理员账户...');

    // 管理员信息
    const adminData = {
      email: 'admin@lifetracker.com',
      password: 'admin123456',
      name: '系统管理员',
      isAdmin: true,
      emailVerified: true,
      isActive: true
    };

    // 检查管理员是否已存在
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminData.email }
    });

    if (existingAdmin) {
      console.log('⚠️  管理员账户已存在');
      console.log(`📧 邮箱: ${existingAdmin.email}`);
      console.log(`👤 姓名: ${existingAdmin.name}`);
      console.log(`🔑 管理员权限: ${existingAdmin.isAdmin ? '是' : '否'}`);
      return;
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(adminData.password, 12);

    // 创建管理员账户
    const admin = await prisma.user.create({
      data: {
        email: adminData.email,
        passwordHash: hashedPassword,
        name: adminData.name,
        isAdmin: adminData.isAdmin,
        emailVerified: adminData.emailVerified,
        isActive: adminData.isActive,
        timezone: 'Asia/Shanghai',
        theme: 'light'
      }
    });

    console.log('✅ 系统管理员账户创建成功！');
    console.log('');
    console.log('📋 管理员信息:');
    console.log(`📧 邮箱: ${admin.email}`);
    console.log(`🔑 密码: ${adminData.password}`);
    console.log(`👤 姓名: ${admin.name}`);
    console.log(`🆔 用户ID: ${admin.id}`);
    console.log(`🔐 管理员权限: ${admin.isAdmin ? '是' : '否'}`);
    console.log(`✉️  邮箱验证: ${admin.emailVerified ? '已验证' : '未验证'}`);
    console.log(`🟢 账户状态: ${admin.isActive ? '激活' : '禁用'}`);
    console.log('');

    // 创建用户设置
    const userSettings = await prisma.userSettings.create({
      data: {
        userId: admin.id,
        pomodoroWorkDuration: 25,
        pomodoroBreakDuration: 5,
        pomodoroLongBreak: 15,
        pomodoroSoundEnabled: true,
        notificationsEnabled: true,
        themeConfig: {
          mode: 'light',
          primaryColor: '#1976d2'
        }
      }
    });

    console.log('✅ 用户设置创建成功！');
    console.log('');

    // 初始化系统配置
    console.log('🔧 初始化系统配置...');
    
    const systemConfigs = [
      {
        key: 'registration_enabled',
        value: 'true',
        description: '是否允许用户注册',
        isPublic: true,
      },
      {
        key: 'site_name',
        value: 'LifeTracker',
        description: '网站名称',
        isPublic: true,
      },
      {
        key: 'site_description',
        value: '生活记录与管理系统',
        description: '网站描述',
        isPublic: true,
      },
      {
        key: 'max_users',
        value: '1000',
        description: '最大用户数量',
        isPublic: false,
      },
      {
        key: 'maintenance_mode',
        value: 'false',
        description: '维护模式',
        isPublic: true,
      }
    ];

    for (const config of systemConfigs) {
      const existing = await prisma.systemConfig.findUnique({
        where: { key: config.key }
      });
      
      if (!existing) {
        await prisma.systemConfig.create({
          data: config
        });
        console.log(`✅ 创建系统配置: ${config.key} = ${config.value}`);
      } else {
        console.log(`⚠️  系统配置已存在: ${config.key} = ${existing.value}`);
      }
    }

    console.log('');
    console.log('🎉 系统初始化完成！');
    console.log('');
    console.log('🚀 现在您可以使用以下信息登录系统:');
    console.log(`📧 邮箱: ${adminData.email}`);
    console.log(`🔑 密码: ${adminData.password}`);
    console.log('');
    console.log('⚠️  重要提醒:');
    console.log('1. 请立即登录系统并修改管理员密码');
    console.log('2. 建议在系统配置中调整相关设置');
    console.log('3. 注册功能已开启，您可以在系统配置中关闭');

  } catch (error) {
    console.error('❌ 创建管理员账户失败:', error);
    
    if (error.code === 'P2002') {
      console.log('💡 提示: 该邮箱已被使用，请检查是否已有管理员账户');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
createAdmin();
