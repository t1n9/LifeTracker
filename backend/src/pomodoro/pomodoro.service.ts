import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartPomodoroDto } from '../study/dto/create-study.dto';

interface ActiveSession {
  id: string;
  userId: string;
  taskId?: string;
  duration: number; // 总时长（分钟）
  timeLeft: number; // 剩余时间（秒）
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  startedAt: Date;
  pausedAt?: Date;
  resumedAt?: Date;
  boundTaskId?: string;
  isCountUpMode?: boolean; // 是否为正计时模式
  countUpTime?: number; // 正计时已用时间（秒）
}

@Injectable()
export class PomodoroService {
  private activeSessions = new Map<string, ActiveSession>();
  private timers = new Map<string, NodeJS.Timeout>();
  private syncTimer: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {
    // 启动定期同步机制
    this.startSyncTimer();
  }

  // 启动定期同步定时器
  private startSyncTimer() {
    this.syncTimer = setInterval(async () => {
      await this.syncAllSessions();
    }, 30000); // 每30秒同步一次
  }

  // 同步所有活跃会话
  private async syncAllSessions() {
    for (const [sessionId, session] of this.activeSessions.entries()) {
      try {
        await this.syncSessionToDatabase(sessionId, session);
      } catch (error) {
        console.error(`同步会话 ${sessionId} 失败:`, error);
      }
    }
  }

  // 同步单个会话到数据库
  private async syncSessionToDatabase(sessionId: string, session: ActiveSession) {
    const status = session.isCompleted ? 'COMPLETED' :
                   session.isPaused ? 'PAUSED' :
                   session.isRunning ? 'RUNNING' : 'PENDING';

    await this.prisma.pomodoroSession.update({
      where: { id: sessionId },
      data: {
        status,
        isCountUpMode: session.isCountUpMode || false,
        countUpTime: session.countUpTime || 0,
        ...(session.isCompleted && { completedAt: new Date() }),
        ...(session.isPaused && session.pausedAt && { pausedAt: session.pausedAt }),
        ...(session.resumedAt && { resumedAt: session.resumedAt }),
      },
    });
  }

  // 启动番茄钟
  async startPomodoro(userId: string, startPomodoroDto: StartPomodoroDto) {
    // 检查是否已有活跃会话
    const existingSession = this.getActiveSessionByUser(userId);
    if (existingSession) {
      return {
        isExisting: true,
        sessionId: existingSession.id,
        session: existingSession,
      };
    }

    // 创建新的数据库记录
    const pomodoroSession = await this.prisma.pomodoroSession.create({
      data: {
        userId,
        taskId: startPomodoroDto.taskId,
        duration: startPomodoroDto.duration,
        type: 'WORK',
        status: 'RUNNING',
        isCountUpMode: startPomodoroDto.isCountUpMode || false,
        countUpTime: startPomodoroDto.isCountUpMode ? 0 : null,
        startedAt: new Date(),
      },
    });

    // 创建内存中的活跃会话
    const activeSession: ActiveSession = {
      id: pomodoroSession.id,
      userId,
      taskId: startPomodoroDto.taskId,
      duration: startPomodoroDto.duration,
      timeLeft: startPomodoroDto.isCountUpMode ? 0 : startPomodoroDto.duration * 60, // 正计时模式从0开始
      isRunning: true,
      isPaused: false,
      isCompleted: false,
      startedAt: new Date(),
      boundTaskId: startPomodoroDto.taskId,
      isCountUpMode: startPomodoroDto.isCountUpMode || false,
      countUpTime: 0, // 正计时从0开始
    };

    this.activeSessions.set(pomodoroSession.id, activeSession);
    this.startTimer(pomodoroSession.id);

    return {
      isExisting: false,
      sessionId: pomodoroSession.id,
      session: activeSession,
    };
  }

  // 暂停番茄钟
  async pausePomodoro(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('番茄钟会话不存在');
    }

    if (!session.isRunning || session.isPaused) {
      throw new BadRequestException('番茄钟未在运行中');
    }

    // 停止计时器
    this.stopTimer(sessionId);

    // 更新会话状态
    session.isRunning = false;
    session.isPaused = true;
    session.pausedAt = new Date();

