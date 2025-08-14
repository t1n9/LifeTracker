import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // 支持多种SMTP配置
    const emailProvider = this.configService.get('EMAIL_PROVIDER', 'qq');
    const emailUser = this.configService.get('EMAIL_USER');
    const emailPassword = this.configService.get('EMAIL_PASSWORD');

    this.logger.log(`邮箱配置: Provider=${emailProvider}, User=${emailUser}, Password=${emailPassword ? '已设置' : '未设置'}`);

    // 验证必要的配置
    if (!emailUser || !emailPassword) {
      this.logger.error('邮箱配置不完整: EMAIL_USER 或 EMAIL_PASSWORD 未设置');
      throw new Error('邮箱服务配置不完整，请检查环境变量');
    }

    let config: any;

    switch (emailProvider) {
      case 'qq':
        config = {
          host: 'smtp.qq.com',
          port: 465,
          secure: true, // QQ邮箱需要SSL
          auth: {
            user: emailUser,
            pass: emailPassword, // QQ邮箱授权码
          },
        };
        break;
      case 'gmail':
        config = {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: this.configService.get('EMAIL_USER'),
            pass: this.configService.get('EMAIL_PASSWORD'), // Gmail应用专用密码
          },
        };
        break;
      case '163':
        config = {
          host: 'smtp.163.com',
          port: 587,
          secure: false,
          auth: {
            user: this.configService.get('EMAIL_USER'),
            pass: this.configService.get('EMAIL_PASSWORD'),
          },
        };
        break;
      default:
        throw new Error(`不支持的邮件提供商: ${emailProvider}`);
    }

    this.transporter = nodemailer.createTransport(config);
    this.logger.log(`邮件服务初始化完成，使用提供商: ${emailProvider}`);

    // 验证SMTP连接
    this.verifyConnection();
  }

  // 验证SMTP连接
  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP连接验证成功');
    } catch (error) {
      this.logger.error(`SMTP连接验证失败: ${error.message}`);
      // 不抛出错误，允许应用启动，但记录错误
    }
  }

  // 生成6位数验证码
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // 发送验证码邮件
  async sendVerificationCode(email: string, purpose: 'register' | 'reset_password' | 'change_email' = 'register'): Promise<string> {
    const code = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    try {
      // 保存验证码到数据库
      await this.prisma.emailVerification.create({
        data: {
          email,
          code,
          purpose,
          expiresAt,
        },
      });

      // 发送邮件
      const subject = this.getEmailSubject(purpose);
      const html = this.getEmailTemplate(code, purpose);

      // 先验证SMTP连接
      try {
        await this.transporter.verify();
      } catch (verifyError) {
        this.logger.error(`SMTP连接失败: ${verifyError.message}`);
        throw new Error(`邮件服务连接失败: ${verifyError.message}`);
      }

      await this.transporter.sendMail({
        from: `"LifeTracker" <${this.configService.get('EMAIL_USER')}>`,
        to: email,
        subject,
        html,
      });

      this.logger.log(`验证码邮件已发送到: ${email}, 用途: ${purpose}`);
      return code; // 开发环境返回验证码，生产环境不应返回
    } catch (error) {
      this.logger.error(`发送验证码邮件失败: ${error.message}`, error.stack);

      // 提供更详细的错误信息
      if (error.code === 'EAUTH') {
        throw new Error('邮箱认证失败，请检查邮箱账号和授权码');
      } else if (error.code === 'ECONNECTION') {
        throw new Error('无法连接到邮件服务器，请检查网络连接');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('邮件发送超时，请稍后重试');
      } else {
        throw new Error(`发送验证码失败: ${error.message}`);
      }
    }
  }

  // 验证验证码
  async verifyCode(email: string, code: string, purpose: string): Promise<boolean> {
    try {
      const verification = await this.prisma.emailVerification.findFirst({
        where: {
          email,
          code,
          purpose,
          used: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!verification) {
        return false;
      }

      // 标记验证码为已使用
      await this.prisma.emailVerification.update({
        where: { id: verification.id },
        data: { used: true },
      });

      return true;
    } catch (error) {
      this.logger.error(`验证码验证失败: ${error.message}`);
      return false;
    }
  }

  // 清理过期的验证码
  async cleanupExpiredCodes(): Promise<void> {
    try {
      const result = await this.prisma.emailVerification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      this.logger.log(`清理了 ${result.count} 个过期验证码`);
    } catch (error) {
      this.logger.error(`清理过期验证码失败: ${error.message}`);
    }
  }

  private getEmailSubject(purpose: string): string {
    switch (purpose) {
      case 'register':
        return '【LifeTracker】注册验证码';
      case 'reset_password':
        return '【LifeTracker】密码重置验证码';
      case 'change_email':
        return '【LifeTracker】邮箱变更验证码';
      default:
        return '【LifeTracker】验证码';
    }
  }

  private getEmailTemplate(code: string, purpose: string): string {
    const purposeText = {
      register: '注册账户',
      reset_password: '重置密码',
      change_email: '变更邮箱',
    }[purpose] || '验证身份';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>LifeTracker 验证码</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .code { background: #4299e1; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .warning { background: #fed7d7; border: 1px solid #feb2b2; color: #c53030; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 LifeTracker</h1>
            <p>您的专属生活追踪助手</p>
          </div>
          <div class="content">
            <h2>验证码确认</h2>
            <p>您好！</p>
            <p>您正在进行<strong>${purposeText}</strong>操作，请使用以下验证码完成验证：</p>
            
            <div class="code">${code}</div>
            
            <div class="warning">
              <strong>⚠️ 安全提醒：</strong>
              <ul>
                <li>验证码有效期为 <strong>10分钟</strong></li>
                <li>请勿将验证码告诉他人</li>
                <li>如非本人操作，请忽略此邮件</li>
              </ul>
            </div>
            
            <p>如果您没有进行此操作，请忽略此邮件。</p>
            <p>感谢您使用 LifeTracker！</p>
          </div>
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复</p>
            <p>© 2024 LifeTracker. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
