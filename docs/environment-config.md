# 环境变量配置说明

## 📋 **配置方式对比**

### 🔧 **方式1：服务器直接配置（推荐）**

**适用场景：**
- 生产环境快速配置
- 不想依赖 GitHub Actions
- 需要灵活修改配置

**操作方法：**
```bash
# SSH到服务器
ssh root@your-server-ip

# 进入项目目录
cd /opt/lifetracker/current

# 编辑.env文件
nano .env

# 添加配置
EMAIL_PROVIDER=qq
EMAIL_USER=your-email@qq.com
EMAIL_PASSWORD=your-auth-code

# 重启应用
pkill -f "node.*main.js"
nohup node backend-dist/main.js > backend.log 2>&1 &
```

**优点：**
- ✅ 立即生效，无需重新部署
- ✅ 配置简单直接
- ✅ 不会被 GitHub Actions 覆盖

### 🚀 **方式2：GitHub Actions 配置**

**适用场景：**
- 完全自动化部署
- 多环境管理
- 团队协作

**操作方法：**
1. 在 GitHub 仓库设置中添加 Secrets
2. 推送代码触发自动部署

**优点：**
- ✅ 版本控制
- ✅ 自动化程度高
- ✅ 安全性好

## 🔄 **部署行为说明**

### **当前部署策略**

1. **保留现有配置**：
   - 如果服务器上已有 `.env` 文件，会备份
   - 只更新基础配置（数据库、JWT等）
   - **保留邮件配置**，不会覆盖

2. **配置优先级**：
   ```
   服务器 .env 文件 > GitHub Actions Secrets
   ```

3. **邮件配置处理**：
   - 如果服务器上已配置邮件，保持不变
   - 如果没有配置，应用仍可正常启动
   - 邮件功能为可选功能

### **部署流程**

```bash
# 1. 备份现有配置
cp .env .env.backup

# 2. 生成新的基础配置
echo "DOMAIN_NAME=..." > .env.new
echo "DB_PASSWORD=..." >> .env.new
# ... 其他基础配置

# 3. 保留邮件配置
grep "^EMAIL_" .env.backup >> .env.new

# 4. 应用新配置
mv .env.new .env
```

## 📧 **邮件配置详情**

### **必需的环境变量**

```bash
EMAIL_PROVIDER=qq          # 邮件提供商
EMAIL_USER=your@qq.com     # 邮箱账号
EMAIL_PASSWORD=auth-code   # 授权码（不是密码）
```

### **QQ邮箱配置步骤**

1. **开启SMTP服务**：
   - 登录QQ邮箱 → 设置 → 账户
   - 找到"POP3/IMAP/SMTP"服务
   - 开启SMTP服务

2. **生成授权码**：
   - 点击"生成授权码"
   - 发送短信验证
   - 获得16位授权码

3. **配置环境变量**：
   ```bash
   EMAIL_PROVIDER=qq
   EMAIL_USER=your-qq-number@qq.com
   EMAIL_PASSWORD=16位授权码
   ```

## 🔧 **配置验证**

### **检查配置是否生效**

```bash
# 1. 检查环境变量
cat .env | grep EMAIL

# 2. 运行配置检查
node scripts/check-email-simple.js

# 3. 测试邮件服务
curl http://localhost:3002/api/email/health

# 4. 测试发送验证码
curl -X POST http://localhost:3002/api/email/send-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","purpose":"register"}'
```

### **常见问题排查**

1. **邮件发送失败**：
   ```bash
   # 检查配置
   echo $EMAIL_USER
   echo $EMAIL_PASSWORD
   
   # 检查网络连接
   telnet smtp.qq.com 465
   ```

2. **应用启动失败**：
   ```bash
   # 查看日志
   tail -f backend.log
   
   # 检查进程
   ps aux | grep node
   ```

## 📝 **最佳实践**

### **生产环境推荐**

1. **直接在服务器配置**：
   - 快速、简单、可靠
   - 不依赖外部系统

2. **定期备份配置**：
   ```bash
   cp .env .env.backup.$(date +%Y%m%d)
   ```

3. **监控配置变化**：
   - 部署后检查配置是否正确
   - 验证关键功能是否正常

### **开发环境**

1. **使用本地 .env 文件**
2. **不提交到版本控制**
3. **团队共享配置模板**

## 🎯 **总结**

- **服务器直接配置**：适合快速修复和灵活调整
- **GitHub Actions**：适合自动化和团队协作
- **邮件配置**：可选功能，不影响应用核心功能
- **部署安全**：现有配置不会被意外覆盖
