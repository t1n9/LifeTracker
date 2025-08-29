import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as compression from 'compression';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  // 设置时区为北京时间
  process.env.TZ = 'Asia/Shanghai';

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 安全中间件
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // CORS配置 - 支持多个域名
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://t1n9.xyz',
    'https://www.t1n9.xyz'
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // 允许没有origin的请求（如移动应用、Postman等）
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // 放宽非白名单字段为剔除而不是报错，避免前端偶发携带多余字段导致400
      forbidNonWhitelisted: false,
      transform: true,
      // 允许将字符串隐式转换为number/boolean，避免生产环境类型严格导致400
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 静态文件服务
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
  });

  // 处理favicon.ico请求
  app.use('/favicon.ico', (req, res) => {
    res.status(204).end();
  });

  // API前缀
  app.setGlobalPrefix('api');

  // Swagger文档配置
  const config = new DocumentBuilder()
    .setTitle('LifeTracker API')
    .setDescription('LifeTracker应用的后端API文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3002;
  await app.listen(port);
  
  // 应用已启动，可通过 /api/docs 查看文档
}

bootstrap();
