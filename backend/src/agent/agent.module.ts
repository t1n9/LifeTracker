import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentController } from './agent.controller';
import { AgentConfirmationService } from './agent-confirmation.service';
import { AgentContextService } from './agent-context.service';
import { AgentMemoryService } from './agent-memory.service';
import { AgentProfileService } from './agent-profile.service';
import { AgentService } from './agent.service';
import { AgentSessionService } from './agent-session.service';
import { AgentTraceService } from './agent-trace.service';
import { AgentToolsService } from './agent-tools.service';
import { AgentIntentClassifierService } from './agent-intent-classifier.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';
import { PomodoroModule } from '../pomodoro/pomodoro.module';
import { ExpenseModule } from '../expense/expense.module';
import { ExerciseModule } from '../exercise/exercise.module';
import { DailyModule } from '../daily/daily.module';
import { StudyModule } from '../study/study.module';
import { GoalsModule } from '../goals/goals.module';
import { ImportantInfoModule } from '../important-info/important-info.module';
import { StudyPlanModule } from '../study-plan/study-plan.module';

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
    StudyPlanModule,
  ],
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentConfirmationService,
    AgentContextService,
    AgentMemoryService,
    AgentProfileService,
    AgentSessionService,
    AgentTraceService,
    AgentToolsService,
    AgentIntentClassifierService,
  ],
})
export class AgentModule {}
