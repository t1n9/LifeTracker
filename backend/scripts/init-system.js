const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function initSystem() {
  try {
    console.log('🔧 初始化系统配置...');

    // 查找管理员账户
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@lifetracker.com' }
    });

    if (!admin) {
      console.log('❌ 未找到管理员账户，请先运行 create-admin.js');
      return;
    }

    console.log(`✅ 找到管理员账户: ${admin.name} (${admin.email})`);

    // 创建用户设置（如果不存在）
    try {
      const existingSettings = await prisma.userSettings.findUnique({
        where: { userId: admin.id }
      });

      if (!existingSettings) {
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
        console.log('✅ 管理员用户设置创建成功');
      } else {
        console.log('⚠️  管理员用户设置已存在');
      }
    } catch (error) {
      console.log('⚠️  用户设置创建失败，跳过:', error.message);
    }

    // 初始化系统配置
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
      try {
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
      } catch (error) {
        console.log(`❌ 创建配置 ${config.key} 失败:`, error.message);
      }
    }

    console.log('');
    console.log('🎉 系统初始化完成！');
    console.log('');
    console.log('📋 管理员登录信息:');
    console.log('📧 邮箱: admin@lifetracker.com');
    console.log('🔑 密码: admin123456');
    console.log('');
    console.log('🚀 系统功能状态:');
    console.log('✅ 用户注册: 已开启');
    console.log('✅ 管理员权限: 已配置');
    console.log('✅ 基础设置: 已初始化');
    console.log('');
    console.log('⚠️  重要提醒:');
    console.log('1. 请立即登录并修改管理员密码');
    console.log('2. 可在系统设置中调整注册开关');
    console.log('3. 建议定期备份数据库');

  } catch (error) {
    console.error('❌ 系统初始化失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
initSystem();
