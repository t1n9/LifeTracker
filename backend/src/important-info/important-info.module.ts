import { Module } from '@nestjs/common';
import { ImportantInfoController } from './important-info.controller';
import { ImportantInfoService } from './important-info.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ImportantInfoController],
  providers: [ImportantInfoService],
  exports: [ImportantInfoService],
})
export class ImportantInfoModule {}
