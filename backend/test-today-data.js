const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 获取当前北京时间
function getCurrentBeijingTime() {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
}

// 获取当前时间字符串 (HH:mm)
function getCurrentTimeString() {
  const beijingTime = getCurrentBeijingTime();
  return beijingTime.toTimeString().slice(0, 5);
}

async function testTodayData() {
  try {
    console.log('🧪 测试今日数据和时区修复...\n');

    // 获取第一个用户
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ 没有找到用户');
      return;
    }

    console.log(`👤 测试用户: ${user.email}`);
    
    // 获取北京时间的今天日期
    const beijingTime = getCurrentBeijingTime();
    // 创建一个只包含日期的Date对象，时间设为00:00:00
    const todayDate = new Date(beijingTime.getFullYear(), beijingTime.getMonth(), beijingTime.getDate(), 0, 0, 0, 0);
    
    console.log(`📅 当前北京时间: ${beijingTime.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`);
    console.log(`📅 今日日期: ${todayDate.toLocaleDateString('zh-CN')}`);
    console.log(`🕐 当前时间字符串: ${getCurrentTimeString()}\n`);

    // 1. 测试添加今日早餐消费
    console.log('💰 测试添加今日早餐消费...');
    
    // 先检查是否已有今日早餐记录
    const existingBreakfast = await prisma.expenseRecord.findFirst({
      where: {
        userId: user.id,
        date: todayDate,
        type: 'MEAL',
        category: 'breakfast',
      },
      orderBy: { createdAt: 'asc' }
    });

    if (existingBreakfast) {
      // 更新现有记录
      const updatedBreakfast = await prisma.expenseRecord.update({
        where: { id: existingBreakfast.id },
        data: {
          amount: 15.5,
          time: getCurrentTimeString(),
          updatedAt: getCurrentBeijingTime(),
        },
      });
      console.log(`✅ 更新早餐记录: ¥${updatedBreakfast.amount} (${updatedBreakfast.time})`);
    } else {
      // 创建新记录
      const newBreakfast = await prisma.expenseRecord.create({
        data: {
          userId: user.id,
          date: todayDate,
          type: 'MEAL',
          category: 'breakfast',
          amount: 15.5,
          time: getCurrentTimeString(),
          createdAt: getCurrentBeijingTime(),
          updatedAt: getCurrentBeijingTime(),
        },
      });
      console.log(`✅ 创建早餐记录: ¥${newBreakfast.amount} (${newBreakfast.time})`);
    }

    // 2. 测试添加今日运动记录
    console.log('\n🏃 测试添加今日运动记录...');
    
    // 获取跑步运动类型
    const runningType = await prisma.exerciseType.findFirst({
      where: {
        userId: user.id,
        name: '跑步'
      }
    });

    if (runningType) {
      // 先检查是否已有今日跑步记录
      const existingRunning = await prisma.exerciseRecord.findFirst({
        where: {
          userId: user.id,
          exerciseId: runningType.id,
          date: todayDate,
        },
        orderBy: { createdAt: 'asc' }
      });

      if (existingRunning) {
        // 更新现有记录
        const updatedRunning = await prisma.exerciseRecord.update({
          where: { id: existingRunning.id },
          data: {
            value: 3.5,
            updatedAt: getCurrentBeijingTime(),
          },
        });
        console.log(`✅ 更新跑步记录: ${updatedRunning.value}${updatedRunning.unit}`);
      } else {
        // 创建新记录
        const newRunning = await prisma.exerciseRecord.create({
          data: {
            userId: user.id,
            exerciseId: runningType.id,
            date: todayDate,
            value: 3.5,
            unit: runningType.unit,
            createdAt: getCurrentBeijingTime(),
            updatedAt: getCurrentBeijingTime(),
          },
        });
        console.log(`✅ 创建跑步记录: ${newRunning.value}${newRunning.unit}`);
      }
    }

    // 3. 验证今日数据
    console.log('\n📊 验证今日数据...');
    
    const todayExpenses = await prisma.expenseRecord.findMany({
      where: { 
        userId: user.id,
        date: todayDate
      },
      orderBy: { createdAt: 'asc' }
    });
    
    const todayExercises = await prisma.exerciseRecord.findMany({
      where: { 
        userId: user.id,
        date: todayDate
      },
      include: { exercise: true },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`今日消费记录 (${todayExpenses.length} 条):`);
    todayExpenses.forEach(record => {
      const createdTime = record.createdAt.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'});
      const updatedTime = record.updatedAt.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'});
      console.log(`  ${record.category}: ¥${record.amount} (${record.time || '未设置时间'})`);
      console.log(`    创建时间: ${createdTime}`);
      console.log(`    更新时间: ${updatedTime}`);
    });
    
    console.log(`\n今日运动记录 (${todayExercises.length} 条):`);
    todayExercises.forEach(record => {
      const createdTime = record.createdAt.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'});
      const updatedTime = record.updatedAt.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'});
      console.log(`  ${record.exercise.name}: ${record.value}${record.unit}`);
      console.log(`    创建时间: ${createdTime}`);
      console.log(`    更新时间: ${updatedTime}`);
    });

    // 4. 测试时区是否正确
    console.log('\n🕐 时区验证:');
    const now = new Date();
    const utcTime = now.toISOString();
    const beijingTimeStr = beijingTime.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'});
    
    console.log(`UTC时间: ${utcTime}`);
    console.log(`北京时间: ${beijingTimeStr}`);
    console.log(`时区偏移: UTC+8 (${beijingTime.getTimezoneOffset() / -60}小时)`);
    
    // 检查记录的日期是否正确
    if (todayExpenses.length > 0) {
      const recordDate = todayExpenses[0].date;
      const recordDateStr = recordDate.toLocaleDateString('zh-CN');
      const expectedDateStr = todayDate.toLocaleDateString('zh-CN');
      
      console.log(`记录日期: ${recordDateStr}`);
      console.log(`预期日期: ${expectedDateStr}`);
      console.log(`日期匹配: ${recordDateStr === expectedDateStr ? '✅ 正确' : '❌ 错误'}`);
    }

    console.log('\n✅ 测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTodayData();
