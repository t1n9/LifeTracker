const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('🔍 验证数据迁移结果...\n');

    // 1. 检查用户信息
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    console.log('👥 用户信息:');
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.name || '未设置姓名'})`);
      console.log(`     ID: ${user.id}`);
      console.log(`     创建时间: ${user.createdAt.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}\n`);
    });

    // 2. 检查运动类型
    console.log('🏃 运动类型统计:');
    for (const user of users) {
      const exerciseTypes = await prisma.exerciseType.findMany({
        where: { userId: user.id },
        orderBy: { name: 'asc' }
      });
      
      console.log(`  ${user.email}:`);
      exerciseTypes.forEach(type => {
        console.log(`    - ${type.name} (${type.type}, ${type.unit}) ${type.icon}`);
      });
      console.log('');
    }

    // 3. 检查消费记录
    console.log('💰 消费记录统计:');
    for (const user of users) {
      const expenseRecords = await prisma.expenseRecord.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
        take: 5 // 只显示最近5条
      });
      
      const totalExpense = await prisma.expenseRecord.aggregate({
        where: { userId: user.id },
        _sum: { amount: true },
        _count: { id: true }
      });
      
      console.log(`  ${user.email}:`);
      console.log(`    总记录数: ${totalExpense._count.id} 条`);
      console.log(`    总金额: ¥${totalExpense._sum.amount || 0}`);
      console.log(`    最近5条记录:`);
      
      expenseRecords.forEach(record => {
        const dateStr = record.date.toLocaleDateString('zh-CN');
        console.log(`      ${dateStr} ${record.category} ¥${record.amount} (${record.time || '未设置时间'})`);
      });
      console.log('');
    }

    // 4. 检查运动记录
    console.log('🏃 运动记录统计:');
    for (const user of users) {
      const exerciseRecords = await prisma.exerciseRecord.findMany({
        where: { userId: user.id },
        include: { exercise: true },
        orderBy: { date: 'desc' },
        take: 5 // 只显示最近5条
      });
      
      const totalExercise = await prisma.exerciseRecord.aggregate({
        where: { userId: user.id },
        _count: { id: true }
      });
      
      console.log(`  ${user.email}:`);
      console.log(`    总记录数: ${totalExercise._count.id} 条`);
      console.log(`    最近5条记录:`);
      
      exerciseRecords.forEach(record => {
        const dateStr = record.date.toLocaleDateString('zh-CN');
        console.log(`      ${dateStr} ${record.exercise.name} ${record.value}${record.unit}`);
      });
      console.log('');
    }

    // 5. 检查今日数据（测试时区修复）
    console.log('📅 今日数据检查:');
    const beijingTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    const todayDate = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate());
    
    console.log(`今日日期 (北京时间): ${todayDate.toLocaleDateString('zh-CN')}`);
    
    for (const user of users) {
      const todayExpenses = await prisma.expenseRecord.findMany({
        where: { 
          userId: user.id,
          date: todayDate
        }
      });
      
      const todayExercises = await prisma.exerciseRecord.findMany({
        where: { 
          userId: user.id,
          date: todayDate
        },
        include: { exercise: true }
      });
      
      console.log(`  ${user.email}:`);
      console.log(`    今日消费记录: ${todayExpenses.length} 条`);
      console.log(`    今日运动记录: ${todayExercises.length} 条`);
      
      if (todayExpenses.length > 0) {
        console.log(`    今日消费详情:`);
        todayExpenses.forEach(record => {
          console.log(`      ${record.category}: ¥${record.amount} (${record.time || '未设置时间'})`);
        });
      }
      
      if (todayExercises.length > 0) {
        console.log(`    今日运动详情:`);
        todayExercises.forEach(record => {
          console.log(`      ${record.exercise.name}: ${record.value}${record.unit}`);
        });
      }
      console.log('');
    }

    // 6. 检查迁移日志
    console.log('📋 迁移日志:');
    const migrationLogs = await prisma.migrationLog.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    migrationLogs.forEach(log => {
      const timeStr = log.createdAt.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'});
      console.log(`  ${timeStr} - ${log.migrationName}: ${log.status}`);
      if (log.details) {
        console.log(`    详情: ${log.details}`);
      }
    });

    console.log('\n✅ 验证完成！');

  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
