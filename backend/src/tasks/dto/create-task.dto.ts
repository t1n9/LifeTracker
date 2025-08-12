import { IsString, IsOptional, IsNumber, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ description: '任务标题', example: '学习英语单词' })
  @IsString()
  title: string;

  @ApiProperty({ description: '任务描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '学科', required: false })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ description: '优先级', required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty({ description: '是否完成', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiProperty({ description: '截止日期', required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ description: '预估小时数', required: false })
  @IsOptional()
  @IsNumber()
  estimatedHours?: number;
}
