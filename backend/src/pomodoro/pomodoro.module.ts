import { Module } from '@nestjs/common';
import { PomodoroController } from './pomodoro.controller';
import { PomodoroService } from './pomodoro.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PomodoroController],
  providers: [PomodoroService],
  exports: [PomodoroService],
})
export class PomodoroModule {}
