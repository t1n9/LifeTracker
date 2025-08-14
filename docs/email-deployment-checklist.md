# 邮件服务部署检查清单

## 🔍 问题诊断

当邮件发送在开发环境正常，但在生产环境出现 500 错误时，通常是以下原因：

### 1. 环境变量配置问题

**检查项目：**
- [ ] `EMAIL_USER` 是否正确设置
- [ ] `EMAIL_PASSWORD` 是否正确设置（注意：是授权码，不是登录密码）
- [ ] `EMAIL_PROVIDER` 是否正确设置（qq/gmail/163）
- [ ] `NODE_ENV` 是否设置为 `production`

**验证方法：**
```bash
# 在服务器上检查环境变量
echo $EMAIL_USER
echo $EMAIL_PASSWORD
echo $EMAIL_PROVIDER
echo $NODE_ENV
```

### 2. 邮箱服务配置问题

**QQ邮箱配置：**
- [ ] 已开启SMTP服务
- [ ] 使用授权码而不是QQ密码
- [ ] 授权码格式正确（16位字符）

**Gmail配置：**
- [ ] 已开启两步验证
- [ ] 使用应用专用密码
- [ ] 允许不够安全的应用访问

**163邮箱配置：**
- [ ] 已开启SMTP服务
- [ ] 使用授权码

### 3. 网络连接问题

**检查项目：**
- [ ] 服务器能否访问SMTP服务器
- [ ] 防火墙是否阻止SMTP端口
- [ ] DNS解析是否正常

**验证方法：**
```bash
# 测试SMTP服务器连接
telnet smtp.qq.com 465
telnet smtp.gmail.com 587
telnet smtp.163.com 587

# 测试DNS解析
nslookup smtp.qq.com
```

## 🛠️ 诊断工具

### 1. 使用邮件配置检查脚本

```bash
# 在后端目录运行
cd backend
node scripts/check-email-config.js

# 发送测试邮件
node scripts/check-email-config.js your-email@example.com
```

### 2. 检查邮件服务健康状态

```bash
# 访问健康检查端点
curl https://your-domain.com/api/email/health
```

### 3. 查看服务器日志

```bash
# 查看应用日志
pm2 logs your-app-name

# 查看系统日志
journalctl -u your-service-name -f
```

## 🔧 常见问题解决方案

### 问题1: EAUTH 认证失败

**原因：** 邮箱账号或授权码错误

**解决方案：**
1. 确认邮箱账号正确
2. 重新生成授权码
3. 检查环境变量是否正确设置

### 问题2: ECONNECTION 连接失败

**原因：** 网络连接问题

**解决方案：**
1. 检查服务器网络连接
2. 确认防火墙设置
3. 验证SMTP服务器地址和端口

### 问题3: ETIMEDOUT 连接超时

**原因：** 网络延迟或服务器负载

**解决方案：**
1. 增加连接超时时间
2. 检查服务器负载
3. 考虑使用不同的SMTP服务器

### 问题4: 环境变量未设置

**原因：** 生产环境缺少必要的环境变量

**解决方案：**
1. 在服务器上设置环境变量
2. 使用 `.env` 文件（确保不提交到版本控制）
3. 使用容器环境变量或云服务配置

## 📋 部署前检查清单

### 开发环境测试
- [ ] 邮件发送功能正常
- [ ] 验证码接收正常
- [ ] 错误处理正确

### 生产环境准备
- [ ] 环境变量已正确设置
- [ ] 邮箱服务已配置
- [ ] 网络连接已测试
- [ ] 日志记录已启用

### 部署后验证
- [ ] 健康检查端点正常
- [ ] 发送测试邮件成功
- [ ] 错误日志无异常
- [ ] 用户注册流程正常

## 🚀 部署建议

### 1. 使用环境变量管理

```bash
# 在服务器上设置环境变量
export EMAIL_USER="your-email@qq.com"
export EMAIL_PASSWORD="your-auth-code"
export EMAIL_PROVIDER="qq"
export NODE_ENV="production"
```

### 2. 使用进程管理器

```bash
# 使用 PM2 管理应用
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 3. 监控和日志

```bash
# 设置日志轮转
pm2 install pm2-logrotate

# 监控应用状态
pm2 monit
```

### 4. 备用方案

- 配置多个邮件提供商
- 实现邮件队列机制
- 添加重试逻辑
- 设置告警通知

## 📞 故障排除步骤

1. **检查环境变量**
   ```bash
   node scripts/check-email-config.js
   ```

2. **测试SMTP连接**
   ```bash
   telnet smtp.qq.com 465
   ```

3. **查看应用日志**
   ```bash
   pm2 logs --lines 100
   ```

4. **发送测试邮件**
   ```bash
   curl -X POST https://your-domain.com/api/email/send-code \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","purpose":"register"}'
   ```

5. **检查服务健康状态**
   ```bash
   curl https://your-domain.com/api/email/health
   ```

如果以上步骤都无法解决问题，请检查：
- 云服务商的SMTP限制
- 服务器的安全组设置
- 域名的SPF/DKIM记录
- 邮件服务商的发送限制
