import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExerciseService } from './exercise.service';

export class AddLogDto {
  @IsString()
  exerciseName: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  date?: string;
}

export class SetExerciseFeelingDto {
  @IsString()
  @IsIn(['excellent', 'good', 'normal', 'tired'])
  feeling: string;
}

@Controller('exercise')
@UseGuards(JwtAuthGuard)
export class ExerciseController {
  constructor(private readonly exerciseService: ExerciseService) {}

  @Get('today')
  async getTodayLogs(@Req() req: any) {
    const userId = req.user.id;
    const timezone = req.user.timezone || 'Asia/Shanghai';
    const logs = await this.exerciseService.getTodayLogs(userId, timezone);
    return { data: logs };
  }

  @Post('logs')
  async addLog(@Body() dto: AddLogDto, @Req() req: any) {
    const userId = req.user.id;
    const timezone = req.user.timezone || 'Asia/Shanghai';
    const log = await this.exerciseService.addLog(userId, dto, timezone);
    return { data: log, message: '运动记录添加成功' };
  }

  @Delete('logs/:id')
  async deleteLog(@Param('id') logId: string, @Req() req: any) {
    const userId = req.user.id;
    await this.exerciseService.deleteLog(userId, logId);
    return { message: '运动记录删除成功' };
  }

  @Get('range')
  async getLogsByRange(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const data = await this.exerciseService.getLogsByDateRange(userId, from, to);
    return { data };
  }

  @Put('feeling')
  async setTodayExerciseFeeling(@Body() dto: SetExerciseFeelingDto, @Req() req: any) {
    const userId = req.user.id;
    const timezone = req.user.timezone || 'Asia/Shanghai';
    const daily = await this.exerciseService.setTodayExerciseFeeling(userId, dto.feeling, timezone);
    return { data: daily, message: '运动感受设置成功' };
  }

  @Get('feeling')
  async getTodayExerciseFeeling(@Req() req: any) {
    const userId = req.user.id;
    const timezone = req.user.timezone || 'Asia/Shanghai';
    const feeling = await this.exerciseService.getTodayExerciseFeeling(userId, timezone);
    return { data: { feeling } };
  }
}
