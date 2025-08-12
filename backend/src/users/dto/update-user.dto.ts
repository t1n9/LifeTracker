import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, IsDateString } from 'class-validator';
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
}
