import { IsString, IsOptional, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDayStartDto {
  @ApiProperty({ description: '开启内容' })
  @IsString()
  dayStart: string;

  @ApiProperty({ description: '起床时间', required: false })
  @IsOptional()
  @IsString()
  wakeUpTime?: string;

  @ApiProperty({ description: '日期', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class UpdateDayReflectionDto {
  @ApiProperty({ description: '复盘内容' })
  @IsString()
  dayReflection: string;

  @ApiProperty({ description: '复盘时间', required: false })
  @IsOptional()
  @IsString()
  reflectionTime?: string;

  @ApiProperty({ description: '手机使用时间（分钟）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1440)
  phoneUsage?: number;

  @ApiProperty({ description: '日期', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;
}
