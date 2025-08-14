# 配置说明文档

## 环境配置

### 1. 基础配置

复制 `.env.example` 文件为 `.env`：

```bash
cp .env.example .env
```

然后根据你的环境修改 `.env` 文件中的配置。

### 2. 数据库配置

```env
# 本地开发环境
DATABASE_URL="postgresql://lifetracker:password@localhost:5432/lifetracker"

# 生产环境（服务器）
DATABASE_URL="postgresql://lifetracker:your-password@your-server:5432/lifetracker"
```

### 3. 邮箱验证配置

邮箱验证功能用于用户注册时发送验证码。支持以下邮件提供商：

#### QQ邮箱配置（推荐）

```env
EMAIL_PROVIDER=qq
EMAIL_USER=your-email@qq.com
EMAIL_PASSWORD=your-authorization-code
```

**配置步骤：**
1. 登录 [QQ邮箱](https://mail.qq.com)
2. 点击 设置 → 账户
3. 找到 "POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"
4. 开启 "SMTP服务"
5. 点击 "生成授权码"，按提示操作
6. 将生成的16位授权码填入 `EMAIL_PASSWORD`

**注意：** `EMAIL_PASSWORD` 不是QQ密码，而是生成的授权码！

#### Gmail配置

```env
EMAIL_PROVIDER=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

**配置步骤：**
1. 登录Gmail，进入 Google账户设置
2. 开启两步验证
3. 生成应用专用密码：
   - 安全性 → 两步验证 → 应用专用密码
   - 选择应用：邮件，选择设备：其他
   - 生成16位应用专用密码
4. 将应用专用密码填入 `EMAIL_PASSWORD`

#### 163邮箱配置

```env
EMAIL_PROVIDER=163
EMAIL_USER=your-email@163.com
EMAIL_PASSWORD=your-client-password
```

**配置步骤：**
1. 登录 [163邮箱](https://mail.163.com)
2. 点击 设置 → POP3/SMTP/IMAP
3. 开启 "SMTP服务"
4. 设置客户端授权密码（不是登录密码）
5. 将客户端授权密码填入 `EMAIL_PASSWORD`

### 4. JWT配置

```env
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"
```

**注意：** 生产环境请使用强密码！

### 5. 其他配置

```env
# 应用端口
PORT=3002

# CORS配置
CORS_ORIGIN="http://localhost:3001"

# 备份配置
BACKUP_ENABLED=true
BACKUP_INTERVAL="0 2 * * *"  # 每天凌晨2点备份
BACKUP_RETENTION_DAYS=30
```

## 配置验证

### 1. 启动应用

```bash
npm run start:dev
```

### 2. 测试邮箱配置

访问前端注册页面，尝试发送验证码：
- 前端地址：http://localhost:3001
- 点击"注册账户"
- 填写邮箱信息
- 点击"获取验证码"

如果配置正确，你应该能收到验证码邮件。

### 3. 查看日志

后端控制台会显示邮箱配置信息：
```
[EmailService] 邮箱配置: Provider=qq, User=your-email@qq.com, Password=已设置
[EmailService] 邮件服务初始化完成，使用提供商: qq
```

## 常见问题

### 1. 邮件发送失败

**错误：** `Missing credentials for PLAIN`
**解决：** 检查 `EMAIL_USER` 和 `EMAIL_PASSWORD` 是否正确设置

**错误：** `Invalid login`
**解决：** 
- QQ邮箱：确认使用的是授权码，不是QQ密码
- Gmail：确认使用的是应用专用密码，且已开启两步验证
- 163邮箱：确认使用的是客户端授权密码

### 2. 环境变量未加载

**问题：** 配置显示 `undefined`
**解决：** 
- 确认 `.env` 文件在 `backend` 目录下
- 确认配置项没有多余的空格或引号
- 重启应用

### 3. 数据库连接失败

**解决：** 
- 检查数据库是否启动
- 检查 `DATABASE_URL` 配置是否正确
- 检查网络连接

## 安全提醒

1. **不要提交真实配置到代码仓库**
2. **定期更换邮箱授权码**
3. **生产环境使用强JWT密钥**
4. **限制数据库访问权限**

## 技术支持

如果遇到配置问题，请检查：
1. 后端控制台日志
2. 网络连接
3. 邮箱服务商设置
4. 防火墙配置
