import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { StudyModule } from './study/study.module';
import { PomodoroModule } from './pomodoro/pomodoro.module';
import { HealthModule } from './health/health.module';
import { HistoryModule } from './history/history.module';
import { ImportantInfoModule } from './important-info/important-info.module';
import { ExerciseModule } from './exercise/exercise.module';
import { ExpenseModule } from './expense/expense.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // 环境配置
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // 限流配置
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1分钟
        limit: 100, // 100次请求
      },
    ]),
    
    // 核心模块
    PrismaModule,
    AuthModule,
    UsersModule,
    TasksModule,
    StudyModule,
    PomodoroModule,
    HealthModule,
    HistoryModule,
    ImportantInfoModule,
    ExerciseModule,
    ExpenseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
