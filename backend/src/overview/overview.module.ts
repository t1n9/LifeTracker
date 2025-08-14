import { Module } from '@nestjs/common';
import { OverviewController } from './overview.controller';
import { ShareController } from './share.controller';
import { ShareLinkController } from './share-link.controller';
import { OverviewService } from './overview.service';
import { ShareLinkService } from './share-link.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OverviewController, ShareController, ShareLinkController],
  providers: [OverviewService, ShareLinkService],
  exports: [OverviewService, ShareLinkService],
})
export class OverviewModule {}
