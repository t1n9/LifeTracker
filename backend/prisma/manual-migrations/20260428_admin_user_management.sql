-- 管理员用户管理系统 - 数据回填
-- 运行时机：prisma db push 之后（role 字段已存在，默认值为 USER）
-- 幂等：使用 WHERE 条件确保不会重复修改

-- 1. 将现有管理员标记为 ADMIN 角色
UPDATE users
SET role = 'ADMIN'
WHERE is_admin = true
  AND role = 'USER';

-- 2. 将付费订阅用户标记为 MEMBER 角色（非管理员）
UPDATE users
SET role = 'MEMBER'
WHERE id IN (
  SELECT us.user_id
  FROM user_subscriptions us
  WHERE us.plan != 'free'
    AND us.status = 'active'
)
  AND is_admin = false
  AND role = 'USER';

-- 3. 确保所有管理员在用户列表查询中仍可通过 is_admin 找到
-- （is_admin 字段保留，后续版本清理）

-- 4. 将现有用户标记为邮箱已验证（注册时必须通过验证码才能创建）
UPDATE users
SET email_verified = true
WHERE email_verified = false;
