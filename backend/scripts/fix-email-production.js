#!/usr/bin/env node

/**
 * 生产环境邮件问题快速修复脚本
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🔧 LifeTracker 邮件服务快速修复工具');
  console.log('=====================================\n');

  // 检查当前环境变量
  console.log('📋 当前环境变量状态:');
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || '未设置'}`);
  console.log(`  EMAIL_USER: ${process.env.EMAIL_USER || '未设置'}`);
  console.log(`  EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '已设置' : '未设置'}`);
  console.log(`  EMAIL_PROVIDER: ${process.env.EMAIL_PROVIDER || '未设置'}\n`);

  // 检查是否需要设置环境变量
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('❌ 检测到邮件配置不完整！\n');
    
    const setupEnv = await question('是否要设置邮件配置? (y/n): ');
    if (setupEnv.toLowerCase() === 'y') {
      await setupEmailConfig();
    }
  }

  // 测试邮件配置
  console.log('\n🧪 测试邮件配置...');
  try {
    const nodemailer = require('nodemailer');
    
    const emailProvider = process.env.EMAIL_PROVIDER || 'qq';
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;

    if (!emailUser || !emailPassword) {
      throw new Error('邮件配置不完整');
    }

    let config;
    switch (emailProvider) {
      case 'qq':
        config = {
          host: 'smtp.qq.com',
          port: 465,
          secure: true,
          auth: { user: emailUser, pass: emailPassword },
        };
        break;
      case 'gmail':
        config = {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: emailUser, pass: emailPassword },
        };
        break;
      case '163':
        config = {
          host: 'smtp.163.com',
          port: 587,
          secure: false,
          auth: { user: emailUser, pass: emailPassword },
        };
        break;
      default:
        throw new Error(`不支持的邮件提供商: ${emailProvider}`);
    }

    const transporter = nodemailer.createTransport(config);
    await transporter.verify();
    console.log('✅ 邮件配置测试成功！');

    // 询问是否发送测试邮件
    const sendTest = await question('\n是否发送测试邮件? (y/n): ');
    if (sendTest.toLowerCase() === 'y') {
      const testEmail = await question('请输入测试邮箱地址: ');
      await sendTestEmail(transporter, emailUser, testEmail);
    }

  } catch (error) {
    console.log(`❌ 邮件配置测试失败: ${error.message}`);
    console.log('\n💡 常见解决方案:');
    console.log('  1. 检查邮箱账号是否正确');
    console.log('  2. 确认使用的是授权码而不是登录密码');
    console.log('  3. 验证邮箱是否开启了SMTP服务');
    console.log('  4. 检查服务器网络连接');
  }

  rl.close();
}

async function setupEmailConfig() {
  console.log('\n⚙️  设置邮件配置...\n');
  
  const provider = await question('邮件提供商 (qq/gmail/163) [qq]: ') || 'qq';
  const user = await question('邮箱账号: ');
  const password = await question('邮箱授权码: ');

  // 创建或更新 .env 文件
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // 更新环境变量
  const updates = {
    NODE_ENV: 'production',
    EMAIL_PROVIDER: provider,
    EMAIL_USER: user,
    EMAIL_PASSWORD: password,
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, line);
    } else {
      envContent += `\n${line}`;
    }
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log(`✅ 环境变量已保存到 ${envPath}`);

  // 重新加载环境变量
  require('dotenv').config();
  console.log('✅ 环境变量已重新加载');
}

async function sendTestEmail(transporter, fromEmail, toEmail) {
  try {
    await transporter.sendMail({
      from: `"LifeTracker Test" <${fromEmail}>`,
      to: toEmail,
      subject: '【LifeTracker】邮件服务测试',
      html: `
        <h2>🎯 LifeTracker 邮件服务测试</h2>
        <p>如果您收到这封邮件，说明邮件服务配置成功！</p>
        <p>测试时间: ${new Date().toLocaleString('zh-CN')}</p>
        <p>服务器环境: ${process.env.NODE_ENV}</p>
        <hr>
        <p><small>这是一封自动发送的测试邮件，请勿回复。</small></p>
      `,
    });
    console.log('✅ 测试邮件发送成功！');
  } catch (error) {
    console.log(`❌ 测试邮件发送失败: ${error.message}`);
  }
}

main().catch(console.error);
