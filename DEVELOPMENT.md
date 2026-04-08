# 📖 开发规范

本文档定义了LifeTracker项目的开发标准和最佳实践。

## 目录结构规范

### 后端 (Backend)

```
backend/
├── src/
│   ├── common/          # 共享工具和拦截器
│   ├── [module]/        # 功能模块
│   │   ├── [module].controller.ts
│   │   ├── [module].service.ts
│   │   ├── [module].module.ts
│   │   └── dto/         # 数据传输对象
│   ├── app.module.ts    # 主应用模块
│   ├── app.service.ts
│   ├── main.ts          # 应用入口
│   └── ...
├── prisma/
│   ├── schema.prisma    # 数据库 Schema
│   └── migrations/      # 数据库迁移
├── scripts/             # 自动化脚本
├── .env.example         # 环境变量示例
├── package.json
└── tsconfig.json
```

### 前端 (Frontend)

```
frontend/
├── src/
│   ├── app/             # Next.js App Router 页面
│   │   ├── page.tsx     # 首页
│   │   ├── layout.tsx   # 布局
│   │   └── [route]/     # 路由
│   ├── components/      # React 组件
│   │   ├── [feature]/   # 功能组件
│   │   └── common/      # 通用组件
│   ├── hooks/           # 自定义 hooks
│   ├── services/        # API 服务
│   ├── store/           # 状态管理 (Zustand)
│   ├── lib/             # 工具函数库
│   ├── styles/          # 全局样式
│   ├── types/           # TypeScript 类型定义
│   └── ...
├── public/              # 静态资源
├── .env.example         # 环境变量示例
├── package.json
└── tsconfig.json
```

## 命名规范

### 文件和文件夹

- **文件夹**: 使用 kebab-case (小写+连字符)
  - ✅ `user-management`, `study-analysis`, `ai-toolbox`
  - ❌ `UserManagement`, `user_management`, `usermanagement`

- **React 组件**: 使用 PascalCase + .tsx 后缀
  - ✅ `UserProfile.tsx`, `DashboardCard.tsx`, `AIToolbox.tsx`
  - ❌ `userProfile.tsx`, `dashboard-card.tsx`

- **其他 TypeScript 文件**: 使用 camelCase + .ts 后缀
  - ✅ `userService.ts`, `dateUtil.ts`, `apiClient.ts`
  - ❌ `UserService.ts`, `user-service.ts`

- **样式文件**: 使用 camelCase.module.css 或 inline CSS
  - ✅ `userProfile.module.css`, `styles.module.css`
  - ❌ `user-profile.css`, `UserProfile.css`

### 变量和函数

- **常量**: 使用 UPPER_SNAKE_CASE
  - ✅ `const MAX_FILE_SIZE = 5242880`
  - ✅ `const API_BASE_URL = "https://api.example.com"`

- **函数和变量**: 使用 camelCase
  - ✅ `function getUserData() {}`
  - ✅ `const userData = {}`

- **布尔变量**: 前缀使用 `is`, `has`, `should`, `can`
  - ✅ `isLoading`, `hasError`, `shouldFetch`, `canDelete`

## 代码风格

### TypeScript

1. **类型定义**
   ```typescript
   // ✅ 定义接口而非类型
   interface User {
     id: string
     name: string
     email: string
   }

   // ✅ 使用 readonly 标记不可变字段
   interface Config {
     readonly apiUrl: string
     readonly timeout: number
   }
   ```

2. **避免 Any**
   ```typescript
   // ❌ 避免
   const data: any = response.data

   // ✅ 正确
   const data: UserData = response.data
   ```

3. **函数签名**
   ```typescript
   // ✅ 明确的返回类型
   function getUserById(id: string): Promise<User | null> {
     // ...
   }

   // ✅ 枚举而非字符串联合
   enum TaskStatus {
     PENDING = 'PENDING',
     IN_PROGRESS = 'IN_PROGRESS',
     COMPLETED = 'COMPLETED',
   }
   ```

### React 组件

1. **函数式组件**
   ```typescript
   // ✅ 使用函数式组件 + hooks
   interface Props {
     userId: string
     onUpdate?: (user: User) => void
   }

   export function UserProfile({ userId, onUpdate }: Props) {
     const [user, setUser] = useState<User | null>(null)
     const [loading, setLoading] = useState(false)

     useEffect(() => {
       // 逻辑
     }, [userId])

     return <div>Profile Content</div>
   }
   ```

2. **组件导出**
   ```typescript
   // ✅ 命名导出
   export function MyComponent() {
     // ...
   }

   // ✅ 默认导出 (仅用于页面)
   export default function Page() {
     // ...
   }
   ```

3. **Props 验证**
   ```typescript
   // ✅ 使用 TypeScript 接口而非 PropTypes
   interface ButtonProps {
     variant?: 'primary' | 'secondary'
     disabled?: boolean
     onClick: (event: React.MouseEvent) => void
     children: React.ReactNode
   }
   ```

### CSS 和样式

使用 CSS 变量 + inline styles（当前项目标准）：

```typescript
// ✅ 使用 CSS 变量
const styles = {
  card: {
    background: 'var(--glass-light)',
    border: '1px solid var(--glass-border)',
    borderRadius: '16px',
    padding: '20px',
    backdropFilter: 'blur(10px)',
  },
}

export function Card() {
  return <div style={styles.card}>Content</div>
}
```

