# GitHub Actions Secrets 配置指南

## 🔐 必需的 Secrets

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中添加以下 secrets：

### 服务器连接配置

| Secret 名称 | 描述 | 示例值 |
|------------|------|--------|
| `SERVER_HOST` | 服务器IP地址或域名 | `123.456.789.0` |
| `SERVER_USER` | SSH用户名 | `root` |
| `SSH_PRIVATE_KEY` | SSH私钥 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

### 域名和数据库配置

| Secret 名称 | 描述 | 示例值 |
|------------|------|--------|
| `DOMAIN_NAME` | 网站域名 | `t1n9.xyz` |
| `DB_PASSWORD` | 数据库密码 | `your-secure-db-password` |
| `JWT_SECRET` | JWT密钥 | `your-super-secret-jwt-key` |

### 邮件服务配置 ⭐ **新增**

| Secret 名称 | 描述 | 示例值 |
|------------|------|--------|
| `EMAIL_PROVIDER` | 邮件提供商 | `qq` |
| `EMAIL_USER` | 邮箱账号 | `your-email@qq.com` |
| `EMAIL_PASSWORD` | 邮箱授权码 | `abcdefghijklmnop` |

## 📧 邮件配置详细说明

### QQ邮箱配置 (推荐)

1. **登录QQ邮箱**
   - 访问 https://mail.qq.com
   - 使用QQ账号登录

2. **开启SMTP服务**
   - 点击 "设置" → "账户"
   - 找到 "POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"
   - 开启 "SMTP服务"

3. **生成授权码**
   - 点击 "生成授权码"
   - 按提示发送短信验证
   - 获得16位授权码（如：`abcdefghijklmnop`）

4. **设置Secrets**
   ```
   EMAIL_PROVIDER = qq
   EMAIL_USER = your-qq-number@qq.com
   EMAIL_PASSWORD = abcdefghijklmnop
   ```

### Gmail配置

1. **开启两步验证**
   - 访问 Google账户设置
   - 开启两步验证

2. **生成应用专用密码**
   - 在安全设置中选择 "应用专用密码"
   - 选择 "邮件" 和设备类型
   - 生成16位密码

3. **设置Secrets**
   ```
   EMAIL_PROVIDER = gmail
   EMAIL_USER = your-email@gmail.com
   EMAIL_PASSWORD = generated-app-password
   ```

### 163邮箱配置

1. **开启SMTP服务**
   - 登录163邮箱
   - 设置 → POP3/SMTP/IMAP
   - 开启SMTP服务

2. **设置客户端授权密码**
   - 按提示设置授权密码

3. **设置Secrets**
   ```
   EMAIL_PROVIDER = 163
   EMAIL_USER = your-email@163.com
   EMAIL_PASSWORD = your-auth-password
   ```

## 🚀 设置步骤

### 1. 添加服务器连接Secrets

```bash
# 在本地生成SSH密钥对（如果还没有）
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# 将公钥添加到服务器
ssh-copy-id root@your-server-ip

# 复制私钥内容到GitHub Secrets
cat ~/.ssh/id_rsa
```

### 2. 添加邮件服务Secrets

在GitHub仓库中：
1. 进入 Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 添加以下secrets：
   - `EMAIL_PROVIDER`: `qq`
   - `EMAIL_USER`: `your-email@qq.com`
   - `EMAIL_PASSWORD`: `your-qq-auth-code`

### 3. 验证配置

提交代码触发部署后，检查：

1. **部署日志**
   - 查看GitHub Actions的部署日志
   - 确认环境变量已正确设置

2. **服务器检查**
   ```bash
   # SSH到服务器
   ssh root@your-server-ip
   
   # 进入项目目录
   cd /opt/lifetracker/current
   
   # 检查环境变量
   cat .env
   
   # 运行邮件检查
   node scripts/check-email-simple.js
   ```

3. **API测试**
   ```bash
   # 测试邮件服务健康状态
   curl https://your-domain.com/api/email/health
   
   # 测试发送验证码
   curl -X POST https://your-domain.com/api/email/send-code \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","purpose":"register"}'
   ```

## 🔧 故障排除

### 常见问题

1. **邮件发送500错误**
   ```bash
   # 检查环境变量
   echo $EMAIL_USER
   echo $EMAIL_PASSWORD
   
   # 运行修复脚本
   cd /opt/lifetracker/current
   chmod +x scripts/fix-production-email.sh
   ./scripts/fix-production-email.sh
   ```

2. **授权码无效**
   - 重新生成QQ邮箱授权码
   - 确认使用的是授权码而不是QQ密码
   - 检查邮箱是否开启了SMTP服务

3. **网络连接问题**
   ```bash
   # 测试SMTP服务器连接
   telnet smtp.qq.com 465
   nc -zv smtp.qq.com 465
   ```

### 日志检查

```bash
# 查看应用日志
tail -f /opt/lifetracker/current/backend.log

# 查看系统日志
journalctl -f

# 查看Nginx日志
tail -f /var/log/nginx/error.log
```

## 📋 检查清单

部署前确认：
- [ ] 所有必需的Secrets已添加到GitHub
- [ ] 邮箱已开启SMTP服务
- [ ] 授权码已正确生成
- [ ] SSH密钥已配置

部署后验证：
- [ ] 环境变量已正确设置
- [ ] 邮件服务健康检查通过
- [ ] 能够成功发送测试邮件
- [ ] 用户注册流程正常

## 🔄 更新配置

如需更新邮件配置：

1. **更新GitHub Secrets**
   - 在仓库设置中更新相应的secret值

2. **重新部署**
   - 推送代码或手动触发GitHub Actions

3. **验证更新**
   - 检查新的环境变量是否生效
   - 测试邮件发送功能

现在您的邮件服务应该能在生产环境中正常工作了！
