# LifeTracker 版本管理系统

## 📋 概述

LifeTracker 使用统一的版本管理系统，确保前端、后端和整个项目的版本号保持一致。

## 🗂️ 文件结构

```
LifeTracker/
├── version.json                           # 主版本配置文件
├── scripts/version-manager.js             # 版本管理脚本
├── package.json                          # 根项目版本
├── frontend/
│   ├── package.json                      # 前端版本
│   └── src/lib/version.ts                # 前端版本常量（自动生成）
└── backend/
    ├── package.json                      # 后端版本
    ├── src/common/version.ts             # 后端版本常量（自动生成）
    └── src/version/                      # 版本API模块
        ├── version.controller.ts
        └── version.module.ts
```

## 🔧 使用方法

### 查看当前版本信息
```bash
npm run version:info
```

### 同步版本号到所有文件
```bash
npm run version:sync
```

### 升级版本号
```bash
# 升级补丁版本 (2.1.0 -> 2.1.1)
npm run version:bump:patch

# 升级次版本 (2.1.0 -> 2.2.0)
npm run version:bump:minor

# 升级主版本 (2.1.0 -> 3.0.0)
npm run version:bump:major

# 默认升级补丁版本
npm run version:bump
```

## 📝 版本配置文件 (version.json)

```json
{
  "version": "2.1.0",
  "name": "LifeTracker",
  "description": "生活记录系统",
  "buildDate": "2024-08-15",
  "features": [
    "任务管理",
    "学习记录",
    "番茄钟计时",
    "运动记录", 
    "消费记录",
    "数据统计",
    "概览分享",
    "用户管理"
  ],
  "changelog": {
    "2.1.0": {
      "date": "2024-08-15",
      "changes": [
        "新增分享功能",
        "优化用户界面",
        "修复已知问题",
        "账户管理页面重构"
      ]
    }
  }
}
```

## 🚀 API 接口

### 获取版本信息
```
GET /api/version
```

响应：
```json
{
  "version": "2.1.0",
  "name": "LifeTracker",
  "description": "生活记录系统",
  "buildDate": "2024-08-15",
  "features": ["任务管理", "学习记录", ...],
  "versionString": "v2.1.0",
  "fullInfo": "LifeTracker v2.1.0 (2024-08-15)"
}
```

### 获取简单版本号
```
GET /api/version/simple
```

响应：
```json
{
  "version": "2.1.0",
  "versionString": "v2.1.0"
}
```

## 💻 前端使用

```typescript
import { VERSION_INFO, getVersionString, getFullVersionInfo } from '@/lib/version';

// 获取版本号
const version = VERSION_INFO.version; // "2.1.0"

// 获取版本字符串
const versionString = getVersionString(); // "v2.1.0"

// 获取完整版本信息
const fullInfo = getFullVersionInfo(); // "LifeTracker v2.1.0 (2024-08-15)"
```

## 🔄 工作流程

### 开发过程中
1. 修改 `version.json` 中的版本号和更新日志
2. 运行 `npm run version:sync` 同步到所有文件
3. 提交代码

### 发布新版本
1. 运行 `npm run version:bump:minor` 升级版本
2. 更新 `version.json` 中的 changelog
3. 运行 `npm run version:sync` 确保同步
4. 提交并打标签
5. 部署

## 📋 版本规范

遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：

- **主版本号 (MAJOR)**：不兼容的 API 修改
- **次版本号 (MINOR)**：向下兼容的功能性新增
- **修订号 (PATCH)**：向下兼容的问题修正

### 示例
- `2.0.0` → `2.0.1`：修复 bug
- `2.0.1` → `2.1.0`：新增功能
- `2.1.0` → `3.0.0`：重大更新，可能不兼容

## 🔍 自动化

版本管理脚本会自动：
1. 更新所有 `package.json` 文件的版本号
2. 生成前端和后端的版本常量文件
3. 更新构建日期
4. 保持所有文件的版本一致性

## 📚 最佳实践

1. **定期同步**：修改版本后立即运行 `npm run version:sync`
2. **记录变更**：在 `version.json` 的 changelog 中详细记录每个版本的变更
3. **标签管理**：发布时创建 Git 标签 `git tag v2.1.0`
4. **自动化集成**：在 CI/CD 中集成版本检查和同步
