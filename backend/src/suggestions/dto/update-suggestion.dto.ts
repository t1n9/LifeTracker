import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSuggestionDto {
  @ApiProperty({ description: '状态', enum: ['pending', 'reviewed', 'implemented', 'rejected'], required: false })
  @IsOptional()
  @IsEnum(['pending', 'reviewed', 'implemented', 'rejected'])
  status?: string;

  @ApiProperty({ description: '管理员回复', required: false })
  @IsOptional()
  @IsString()
  adminReply?: string;

  @ApiProperty({ description: '优先级', enum: ['low', 'normal', 'high', 'urgent'], required: false })
  @IsOptional()
  @IsEnum(['low', 'normal', 'high', 'urgent'])
  priority?: string;
}
