import { Module } from '@nestjs/common';
import { DailyController } from './daily.controller';
import { DailyService } from './daily.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DailyController],
  providers: [DailyService],
  exports: [DailyService],
})
export class DailyModule {}
