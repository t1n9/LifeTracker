@echo off
setlocal enabledelayedexpansion

REM LifeTracker 项目一键初始化脚本 (Windows)
REM 适用于首次安装和开发环境设置

echo 🎯 LifeTracker 项目一键初始化
echo ==================================

REM 检查 Node.js
echo [INFO] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js 未安装，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo [SUCCESS] Node.js 已安装: 
node --version

REM 检查 npm
echo [INFO] 检查 npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm 未安装
    pause
    exit /b 1
)
echo [SUCCESS] npm 已安装: 
npm --version

REM 安装依赖
echo [INFO] 安装项目依赖...
if exist package.json (
    npm install
    if errorlevel 1 (
        echo [ERROR] 根目录依赖安装失败
        pause
        exit /b 1
    )
    echo [SUCCESS] 根目录依赖安装完成
)

REM 安装前端依赖
if exist frontend (
    echo [INFO] 安装前端依赖...
    cd frontend
    npm install
    if errorlevel 1 (
        echo [ERROR] 前端依赖安装失败
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [SUCCESS] 前端依赖安装完成
)

REM 安装后端依赖
if exist backend (
    echo [INFO] 安装后端依赖...
    cd backend
    npm install
    if errorlevel 1 (
        echo [ERROR] 后端依赖安装失败
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [SUCCESS] 后端依赖安装完成
)

REM 配置环境变量
echo [INFO] 配置环境变量...

REM 后端环境变量
if not exist backend\.env (
    if exist backend\.env.example (
        copy backend\.env.example backend\.env >nul
        echo [SUCCESS] 后端环境变量文件已创建
        echo [WARNING] 请编辑 backend\.env 文件配置数据库连接
    ) else (
        echo [WARNING] 未找到 backend\.env.example 文件
    )
) else (
    echo [INFO] 后端环境变量文件已存在
)

REM 前端环境变量
if not exist frontend\.env.local (
    if exist frontend\.env.example (
        copy frontend\.env.example frontend\.env.local >nul
        echo [SUCCESS] 前端环境变量文件已创建
    ) else (
        echo [WARNING] 未找到 frontend\.env.example 文件
    )
) else (
    echo [INFO] 前端环境变量文件已存在
)

REM 数据库设置
echo [INFO] 设置数据库...
docker --version >nul 2>&1
if not errorlevel 1 (
    echo [INFO] 检测到 Docker，可以使用 Docker 启动数据库
    echo 选择数据库设置方式:
    echo 1^) 使用 Docker 启动 PostgreSQL ^(推荐^)
    echo 2^) 使用现有 PostgreSQL 数据库
    echo 3^) 跳过数据库设置
    
    set /p db_choice="请选择 (1-3): "
    
    if "!db_choice!"=="1" (
        echo [INFO] 启动 Docker 数据库...
        docker-compose up -d postgres
        timeout /t 5 /nobreak >nul
        echo [SUCCESS] Docker 数据库已启动
    ) else if "!db_choice!"=="2" (
        echo [INFO] 请确保 PostgreSQL 数据库正在运行
    ) else (
        echo [WARNING] 跳过数据库设置
    )
) else (
    echo [WARNING] 未检测到 Docker，请确保 PostgreSQL 数据库正在运行
)

REM 数据库迁移和种子数据
if exist backend (
    echo [INFO] 运行数据库迁移...
    cd backend
    
    REM 生成 Prisma 客户端
    npx prisma generate
    if errorlevel 1 (
        echo [ERROR] Prisma 客户端生成失败
        cd ..
        pause
        exit /b 1
    )
    echo [SUCCESS] Prisma 客户端已生成
    
    REM 运行迁移
    npx prisma migrate dev --name init
    if not errorlevel 1 (
        echo [SUCCESS] 数据库迁移完成
        
        REM 询问是否添加示例数据
        echo.
        set /p add_seed="是否添加示例数据？(y/N): "
        if /i "!add_seed!"=="y" (
            echo [INFO] 添加示例数据...
            npm run db:seed
            if not errorlevel 1 (
                echo [SUCCESS] 示例数据已添加
                echo.
                echo [INFO] 测试账户信息:
                echo 邮箱: demo@lifetracker.com
                echo 密码: 123456
            )
        )
    ) else (
        echo [ERROR] 数据库迁移失败，请检查数据库连接
    )
    
    cd ..
)

REM 完成提示
echo.
echo 🎉 初始化完成！
echo ==================================
echo [SUCCESS] 项目已成功初始化
echo.
echo 📋 下一步操作:
echo 1. 启动开发服务器: npm run dev
echo 2. 访问前端: http://localhost:3000
echo 3. 访问后端API: http://localhost:3002
echo 4. 查看API文档: http://localhost:3002/api/docs
echo.
echo 📚 更多信息:
echo - 查看文档: docs\README.md
echo - 快速开始: docs\quick-start.md
echo - 故障排除: docs\troubleshooting.md
echo.

REM 询问是否立即启动
set /p start_dev="是否立即启动开发服务器？(y/N): "
if /i "!start_dev!"=="y" (
    echo [INFO] 启动开发服务器...
    npm run dev
) else (
    echo [INFO] 稍后可以运行 'npm run dev' 启动开发服务器
)

pause
