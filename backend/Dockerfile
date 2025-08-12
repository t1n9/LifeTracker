# 使用Node.js 18作为基础镜像
FROM registry.cn-hangzhou.aliyuncs.com/library/node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 生成Prisma客户端
RUN npx prisma generate

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3002

# 启动应用
CMD ["npm", "run", "start:prod"]
