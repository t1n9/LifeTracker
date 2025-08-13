# LifeTracker 项目整理指南

这个指南将帮助你整理 LifeTracker 项目目录，让项目结构更加清晰和专业。

## 🎯 整理目标

- 将散落的脚本文件按功能分类整理
- 清理临时文件和不需要的文件
- 更新文档中的路径引用
- 创建清晰的目录结构

## 📋 整理步骤

### 第一步：备份当前状态
```bash
# 提交当前更改到git（如果有的话）
git add .
git commit -m "保存当前状态，准备整理项目目录"
```

### 第二步：运行项目整理脚本
```bash
# 整理项目目录结构
./scripts/organize-project.sh
```

这个脚本会：
- 创建新的目录结构
- 移动部署脚本到 `scripts/deployment/`
- 移动维护脚本到 `scripts/maintenance/`
- 移动开发脚本到 `scripts/development/`
- 整理后端的临时文件到相应目录

### 第三步：更新脚本路径引用
```bash
# 更新文档和配置文件中的脚本路径
./scripts/update-script-references.sh
```

这个脚本会：
- 更新 README.md 中的脚本路径
- 更新 docs/DEPLOYMENT.md 中的路径
- 更新部署脚本中的配置文件路径
- 创建便捷的符号链接

### 第四步：清理项目文件
```bash
# 清理临时文件和不需要的文件
./scripts/cleanup-project.sh
```

这个脚本会：
- 删除临时文件和调试文件
- 清理构建产物和缓存
- 删除日志文件和备份文件
- 清理IDE临时文件
- 删除空目录

### 第五步：验证整理结果
```bash
# 检查git状态，确认更改
git status

# 查看新的目录结构
tree scripts/ -I node_modules
# 或者使用
ls -la scripts/*/
```

## 📁 整理后的目录结构

```
LifeTracker/
├── scripts/
│   ├── deployment/         # 🚀 部署相关脚本
│   │   ├── deploy.sh
│   │   ├── deploy-prod.sh
│   │   ├── deploy-native.sh
│   │   ├── deploy-minimal.sh
│   │   ├── deploy-simple-native.sh
│   │   ├── test-deployment.sh
│   │   ├── deploy.config.sh
│   │   └── deploy.config.example.sh
│   ├── maintenance/        # 🔧 维护相关脚本
│   │   ├── fix-403.sh
│   │   ├── fix-nginx-config.sh
│   │   ├── fix-nginx.sh
│   │   └── fix-ssl-cert.sh
│   ├── development/        # 💻 开发相关脚本
│   │   └── init-prisma.sh
│   ├── organize-project.sh
│   ├── update-script-references.sh
│   ├── cleanup-project.sh
│   └── README.md
├── backend/
│   └── scripts/
│       ├── migration/      # 📊 数据迁移脚本
│       │   ├── direct-migration.js
│       │   ├── migrate-data-with-timezone.js
│       │   ├── test-migration.js
│       │   └── verify-migration.js
│       ├── testing/        # 🧪 测试脚本
│       │   ├── test-api-timezone.js
│       │   ├── test-date-fix.js
│       │   ├── test-time-management.js
│       │   ├── test-today-api.js
│       │   ├── test-today-data.js
│       │   └── debug-date.js
│       ├── maintenance/    # 🛠️ 后端维护脚本
│       │   └── create-test-user.js
│       ├── import-user-data.js
│       ├── migrate-expense-data.js
│       ├── migrate-json-data.ts
│       ├── reset-user-password.js
│       ├── restore-all-data.js
│       ├── restore-exercise-data.js
│       ├── restore-expense-data.js
│       └── verify-user-data.js
├── frontend/
├── docs/
├── nginx/
├── README.md
├── package.json
├── docker-compose.yml
└── ...
```

## 🔗 便捷访问

整理后，你可以通过以下方式访问常用脚本：

### 使用完整路径
```bash
./scripts/deployment/deploy.sh
./scripts/development/init-prisma.sh
./scripts/maintenance/fix-nginx.sh
```

### 使用符号链接（推荐）
```bash
./deploy                    # -> scripts/deployment/deploy.sh
./init-prisma              # -> scripts/development/init-prisma.sh
```

## ⚠️ 注意事项

### 1. 检查引用更新
整理后请检查以下文件是否需要手动更新路径：
- `package.json` 中的scripts
- `docker-compose*.yml` 中的volume挂载
- CI/CD配置文件
- 其他可能引用脚本的地方

### 2. 搜索遗漏的引用
```bash
# 搜索可能遗漏的脚本引用
grep -r "deploy\.sh" . --exclude-dir=node_modules
grep -r "init-prisma\.sh" . --exclude-dir=node_modules
```

### 3. 权限设置
确保脚本有执行权限：
```bash
chmod +x scripts/**/*.sh
chmod +x backend/scripts/**/*.js
```

## 🎉 完成后的好处

1. **清晰的目录结构** - 脚本按功能分类，易于查找
2. **专业的项目组织** - 符合开源项目的最佳实践
3. **更好的维护性** - 新脚本有明确的归属位置
4. **简化的使用** - 通过符号链接简化常用操作
5. **减少混乱** - 删除了临时文件和不需要的文件

## 🚀 下一步

整理完成后，建议：

1. **更新文档** - 确保README和其他文档反映新的结构
2. **团队同步** - 如果是团队项目，通知团队成员新的目录结构
3. **CI/CD更新** - 更新持续集成配置中的脚本路径
4. **添加到.gitignore** - 将临时文件类型添加到.gitignore避免未来混乱

## 💡 维护建议

- 定期运行 `./scripts/cleanup-project.sh` 清理临时文件
- 新增脚本时放在合适的分类目录中
- 保持 `scripts/README.md` 的更新
- 考虑添加脚本的自动化测试
