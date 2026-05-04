import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { StudyPlanReferenceService } from '../study-plan/study-plan-reference.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, PrismaService, StudyPlanReferenceService],
  exports: [AdminGuard],
})
export class AdminModule {}
