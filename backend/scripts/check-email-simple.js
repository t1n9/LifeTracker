#!/usr/bin/env node

/**
 * 简化版邮件配置检查工具
 * 不依赖 nodemailer，只检查配置和网络连接
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          process.env[key] = value;
        }
      }
    }
    console.log('✅ 已加载 .env 文件');
  } else {
    console.log('⚠️ 未找到 .env 文件');
  }
}

function testConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000;

    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function checkEmailConfig() {
  console.log('🔍 开始检查邮件配置...\n');

  // 加载环境变量
  loadEnvFile();

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
    console.log('\n💡 设置方法:');
    console.log('  1. 在 .env 文件中添加:');
    console.log('     EMAIL_USER=your-email@qq.com');
    console.log('     EMAIL_PASSWORD=your-auth-code');
    console.log('     EMAIL_PROVIDER=qq');
    console.log('\n  2. 或者设置环境变量:');
    console.log('     export EMAIL_USER="your-email@qq.com"');
    console.log('     export EMAIL_PASSWORD="your-auth-code"');
    console.log('     export EMAIL_PROVIDER="qq"');
    return false;
  }

  // 2. 检查SMTP服务器配置
  console.log('\n⚙️  SMTP服务器配置:');
  let smtpConfig;

  switch (emailProvider) {
    case 'qq':
      smtpConfig = { host: 'smtp.qq.com', port: 465, secure: true };
      break;
    case 'gmail':
      smtpConfig = { host: 'smtp.gmail.com', port: 587, secure: false };
      break;
    case '163':
      smtpConfig = { host: 'smtp.163.com', port: 587, secure: false };
      break;
    default:
      console.log(`❌ 不支持的邮件提供商: ${emailProvider}`);
      return false;
  }

  console.log(`  提供商: ${emailProvider}`);
  console.log(`  SMTP服务器: ${smtpConfig.host}:${smtpConfig.port}`);
  console.log(`  SSL/TLS: ${smtpConfig.secure ? 'SSL' : 'STARTTLS'}`);

  // 3. 测试网络连接
  console.log('\n🔗 测试SMTP服务器连接...');
  const connected = await testConnection(smtpConfig.host, smtpConfig.port);
  
  if (connected) {
    console.log('✅ SMTP服务器连接成功！');
  } else {
    console.log('❌ SMTP服务器连接失败！');
    console.log('\n💡 可能的原因:');
    console.log('  1. 网络连接问题');
    console.log('  2. 防火墙阻止了SMTP端口');
    console.log('  3. 服务器限制了出站连接');
    console.log('\n🔧 解决建议:');
    console.log('  1. 检查网络连接');
    console.log('  2. 确认防火墙设置');
    console.log('  3. 联系服务器管理员');
    return false;
  }

  // 4. 检查邮箱配置建议
  console.log('\n📧 邮箱配置检查:');
  
  if (emailProvider === 'qq') {
    console.log('  QQ邮箱配置建议:');
    console.log('  1. 登录QQ邮箱 → 设置 → 账户');
    console.log('  2. 开启SMTP服务');
    console.log('  3. 生成授权码（16位字符）');
    console.log('  4. 使用授权码而不是QQ密码');
  } else if (emailProvider === 'gmail') {
    console.log('  Gmail配置建议:');
    console.log('  1. 开启两步验证');
    console.log('  2. 生成应用专用密码');
    console.log('  3. 使用应用专用密码而不是账户密码');
  } else if (emailProvider === '163') {
    console.log('  163邮箱配置建议:');
    console.log('  1. 登录163邮箱 → 设置 → POP3/SMTP/IMAP');
    console.log('  2. 开启SMTP服务');
    console.log('  3. 设置客户端授权密码');
  }

  console.log('\n✅ 邮件配置检查完成！');
  console.log('\n💡 下一步:');
  console.log('  1. 重启应用以加载新的环境变量');
  console.log('  2. 测试发送验证码功能');
  console.log('  3. 检查应用日志确认邮件发送状态');
  
  return true;
}

// 运行检查
checkEmailConfig().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 检查过程中出现错误:', error.message);
  process.exit(1);
});