## API 和数据流

### RESTful 路由

```
GET    /api/[resource]              # 列表
GET    /api/[resource]/:id          # 详情
POST   /api/[resource]              # 创建
PATCH  /api/[resource]/:id          # 更新
DELETE /api/[resource]/:id          # 删除
```

### DTO 命名规范

```typescript
// 后端 (NestJS)
export class CreateUserDto {
  name: string
  email: string
}

export class UpdateUserDto {
  name?: string
  email?: string
}

export class UserResponseDto {
  id: string
  name: string
  email: string
  createdAt: Date
}
```

### 错误处理

```typescript
// ✅ 返回有意义的错误
throw new BadRequestException({
  message: 'Invalid email format',
  code: 'INVALID_EMAIL',
})

// ✅ 前端处理
try {
  const user = await fetchUser(id)
} catch (error) {
  if (error.code === 'INVALID_EMAIL') {
    // 处理特定错误
  }
  logger.error('Failed to fetch user', error)
}
```

## Git 工作流

### 分支规范

- `main` - 生产分支，必须稳定且可部署
- `develop` - 开发分支，集成分支
- `feature/[feature-name]` - 功能分支
- `fix/[bug-name]` - 修复分支

### 提交消息规范 (Conventional Commits)

```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat`: 新功能
- `fix`: 修复 bug
- `refactor`: 代码重构（不改变功能）
- `perf`: 性能优化
- `docs`: 文档更新
- `style`: 代码风格调整（不影响代码逻辑）
- `test`: 添加或修改测试
- `chore`: 构建过程、依赖管理等

**例子:**
```
feat: 添加学习分析 AI 功能

实现 GLM-4-Flash 模型的学习分析
- 添加 StudyAnalysisService
- 集成 AI API 调用
- 保存分析记录到数据库

Closes #123
```

## 代码审查清单

在提交 PR 前，请确保：

- [ ] 代码遵循项目规范
- [ ] TypeScript 类型检查通过 (`tsc --noEmit`)
- [ ] Linting 通过 (`npm run lint`)
- [ ] 代码格式化正确 (`npm run format`)
- [ ] 测试通过 (如果有)
- [ ] 提交信息清晰有意义
- [ ] 没有删除他人的代码注释或文档
- [ ] 敏感信息 (密钥、密码) 不在代码中

## 测试规范

### 单元测试

```typescript
describe('UserService', () => {
  describe('getUserById', () => {
    it('should return user when exists', async () => {
      const userId = 'user-123'
      const expected = { id: userId, name: 'John' }

      const result = await service.getUserById(userId)

      expect(result).toEqual(expected)
    })

    it('should return null when user not found', async () => {
      const result = await service.getUserById('non-existent')

      expect(result).toBeNull()
    })
  })
})
```

### 集成测试

- 使用真实数据库 (不使用 mock)
- 测试完整的请求-响应流程
- 清理测试数据

## 性能注意事项

1. **数据库查询**
   - 避免 N+1 查询问题
   - 使用 Prisma `include` 或 `select` 进行关联查询优化
   - 为频繁查询的字段添加索引

2. **前端优化**
   - 使用 `React.memo` 避免不必要的重新渲染
   - 使用 `useCallback` 稳定函数引用
   - 实现虚拟滚动处理大列表

3. **API 优化**
   - 实现分页
   - 使用 gzip 压缩
   - 添加缓存 headers

## 文档要求

每个主要功能都应有：

1. **代码注释** (仅复杂逻辑)
   ```typescript
   // 计算一周的学习统计，排除周末
   const weeklyStats = calculateWeeklyStats(records, {
     excludeWeekends: true,
     timezone: 'Asia/Shanghai',
   })
   ```

2. **函数文档** (JSDoc)
   ```typescript
   /**
    * 计算用户的学习健康分数
    * @param userId - 用户ID
    * @param period - 统计周期 ('day' | 'week' | 'month')
    * @returns 健康分数 (0-100)
    */
   function calculateHealthScore(userId: string, period: string): number {
     // ...
   }
   ```

3. **API 文档**
   - 在 NestJS 中使用 `@ApiOperation`, `@ApiResponse` 装饰器
   - 或在 README 中手动记录

## 常见问题

**Q: 应该在哪里放置共享函数？**
A: 在 `lib/` 或 `common/utils/` 目录中，按功能分类。

**Q: 如何管理全局状态？**
A: 使用 Zustand store，按模块分离，文件放在 `store/` 目录。

**Q: 如何处理 API 错误？**
A: 定义统一的错误处理中间件，返回标准错误格式。

**Q: 依赖版本如何更新？**
A: 使用 `npm outdated` 检查，谨慎更新 major 版本，在 feature 分支上测试。

## 相关资源

- [TypeScript 最佳实践](https://www.typescriptlang.org/docs/handbook/)
- [React 官方文档](https://react.dev/)
- [NestJS 文档](https://docs.nestjs.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## 需要帮助？

如有问题，请：
1. 查看 [FAQ](./docs/faq.md)
2. 查看现有的代码示例
3. 提交 Issue 讨论

---

最后更新: 2026-04-08
