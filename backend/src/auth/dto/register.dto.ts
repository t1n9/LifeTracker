import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: '邮箱地址', example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ description: '密码', example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: '密码至少6位' })
  @MaxLength(50, { message: '密码最多50位' })
  password: string;

  @ApiProperty({ description: '用户名', example: '张三', required: false })
  @IsString()
  @MaxLength(50, { message: '用户名最多50位' })
  name?: string;

  @ApiProperty({ description: '邮箱验证码', example: '123456' })
  @IsString()
  @MinLength(6, { message: '验证码必须是6位数字' })
  @MaxLength(6, { message: '验证码必须是6位数字' })
  verificationCode: string;
}
