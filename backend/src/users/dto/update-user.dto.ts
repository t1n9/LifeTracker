import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ description: '用户名', required: false })
  @IsOptional()
  @IsString()
  name?: string;



  @ApiProperty({ description: '主题', required: false })
  @IsOptional()
  @IsString()
  theme?: string;

}
