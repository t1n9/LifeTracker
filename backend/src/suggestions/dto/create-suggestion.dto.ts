import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSuggestionDto {
  @ApiProperty({ description: '建议标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '建议内容' })
  @IsString()
  content: string;

  @ApiProperty({ description: '优先级', enum: ['low', 'normal', 'high', 'urgent'], required: false })
  @IsOptional()
  @IsEnum(['low', 'normal', 'high', 'urgent'])
  priority?: string;

  @ApiProperty({ description: '分类', enum: ['bug', 'feature', 'improvement', 'other'], required: false })
  @IsOptional()
  @IsEnum(['bug', 'feature', 'improvement', 'other'])
  category?: string;
}
