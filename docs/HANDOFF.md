 # 项目交接说明

     ## 背景
    
     这个项目（LifeTracker）原本是一个考研生活追踪应用，正在重构为**考公学习 +
     错题整理**的方向。
    
     ---
    
     ## 开发模式（已确定）
    
     **本地开发 → push GitHub → 服务器自动部署**
    
     ```
     本地写代码 + 测试
       ↓ git push main
     GitHub Actions 触发
       ↓ SSH 连接服务器
       ↓ git pull 拉取最新代码
       ↓ 在服务器上编译（npm run build）
       ↓ 更新运行目录 + 重启服务
     ```
    
     关键点：**服务器上也有完整源码**（`/opt/lifetracker/`），编译在服务器本地执行，不在 GitHub
     Actions 虚拟机上打包上传。这样 AI 可以直接连服务器读取配置、日志、排查问题。
    
     ---
    
     ## 服务器现状（已完成清理）
    
     **服务器地址**：120.25.232.54，域名：t1n9.xyz
    
     **目录结构**：
     ```
     /opt/lifetracker/
     ├── app/              ← 后端实际运行目录（当前运行的编译产物）
     │   ├── backend-dist/ ← 后端编译产物
     │   ├── node_modules/
     │   └── prisma/
     ├── backend/          ← 后端源码（git 仓库，待 git pull 更新）
     ├── frontend/         ← 前端源码（git 仓库，待 git pull 更新）
     ├── nginx/            ← nginx 配置参考
     ├── .env              ← 环境变量（密钥，不进 git）
     └── docs/
     ```
    
     **前端静态文件**：`/var/www/html/`（nginx 直接托管）
    
     **运行方式**：全部原生运行（非 Docker）
     - 后端：systemd 服务 `lifetracker-backend`，运行
     `/opt/lifetracker/app/backend-dist/main.js`
     - 前端：nginx 托管静态文件 `/var/www/html/`
     - 数据库：PostgreSQL 12（系统级服务）
     - 缓存：Redis 7（系统级服务）
     - 反代：Nginx
    
     **systemd 服务文件**（`/etc/systemd/system/lifetracker-backend.service`）：
     ```ini
     [Unit]
     Description=LifeTracker Backend
     After=network.target postgresql.service redis.service
    
     [Service]
     Type=simple
     User=root
     WorkingDirectory=/opt/lifetracker/app
     EnvironmentFile=/opt/lifetracker/.env
     ExecStart=/usr/bin/node backend-dist/main.js
     Restart=always
     RestartSec=10
    
     [Install]
     WantedBy=multi-user.target
     ```
    
     **`.env` 文件**（`/opt/lifetracker/.env`，不进 git）：
     ```
     NODE_ENV=production
     DOMAIN_NAME=t1n9.xyz
     DATABASE_URL=postgresql://lifetracker:<密码>@localhost:5432/lifetracker
     REDIS_URL=redis://localhost:6379
     JWT_SECRET=<密钥>
     CORS_ORIGIN=https://t1n9.xyz
     PORT=3002
     ```
    
     **SSL 证书**：Let's Encrypt，路径 `/etc/letsencrypt/live/t1n9.xyz-0001/`，有效期到
     2026-06-13，续签已修复正常。
    
     ---
    
     ## 需要修改的文件
    
     ### `.github/workflows/deploy.yml`
    
     把原来"在 GitHub Actions 上编译 → 打包上传"的模式，改为"SSH 到服务器 → git pull →
     服务器本地编译 → 重启"。
    
     目标内容如下：
    
     ```yaml
     name: Deploy LifeTracker
    
     on:
       push:
         branches: [ main ]
       workflow_dispatch:
    
     jobs:
       deploy:
         runs-on: ubuntu-latest
         steps:
         - name: Deploy to server
           uses: appleboy/ssh-action@v1.0.0
           with:
             host: ${{ secrets.SERVER_HOST }}
             username: ${{ secrets.SERVER_USER }}
             key: ${{ secrets.SSH_PRIVATE_KEY }}
             script: |
               set -e
               cd /opt/lifetracker
    
               # 拉取最新代码
               git pull origin main
    
               # 编译后端
               cd backend
               npm ci
               npx prisma generate
               npm run build
    
               # 更新运行目录
               rm -rf /opt/lifetracker/app/backend-dist
               cp -r dist /opt/lifetracker/app/backend-dist
               cp -r node_modules /opt/lifetracker/app/node_modules
               cp -r prisma /opt/lifetracker/app/prisma
               cp package.json /opt/lifetracker/app/
    
               # 编译前端
               cd /opt/lifetracker/frontend
               npm ci
               NEXT_PUBLIC_API_URL=https://t1n9.xyz/api npm run build
    
               # 更新前端静态文件
               rm -rf /var/www/html/*
               cp -r out/* /var/www/html/
    
               # 重启后端
               systemctl restart lifetracker-backend
     ```
    
     注意：前端用的是 `next export`（静态导出），确认 `frontend/package.json` 里 `build`
     命令会输出到 `out/` 目录。如果不是，调整 `cp -r out/*` 这行。
    
     ---
    
     ## GitHub Secrets 说明
    
     Actions 里用到的 secrets，确保 GitHub 仓库里已配置：
    
     | Secret 名 | 说明 |
     |---|---|
     | `SERVER_HOST` | 服务器 IP：120.25.232.54 |
     | `SERVER_USER` | SSH 用户名（通常是 root） |
     | `SSH_PRIVATE_KEY` | SSH 私钥 |
     | `DOMAIN_NAME` | t1n9.xyz |
    
     `DB_PASSWORD`、`JWT_SECRET` 等敏感信息**不需要**放在 Secrets 里了，因为 `.env`
     文件直接在服务器上管理，Actions 不再负责生成 `.env`。
    
     ---
    
     ## 注意事项
    
     1. 服务器上的 `/opt/lifetracker/` 是 git 仓库，但目前落后 GitHub 93 个提交（还没有
     pull）。第一次 push 触发 Actions 时，`git pull` 会把所有历史一次性同步过来。
    
     2. 服务器上的 `backend/` 和 `frontend/` 是旧版源码，`app/` 是当前正在运行的编译产物。新的
     Actions 流程跑完后，`backend/` 会更新，`app/` 会被新编译产物替换。
    
     3. 前端如果改成了 Next.js SSR 模式（非静态导出），需要改成用 Node
     进程运行前端，届时服务器配置需要另外调整。目前是静态导出模式。