    // 更新数据库
    await this.prisma.pomodoroSession.update({
      where: { id: sessionId },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
      },
    });

    return { success: true, session };
  }

  // 恢复番茄钟
  async resumePomodoro(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('番茄钟会话不存在');
    }

    if (!session.isPaused) {
      throw new BadRequestException('番茄钟未暂停');
    }

    // 恢复计时器
    session.isRunning = true;
    session.isPaused = false;
    session.resumedAt = new Date();
    this.startTimer(sessionId);

    // 更新数据库
    await this.prisma.pomodoroSession.update({
      where: { id: sessionId },
      data: {
        status: 'RUNNING',
        resumedAt: new Date(),
      },
    });

    return { success: true, session };
  }

  // 停止番茄钟
  async stopPomodoro(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('番茄钟会话不存在');
    }

    // 停止计时器
    this.stopTimer(sessionId);

    let status = 'CANCELLED';
    let actualDuration = 0;

    // 如果是正计时模式且时间足够，标记为完成
    if (session.isCountUpMode) {
      const elapsedMinutes = Math.floor((session.countUpTime || 0) / 60);
      actualDuration = elapsedMinutes;

      if (elapsedMinutes >= 5) {
        status = 'COMPLETED';
        console.log(`✅ 正计时完成：${elapsedMinutes}分钟，标记为完成`);
      } else {
        console.log(`❌ 正计时时间不足：${elapsedMinutes}分钟，标记为取消`);
      }
    }

    // 更新数据库状态
    await this.prisma.pomodoroSession.update({
      where: { id: sessionId },
      data: {
        status: status as any,
        completedAt: new Date(),
        actualDuration: actualDuration > 0 ? actualDuration : undefined,
      },
    });

    // 如果是完成状态，创建学习记录
    if (status === 'COMPLETED' && session.isCountUpMode) {
      await this.createStudyRecord(session, actualDuration);
    }

    // 移除活跃会话
    this.activeSessions.delete(sessionId);

    return { success: true, completed: status === 'COMPLETED', duration: actualDuration };
  }

  // 创建学习记录（正计时完成时）
  private async createStudyRecord(session: ActiveSession, durationMinutes: number) {
    try {
      // 创建学习记录
      const studyRecord = await this.prisma.studyRecord.create({
        data: {
          userId: session.userId,
          subject: '专注学习', // 默认科目
          duration: durationMinutes,
          notes: `正计时专注 ${durationMinutes} 分钟`,
          startedAt: session.startedAt,
          completedAt: new Date(),
          taskId: session.taskId,
        },
      });

      console.log(`📚 创建学习记录: ${durationMinutes}分钟`);

      // 番茄数量通过统计pomodoroSessions动态计算，无需手动更新
      if (session.taskId) {
        console.log(`🍅 任务完成番茄钟: ${session.taskId}`);
      }

      return studyRecord;
    } catch (error) {
      console.error('创建学习记录失败:', error);
      throw error;
    }
  }

  // 获取番茄钟状态
  async getPomodoroStatus(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      timeLeft: session.timeLeft,
      isRunning: session.isRunning,
      isPaused: session.isPaused,
      isCompleted: session.isCompleted,
      duration: session.duration,
      boundTaskId: session.boundTaskId,
      isCountUpMode: session.isCountUpMode,
      countUpTime: session.countUpTime,
    };
  }

  // 获取活跃会话
  async getActiveSession(userId: string) {
    const session = this.getActiveSessionByUser(userId);
    if (!session) {
      // 检查数据库中是否有未完成的会话
      const dbSession = await this.prisma.pomodoroSession.findFirst({
        where: {
          userId,
          status: {
            in: ['RUNNING', 'PAUSED']
          }
        },
        orderBy: {
          startedAt: 'desc'
        }
      });

      if (dbSession) {
        // 恢复会话到内存
        const timeElapsed = Math.floor((new Date().getTime() - dbSession.startedAt.getTime()) / 1000);
        const totalTime = dbSession.duration * 60;

        if (dbSession.isCountUpMode) {
          // 正计时模式：计算实际已用时间
          const actualCountUpTime = (dbSession.countUpTime || 0) + (dbSession.status === 'RUNNING' ? timeElapsed : 0);

          console.log(`🔄 恢复正计时会话: 数据库countUpTime=${dbSession.countUpTime}, 新增时间=${timeElapsed}秒, 总计=${actualCountUpTime}秒`);

          const restoredSession: ActiveSession = {
            id: dbSession.id,
            userId: dbSession.userId,
            taskId: dbSession.taskId,
            duration: dbSession.duration,
            timeLeft: totalTime, // 正计时模式保持原始时长
            isRunning: dbSession.status === 'RUNNING',
            isPaused: dbSession.status === 'PAUSED',
            isCompleted: false,
            startedAt: dbSession.startedAt,
            boundTaskId: dbSession.taskId,
            isCountUpMode: true,
            countUpTime: actualCountUpTime,
          };

          this.activeSessions.set(dbSession.id, restoredSession);

          if (dbSession.status === 'RUNNING') {
            this.startTimer(dbSession.id);
          }

          return {
            sessionId: dbSession.id,
            timeLeft: totalTime,
            isRunning: dbSession.status === 'RUNNING',
            isPaused: dbSession.status === 'PAUSED',
            isCompleted: false,
            duration: dbSession.duration,
            boundTaskId: dbSession.taskId,
            isCountUpMode: true,
            countUpTime: actualCountUpTime,
          };
        } else {
          // 倒计时模式：原有逻辑
          const timeLeft = Math.max(0, totalTime - timeElapsed);

          if (timeLeft > 0) {
            const restoredSession: ActiveSession = {
              id: dbSession.id,
              userId: dbSession.userId,
              taskId: dbSession.taskId,
              duration: dbSession.duration,
              timeLeft: timeLeft,
              isRunning: dbSession.status === 'RUNNING',
              isPaused: dbSession.status === 'PAUSED',
              isCompleted: false,
              startedAt: dbSession.startedAt,
              boundTaskId: dbSession.taskId,
              isCountUpMode: false,
              countUpTime: 0,
            };

            this.activeSessions.set(dbSession.id, restoredSession);

            if (dbSession.status === 'RUNNING') {
              this.startTimer(dbSession.id);
            }

            return {
              sessionId: dbSession.id,
              timeLeft: restoredSession.timeLeft,
              isRunning: restoredSession.isRunning,
              isPaused: restoredSession.isPaused,
              isCompleted: false,
              duration: restoredSession.duration,
              boundTaskId: restoredSession.boundTaskId,
              isCountUpMode: false,
              countUpTime: 0,
            };
          } else {
            // 倒计时时间已过，标记为完成
            await this.prisma.pomodoroSession.update({
              where: { id: dbSession.id },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
              },
            });
          }
        }
      }

      return null;
    }

    return {
      id: session.id,
      timeLeft: session.timeLeft,
      isRunning: session.isRunning,
      isPaused: session.isPaused,
      duration: session.duration,
      boundTaskId: session.boundTaskId,
      isCountUpMode: session.isCountUpMode,
      countUpTime: session.countUpTime,
    };
  }

  // 获取用户的活跃会话
  private getActiveSessionByUser(userId: string): ActiveSession | undefined {
    for (const session of this.activeSessions.values()) {
      if (session.userId === userId && !session.isCompleted) {
        return session;
      }
    }
    return undefined;
  }

  // 启动计时器
  private startTimer(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const timer = setInterval(async () => {
      if (session.isCountUpMode) {
        // 正计时模式：增加已用时间
        const newCountUpTime = (session.countUpTime || 0) + 1;
        session.countUpTime = newCountUpTime;

        // 检查是否达到3小时（10800秒），自动暂停
        if (newCountUpTime >= 10800) {
          console.log('⏰ 服务器端：正计时达到3小时，自动暂停');
          session.isRunning = false;
          session.isPaused = true;
          session.countUpTime = 10800; // 锁定在3小时

          // 停止计时器
          this.stopTimer(sessionId);
        }
      } else {
        // 倒计时模式：减少剩余时间
        session.timeLeft--;
        if (session.timeLeft <= 0) {
          await this.completePomodoro(sessionId);
        }
      }
    }, 1000);

    this.timers.set(sessionId, timer);
  }

  // 停止计时器
  private stopTimer(sessionId: string) {
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(sessionId);
    }
  }

  // 完成番茄钟
  private async completePomodoro(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // 停止计时器
    this.stopTimer(sessionId);

    // 标记为完成
    session.isCompleted = true;
    session.isRunning = false;
    session.timeLeft = 0;

    // 更新数据库
    await this.prisma.pomodoroSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // 创建学习记录
    await this.prisma.studyRecord.create({
      data: {
        userId: session.userId,
        taskId: session.taskId,
        duration: session.duration,
        subject: '番茄时钟',
        startedAt: session.startedAt,
        completedAt: new Date(),
      },
    });

    // 移除活跃会话
    this.activeSessions.delete(sessionId);

    console.log(`🍅 番茄钟完成: ${sessionId}, 用户: ${session.userId}, 时长: ${session.duration}分钟`);
  }

  // 健康检查
  async checkHealth() {
    return {
      status: 'ok',
      activeSessions: this.activeSessions.size,
      timestamp: new Date().toISOString(),
    };
  }

  // 获取所有活跃会话（管理用）
  async getAllActiveSessions() {
    const sessions = Array.from(this.activeSessions.values()).map(session => ({
      id: session.id,
      userId: session.userId,
      timeLeft: session.timeLeft,
      isRunning: session.isRunning,
      isPaused: session.isPaused,
      duration: session.duration,
      startedAt: session.startedAt,
      boundTaskId: session.boundTaskId,
    }));

    return {
      count: sessions.length,
      sessions,
    };
  }

  // 强制同步特定会话
  async forceSyncSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    await this.syncSessionToDatabase(sessionId, session);
    return { success: true, message: '同步完成' };
  }

  // 清理资源
  onModuleDestroy() {
    // 清理同步定时器
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    // 清理所有番茄钟定时器
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }

    // 同步所有活跃会话到数据库
    this.syncAllSessions().catch(error => {
      console.error('服务销毁时同步会话失败:', error);
    });
  }
}
