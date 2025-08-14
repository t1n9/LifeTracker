import { Module } from '@nestjs/common';
import { OverviewController } from './overview.controller';
import { ShareController } from './share.controller';
import { OverviewService } from './overview.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OverviewController, ShareController],
  providers: [OverviewService],
  exports: [OverviewService],
})
export class OverviewModule {}
