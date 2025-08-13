const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugDate() {
  try {
    console.log('🔍 调试日期问题...\n');

    // 获取第一个用户
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ 没有找到用户');
      return;
    }

    console.log(`👤 用户: ${user.email}`);
    
    // 获取当前时间信息
    const now = new Date();
    console.log(`🌍 系统UTC时间: ${now.toISOString()}`);
    console.log(`🌍 系统本地时间: ${now.toLocaleString()}`);
    console.log(`🌍 系统时区偏移: ${now.getTimezoneOffset()} 分钟`);
    
    // 测试我们的时区函数
    const beijingOffset = 8 * 60; // 8小时 = 480分钟
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const beijingTime = new Date(utcTime + (beijingOffset * 60000));
    
    console.log(`🇨🇳 计算的北京时间: ${beijingTime.toLocaleString()}`);
    console.log(`🇨🇳 北京时间ISO: ${beijingTime.toISOString()}`);
    
    // 创建今日日期
    const todayDate = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), 0, 0, 0, 0);
    console.log(`📅 今日日期对象: ${todayDate.toISOString()}`);
    console.log(`📅 今日日期本地: ${todayDate.toLocaleString()}`);
    console.log(`📅 今日日期字符串: ${todayDate.toLocaleDateString('zh-CN')}`);
    
    // 查询今日记录
    console.log('\n📊 查询今日记录...');
    const todayRecords = await prisma.expenseRecord.findMany({
      where: { 
        userId: user.id,
        date: todayDate
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });
    
    console.log(`找到 ${todayRecords.length} 条记录:`);
    todayRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.category}: ¥${record.amount}`);
      console.log(`     数据库date字段: ${record.date.toISOString()}`);
      console.log(`     数据库date本地: ${record.date.toLocaleString()}`);
      console.log(`     数据库date字符串: ${record.date.toLocaleDateString('zh-CN')}`);
      console.log(`     创建时间: ${record.createdAt.toLocaleString()}`);
      console.log('');
    });
    
    // 查询所有记录看看日期分布
    console.log('📊 查询所有记录的日期分布...');
    const allRecords = await prisma.expenseRecord.findMany({
      where: { userId: user.id },
      select: { date: true, category: true, amount: true },
      orderBy: { date: 'desc' },
      take: 10
    });
    
    console.log('最近10条记录的日期:');
    allRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.date.toLocaleDateString('zh-CN')} - ${record.category}: ¥${record.amount}`);
      console.log(`     ISO: ${record.date.toISOString()}`);
    });

    // 测试不同的日期创建方式
    console.log('\n🧪 测试不同的日期创建方式...');
    
    // 方式1：直接使用北京时间
    const method1 = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate());
    console.log(`方式1 (年月日): ${method1.toISOString()} -> ${method1.toLocaleDateString('zh-CN')}`);
    
    // 方式2：使用UTC时间
    const utcNow = new Date();
    const method2 = new Date(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate());
    console.log(`方式2 (UTC年月日): ${method2.toISOString()} -> ${method2.toLocaleDateString('zh-CN')}`);
    
    // 方式3：使用字符串解析
    const dateStr = beijingTime.toISOString().split('T')[0];
    const method3 = new Date(dateStr + 'T00:00:00.000Z');
    console.log(`方式3 (字符串): ${method3.toISOString()} -> ${method3.toLocaleDateString('zh-CN')}`);
    
    // 方式4：手动构造UTC时间
    const method4 = new Date(Date.UTC(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate()));
    console.log(`方式4 (UTC构造): ${method4.toISOString()} -> ${method4.toLocaleDateString('zh-CN')}`);

  } catch (error) {
    console.error('❌ 调试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugDate();
