import { IsEmail, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: '邮箱地址' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '密码哈希' })
  @IsString()
  passwordHash: string;

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
