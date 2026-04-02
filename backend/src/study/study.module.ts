import { Module } from '@nestjs/common';
import { StudyService } from './study.service';
import { StudyAnalysisService } from './study-analysis.service';
import { StudyController } from './study.controller';

@Module({
  controllers: [StudyController],
  providers: [StudyService, StudyAnalysisService],
  exports: [StudyService, StudyAnalysisService],
})
export class StudyModule {}
