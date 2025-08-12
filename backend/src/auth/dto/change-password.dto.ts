import { IsString, MinLength, IsNotEmpty } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: '新密码至少需要6个字符' })
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
