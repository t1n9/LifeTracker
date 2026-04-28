import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StudyPlanController } from './study-plan.controller';
import { StudyPlanService } from './study-plan.service';
import { GoalsModule } from '../goals/goals.module';

@Module({
  imports: [ConfigModule, GoalsModule],
  controllers: [StudyPlanController],
  providers: [StudyPlanService],
  exports: [StudyPlanService],
})
export class StudyPlanModule {}

