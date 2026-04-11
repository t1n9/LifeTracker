import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CapturesController } from './captures.controller';
import { CapturesService } from './captures.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [CapturesController],
  providers: [CapturesService],
  exports: [CapturesService],
})
export class CapturesModule {}
