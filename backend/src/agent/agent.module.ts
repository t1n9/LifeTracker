import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentToolsService } from './agent-tools.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';
import { PomodoroModule } from '../pomodoro/pomodoro.module';
import { ExpenseModule } from '../expense/expense.module';
import { ExerciseModule } from '../exercise/exercise.module';
import { DailyModule } from '../daily/daily.module';
import { StudyModule } from '../study/study.module';
import { GoalsModule } from '../goals/goals.module';
import { ImportantInfoModule } from '../important-info/important-info.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    TasksModule,
    PomodoroModule,
    ExpenseModule,
    ExerciseModule,
    DailyModule,
    StudyModule,
    GoalsModule,
    ImportantInfoModule,
  ],
  controllers: [AgentController],
  providers: [AgentService, AgentToolsService],
})
export class AgentModule {}
