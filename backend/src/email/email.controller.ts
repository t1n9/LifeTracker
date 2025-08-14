import { Controller, Post, Body, HttpException, HttpStatus, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiProperty } from '@nestjs/swagger';
import { EmailService } from './email.service';
import { IsEmail, IsString, IsIn } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

class SendVerificationCodeDto {
  @ApiProperty({ description: '邮箱地址' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ description: '验证码用途', enum: ['register', 'reset_password', 'change_email'] })
  @IsString()
  @IsIn(['register', 'reset_password', 'change_email'])
  purpose: 'register' | 'reset_password' | 'change_email';
}

class VerifyCodeDto {
  @ApiProperty({ description: '邮箱地址' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ description: '验证码' })
  @IsString()
  code: string;

  @ApiProperty({ description: '验证码用途' })
  @IsString()
  @IsIn(['register', 'reset_password', 'change_email'])
  purpose: string;
}

@ApiTags('邮箱验证')
@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: '检查邮件服务健康状态' })
  async checkHealth() {
    try {
      const emailUser = this.configService.get('EMAIL_USER');
      const emailPassword = this.configService.get('EMAIL_PASSWORD');
      const emailProvider = this.configService.get('EMAIL_PROVIDER', 'qq');

      return {
        success: true,
        status: 'healthy',
        config: {
          provider: emailProvider,
          user: emailUser ? '已配置' : '未配置',
          password: emailPassword ? '已配置' : '未配置',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('send-code')
  @ApiOperation({ summary: '发送验证码' })
  @ApiBody({ type: SendVerificationCodeDto })
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto) {
    try {
      // 检查邮箱发送频率限制（1分钟内只能发送一次）
      const recentCode = await this.checkRateLimit(dto.email);
      if (recentCode) {
        throw new HttpException(
          '发送过于频繁，请1分钟后再试',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      const code = await this.emailService.sendVerificationCode(dto.email, dto.purpose);

      return {
        success: true,
        message: '验证码已发送，请查收邮件',
        // 开发环境返回验证码，生产环境不返回
        ...(process.env.NODE_ENV === 'development' && { code }),
      };
    } catch (error) {
      // 记录详细错误信息
      console.error('发送验证码失败:', {
        email: dto.email,
        purpose: dto.purpose,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      throw new HttpException(
        error.message || '发送验证码失败',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('verify-code')
  @ApiOperation({ summary: '验证验证码' })
  @ApiBody({ type: VerifyCodeDto })
  async verifyCode(@Body() dto: VerifyCodeDto) {
    try {
      const isValid = await this.emailService.verifyCode(dto.email, dto.code, dto.purpose);
      
      if (!isValid) {
        throw new HttpException(
          '验证码无效或已过期',
          HttpStatus.BAD_REQUEST
        );
      }

      return {
        success: true,
        message: '验证码验证成功',
      };
    } catch (error) {
      throw new HttpException(
        error.message || '验证码验证失败',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async checkRateLimit(email: string): Promise<boolean> {
    // 这里可以实现更复杂的频率限制逻辑
    // 简单实现：检查1分钟内是否已发送过验证码
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    try {
      const recentCode = await this.prisma.emailVerification.findFirst({
        where: {
          email,
          createdAt: {
            gte: oneMinuteAgo,
          },
        },
      });

      return !!recentCode;
    } catch (error) {
      return false; // 如果查询失败，允许发送
    }
  }
}
