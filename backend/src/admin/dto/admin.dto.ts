import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty({ description: '目标角色', enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

export class BanUserDto {
  @ApiProperty({ description: '封禁原因', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateSubscriptionDto {
  @ApiProperty({ description: '订阅方案', example: 'pro' })
  @IsString()
  plan: string;

  @ApiProperty({ description: '订阅状态', required: false, example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ description: '当前周期结束日期', required: false })
  @IsOptional()
  @IsString()
  currentPeriodEnd?: string;

  @ApiProperty({ description: '试用期结束日期', required: false })
  @IsOptional()
  @IsString()
  trialEndsAt?: string;
}

export class ListUsersQueryDto {
  @ApiProperty({ description: '页码', required: false, default: 1 })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiProperty({ description: '每页数量', required: false, default: 20 })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiProperty({ description: '搜索关键词（邮箱/名称）', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: '按角色筛选', required: false, enum: UserRole })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ description: '按状态筛选: active / banned', required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
