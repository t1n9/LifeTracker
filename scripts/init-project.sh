#!/bin/bash

# LifeTracker 项目一键初始化脚本
# 适用于首次安装和开发环境设置

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 未安装，请先安装 $1"
        exit 1
    fi
}

# 检查 Node.js 版本
check_node_version() {
    local required_version="18"
    local current_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$current_version" -lt "$required_version" ]; then
        log_error "Node.js 版本过低，需要 >= $required_version，当前版本: $(node -v)"
        log_info "请访问 https://nodejs.org/ 下载最新版本"
        exit 1
    fi
    
    log_success "Node.js 版本检查通过: $(node -v)"
}

# 主函数
main() {
    echo "🎯 LifeTracker 项目一键初始化"
    echo "=================================="
    
    # 1. 环境检查
    log_info "检查环境依赖..."
    check_command "node"
    check_command "npm"
    check_command "git"
    check_node_version
    
    # 2. 安装依赖
    log_info "安装项目依赖..."
    if [ -f "package.json" ]; then
        npm install
        log_success "根目录依赖安装完成"
    fi
    
    # 安装前端依赖
    if [ -d "frontend" ]; then
        log_info "安装前端依赖..."
        cd frontend
        npm install
        cd ..
        log_success "前端依赖安装完成"
    fi
    
    # 安装后端依赖
    if [ -d "backend" ]; then
        log_info "安装后端依赖..."
        cd backend
        npm install
        cd ..
        log_success "后端依赖安装完成"
    fi
    
    # 3. 环境变量配置
    log_info "配置环境变量..."
    
    # 后端环境变量
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            cp backend/.env.example backend/.env
            log_success "后端环境变量文件已创建"
            log_warning "请编辑 backend/.env 文件配置数据库连接"
        else
            log_warning "未找到 backend/.env.example 文件"
        fi
    else
        log_info "后端环境变量文件已存在"
    fi
    
    # 前端环境变量
    if [ ! -f "frontend/.env.local" ]; then
        if [ -f "frontend/.env.example" ]; then
            cp frontend/.env.example frontend/.env.local
            log_success "前端环境变量文件已创建"
        else
            log_warning "未找到 frontend/.env.example 文件"
        fi
    else
        log_info "前端环境变量文件已存在"
    fi
    
    # 4. 数据库设置
    log_info "设置数据库..."
    
    # 检查是否有 Docker
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        log_info "检测到 Docker，可以使用 Docker 启动数据库"
        echo "选择数据库设置方式:"
        echo "1) 使用 Docker 启动 PostgreSQL (推荐)"
        echo "2) 使用现有 PostgreSQL 数据库"
        echo "3) 跳过数据库设置"
        
        read -p "请选择 (1-3): " db_choice
        
        case $db_choice in
            1)
                log_info "启动 Docker 数据库..."
                docker-compose up -d postgres
                sleep 5
                log_success "Docker 数据库已启动"
                ;;
            2)
                log_info "请确保 PostgreSQL 数据库正在运行"
                ;;
            3)
                log_warning "跳过数据库设置"
                ;;
            *)
                log_warning "无效选择，跳过数据库设置"
                ;;
        esac
    else
        log_warning "未检测到 Docker，请确保 PostgreSQL 数据库正在运行"
    fi
    
    # 5. 数据库迁移和种子数据
    if [ -d "backend" ]; then
        log_info "运行数据库迁移..."
        cd backend
        
        # 生成 Prisma 客户端
        npx prisma generate
        log_success "Prisma 客户端已生成"
        
        # 运行迁移
        if npx prisma migrate dev --name init; then
            log_success "数据库迁移完成"
            
            # 询问是否添加示例数据
            echo ""
            read -p "是否添加示例数据？(y/N): " add_seed
            if [[ $add_seed =~ ^[Yy]$ ]]; then
                log_info "添加示例数据..."
                npm run db:seed
                log_success "示例数据已添加"
                echo ""
                log_info "测试账户信息:"
                echo "邮箱: demo@lifetracker.com"
                echo "密码: 123456"
            fi
        else
            log_error "数据库迁移失败，请检查数据库连接"
        fi
        
        cd ..
    fi
    
    # 6. 完成提示
    echo ""
    echo "🎉 初始化完成！"
    echo "=================================="
    log_success "项目已成功初始化"
    echo ""
    echo "📋 下一步操作:"
    echo "1. 启动开发服务器: npm run dev"
    echo "2. 访问前端: http://localhost:3000"
    echo "3. 访问后端API: http://localhost:3002"
    echo "4. 查看API文档: http://localhost:3002/api/docs"
    echo ""
    echo "📚 更多信息:"
    echo "- 查看文档: docs/README.md"
    echo "- 快速开始: docs/quick-start.md"
    echo "- 故障排除: docs/troubleshooting.md"
    echo ""
    
    # 询问是否立即启动
    read -p "是否立即启动开发服务器？(y/N): " start_dev
    if [[ $start_dev =~ ^[Yy]$ ]]; then
        log_info "启动开发服务器..."
        npm run dev
    else
        log_info "稍后可以运行 'npm run dev' 启动开发服务器"
    fi
}

# 错误处理
trap 'log_error "初始化过程中发生错误，请检查上面的错误信息"' ERR

# 运行主函数
main "$@"
