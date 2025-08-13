import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateConfigDto {
  @ApiProperty({ description: '配置值' })
  @IsString()
  value: string;

  @ApiProperty({ description: '配置描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '是否为公开配置', required: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
