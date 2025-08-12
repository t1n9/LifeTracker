import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// 番茄时钟相关DTO
export class StartPomodoroDto {
  @ApiProperty({ description: '番茄钟时长（分钟）', default: 25 })
  @IsNumber()
  duration: number;

  @ApiProperty({ description: '绑定的任务ID', required: false })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiProperty({ description: '是否为正计时模式', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isCountUpMode?: boolean;
}

export class PomodoroStatusDto {
  @ApiProperty({ description: '会话ID' })
  @IsString()
  sessionId: string;

  @ApiProperty({ description: '剩余时间（秒）' })
  @IsNumber()
  timeLeft: number;

  @ApiProperty({ description: '是否运行中' })
  isRunning: boolean;

  @ApiProperty({ description: '是否暂停' })
  isPaused: boolean;

  @ApiProperty({ description: '是否完成' })
  isCompleted: boolean;

  @ApiProperty({ description: '总时长（分钟）' })
  @IsNumber()
  duration: number;

  @ApiProperty({ description: '绑定的任务ID', required: false })
  @IsOptional()
  @IsString()
  boundTaskId?: string;

  @ApiProperty({ description: '是否为正计时模式', required: false })
  @IsOptional()
  isCountUpMode?: boolean;

  @ApiProperty({ description: '正计时已用时间（秒）', required: false })
  @IsOptional()
  @IsNumber()
  countUpTime?: number;
}

export class CreateStudyRecordDto {
  @ApiProperty({ description: '学习时长（分钟）' })
  @IsNumber()
  duration: number;

  @ApiProperty({ description: '学科', required: false })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ description: '关联任务ID', required: false })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiProperty({ description: '开始时间', required: false })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiProperty({ description: '完成时间', required: false })
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}

export class CreatePomodoroSessionDto {
  @ApiProperty({ description: '番茄钟时长（分钟）' })
  @IsNumber()
  duration: number;

  @ApiProperty({ description: '番茄钟类型', enum: ['WORK', 'SHORT_BREAK', 'LONG_BREAK'] })
  @IsEnum(['WORK', 'SHORT_BREAK', 'LONG_BREAK'])
  type: 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK';

  @ApiProperty({ description: '状态', enum: ['COMPLETED', 'CANCELLED'] })
  @IsEnum(['COMPLETED', 'CANCELLED'])
  status: 'COMPLETED' | 'CANCELLED';

  @ApiProperty({ description: '关联任务ID', required: false })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiProperty({ description: '开始时间', required: false })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiProperty({ description: '完成时间', required: false })
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
