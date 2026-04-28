import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, PrismaService],
  exports: [AdminGuard],
})
export class AdminModule {}
