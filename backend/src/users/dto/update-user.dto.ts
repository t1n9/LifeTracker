import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ description: '用户名', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '目标名称', required: false })
  @IsOptional()
  @IsString()
  targetName?: string;

  @ApiProperty({ description: '目标日期', required: false })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiProperty({ description: '考试日期', required: false })
  @IsOptional()
  @IsDateString()
  examDate?: string;

  @ApiProperty({ description: '主题', required: false })
  @IsOptional()
  @IsString()
  theme?: string;

  // 运动项目显示配置
  @ApiProperty({ description: '是否显示单杠', required: false })
  @IsOptional()
  @IsBoolean()
  showPullUps?: boolean;

  @ApiProperty({ description: '是否显示深蹲', required: false })
  @IsOptional()
  @IsBoolean()
  showSquats?: boolean;

  @ApiProperty({ description: '是否显示俯卧撑', required: false })
  @IsOptional()
  @IsBoolean()
  showPushUps?: boolean;

  @ApiProperty({ description: '是否显示跑步', required: false })
  @IsOptional()
  @IsBoolean()
  showRunning?: boolean;

  @ApiProperty({ description: '是否显示游泳', required: false })
  @IsOptional()
  @IsBoolean()
  showSwimming?: boolean;

  @ApiProperty({ description: '是否显示骑行', required: false })
  @IsOptional()
  @IsBoolean()
  showCycling?: boolean;
}
