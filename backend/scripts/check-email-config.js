#!/usr/bin/env node

/**
 * 邮件配置检查工具
 * 用于诊断邮件发送问题
 */

const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkEmailConfig() {
  console.log('🔍 开始检查邮件配置...\n');

  // 1. 检查环境变量
  console.log('📋 环境变量检查:');
  const emailProvider = process.env.EMAIL_PROVIDER || 'qq';
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const nodeEnv = process.env.NODE_ENV || 'development';

  console.log(`  NODE_ENV: ${nodeEnv}`);
  console.log(`  EMAIL_PROVIDER: ${emailProvider}`);
  console.log(`  EMAIL_USER: ${emailUser || '❌ 未设置'}`);
  console.log(`  EMAIL_PASSWORD: ${emailPassword ? '✅ 已设置' : '❌ 未设置'}`);

  if (!emailUser || !emailPassword) {
    console.log('\n❌ 邮箱配置不完整！');
    console.log('请确保设置了以下环境变量:');
    console.log('  - EMAIL_USER: 邮箱账号');
    console.log('  - EMAIL_PASSWORD: 邮箱授权码（不是登录密码）');
    return;
  }

  // 2. 创建传输器配置
  console.log('\n⚙️  创建邮件传输器...');
  let config;

  switch (emailProvider) {
    case 'qq':
      config = {
        host: 'smtp.qq.com',
        port: 465,
        secure: true,
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      };
      break;
    case 'gmail':
      config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      };
      break;
    case '163':
      config = {
        host: 'smtp.163.com',
        port: 587,
        secure: false,
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      };
      break;
    default:
      console.log(`❌ 不支持的邮件提供商: ${emailProvider}`);
      return;
  }

  console.log(`  提供商: ${emailProvider}`);
  console.log(`  SMTP服务器: ${config.host}:${config.port}`);
  console.log(`  SSL/TLS: ${config.secure ? 'SSL' : 'STARTTLS'}`);

  // 3. 创建传输器
  const transporter = nodemailer.createTransport(config);

  // 4. 验证连接
  console.log('\n🔗 验证SMTP连接...');
  try {
    await transporter.verify();
    console.log('✅ SMTP连接验证成功！');
  } catch (error) {
    console.log('❌ SMTP连接验证失败:');
    console.log(`  错误代码: ${error.code || '未知'}`);
    console.log(`  错误信息: ${error.message}`);
    
    // 提供解决建议
    if (error.code === 'EAUTH') {
      console.log('\n💡 解决建议:');
      console.log('  1. 检查邮箱账号是否正确');
      console.log('  2. 检查授权码是否正确（不是登录密码）');
      console.log('  3. 确认已开启SMTP服务');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n💡 解决建议:');
      console.log('  1. 检查网络连接');
      console.log('  2. 检查防火墙设置');
      console.log('  3. 确认SMTP服务器地址和端口');
    }
    return;
  }

  // 5. 发送测试邮件（可选）
  const testEmail = process.argv[2];
  if (testEmail) {
    console.log(`\n📧 发送测试邮件到: ${testEmail}`);
    try {
      await transporter.sendMail({
        from: `"LifeTracker Test" <${emailUser}>`,
        to: testEmail,
        subject: '【LifeTracker】邮件配置测试',
        html: `
          <h2>🎯 LifeTracker 邮件配置测试</h2>
          <p>如果您收到这封邮件，说明邮件配置正常！</p>
          <p>测试时间: ${new Date().toLocaleString('zh-CN')}</p>
          <p>环境: ${nodeEnv}</p>
          <p>提供商: ${emailProvider}</p>
        `,
      });
      console.log('✅ 测试邮件发送成功！');
    } catch (error) {
      console.log('❌ 测试邮件发送失败:');
      console.log(`  错误信息: ${error.message}`);
    }
  } else {
    console.log('\n💡 提示: 可以添加邮箱地址参数来发送测试邮件');
    console.log('  例如: node check-email-config.js test@example.com');
  }

  console.log('\n✅ 邮件配置检查完成！');
}

// 运行检查
checkEmailConfig().catch(console.error);
