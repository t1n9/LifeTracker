const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateCreatedAtDates() {
  try {
    console.log('🚀 开始更新createdAt日期...');

    // 1. 检查当前数据状态
    console.log('\n📊 检查当前数据状态:');
    
    const studyRecords = await prisma.studyRecord.findMany({
      select: {
        id: true,
        startedAt: true,
        createdAt: true,
      }
    });

    const pomodoroSessions = await prisma.pomodoroSession.findMany({
      select: {
        id: true,
        startedAt: true,
        createdAt: true,
      }
    });

    console.log(`  StudyRecord总数: ${studyRecords.length}`);
    console.log(`  PomodoroSession总数: ${pomodoroSessions.length}`);

    // 统计需要更新的记录
    const studyRecordsToUpdate = studyRecords.filter(record => {
      const startedDate = record.startedAt.toISOString().split('T')[0];
      const createdDate = record.createdAt.toISOString().split('T')[0];
      return startedDate !== createdDate;
    });

    const pomodoroSessionsToUpdate = pomodoroSessions.filter(session => {
      const startedDate = session.startedAt.toISOString().split('T')[0];
      const createdDate = session.createdAt.toISOString().split('T')[0];
      return startedDate !== createdDate;
    });

    console.log(`  需要更新的StudyRecord: ${studyRecordsToUpdate.length}`);
    console.log(`  需要更新的PomodoroSession: ${pomodoroSessionsToUpdate.length}`);

    if (studyRecordsToUpdate.length === 0 && pomodoroSessionsToUpdate.length === 0) {
      console.log('✅ 所有记录的日期已经正确，无需更新');
      return;
    }

    // 2. 更新StudyRecord
    if (studyRecordsToUpdate.length > 0) {
      console.log('\n📚 更新StudyRecord记录...');
      
      for (const record of studyRecordsToUpdate) {
        // 获取startedAt的日期部分和createdAt的时间部分
        const startedDate = record.startedAt.toISOString().split('T')[0];
        const createdTime = record.createdAt.toISOString().split('T')[1];
        const newCreatedAt = new Date(`${startedDate}T${createdTime}`);

        await prisma.studyRecord.update({
          where: { id: record.id },
          data: { createdAt: newCreatedAt }
        });

        console.log(`  ✅ 更新记录 ${record.id}: ${record.createdAt.toISOString().split('T')[0]} -> ${startedDate}`);
      }
    }

    // 3. 更新PomodoroSession
    if (pomodoroSessionsToUpdate.length > 0) {
      console.log('\n🍅 更新PomodoroSession记录...');
      
      for (const session of pomodoroSessionsToUpdate) {
        // 获取startedAt的日期部分和createdAt的时间部分
        const startedDate = session.startedAt.toISOString().split('T')[0];
        const createdTime = session.createdAt.toISOString().split('T')[1];
        const newCreatedAt = new Date(`${startedDate}T${createdTime}`);

        await prisma.pomodoroSession.update({
          where: { id: session.id },
          data: { createdAt: newCreatedAt }
        });

        console.log(`  ✅ 更新记录 ${session.id}: ${session.createdAt.toISOString().split('T')[0]} -> ${startedDate}`);
      }
    }

    // 4. 验证更新结果
    console.log('\n🔍 验证更新结果:');
    
    const updatedStudyRecords = await prisma.studyRecord.findMany({
      select: {
        startedAt: true,
        createdAt: true,
      }
    });

    const updatedPomodoroSessions = await prisma.pomodoroSession.findMany({
      select: {
        startedAt: true,
        createdAt: true,
      }
    });

    const studyRecordsMatching = updatedStudyRecords.filter(record => {
      const startedDate = record.startedAt.toISOString().split('T')[0];
      const createdDate = record.createdAt.toISOString().split('T')[0];
      return startedDate === createdDate;
    }).length;

    const pomodoroSessionsMatching = updatedPomodoroSessions.filter(session => {
      const startedDate = session.startedAt.toISOString().split('T')[0];
      const createdDate = session.createdAt.toISOString().split('T')[0];
      return startedDate === createdDate;
    }).length;

    console.log(`  StudyRecord日期匹配: ${studyRecordsMatching}/${updatedStudyRecords.length}`);
    console.log(`  PomodoroSession日期匹配: ${pomodoroSessionsMatching}/${updatedPomodoroSessions.length}`);

    console.log('\n✅ 更新完成！');

  } catch (error) {
    console.error('❌ 更新失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCreatedAtDates();
