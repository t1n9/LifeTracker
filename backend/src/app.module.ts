import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { MigrationModule } from './migration/migration.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { DailyModule } from './daily/daily.module';
import { OverviewModule } from './overview/overview.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TimeFormatInterceptor, TimeValidationInterceptor } from './common/interceptors/time-format.interceptor';

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
    MigrationModule,
    SystemConfigModule,
    DailyModule,
    OverviewModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局时间格式化拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeValidationInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeFormatInterceptor,
    },
  ],
})
export class AppModule {}
