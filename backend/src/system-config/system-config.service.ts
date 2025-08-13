import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

  // 获取配置值
  async getConfig(key: string): Promise<string | null> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });
    return config?.value || null;
  }

  // 获取布尔类型配置
  async getBooleanConfig(key: string, defaultValue: boolean = false): Promise<boolean> {
    const value = await this.getConfig(key);
    if (value === null) return defaultValue;
    return value === 'true';
  }

  // 设置配置值
  async setConfig(key: string, value: string, description?: string, isPublic: boolean = false): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value, description, isPublic },
      create: { key, value, description, isPublic },
    });
  }

  // 获取所有公开配置
  async getPublicConfigs(): Promise<Record<string, string>> {
    const configs = await this.prisma.systemConfig.findMany({
      where: { isPublic: true },
      select: { key: true, value: true },
    });
    
    return configs.reduce((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {} as Record<string, string>);
  }

  // 获取所有配置（管理员用）
  async getAllConfigs() {
    return this.prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });
  }

  // 删除配置
  async deleteConfig(key: string): Promise<void> {
    await this.prisma.systemConfig.delete({
      where: { key },
    });
  }

  // 初始化默认配置
  async initializeDefaultConfigs(): Promise<void> {
    const defaultConfigs = [
      {
        key: 'registration_enabled',
        value: 'false',
        description: '是否允许用户注册',
        isPublic: true,
      },
      {
        key: 'site_name',
        value: 'LifeTracker',
        description: '网站名称',
        isPublic: true,
      },
      {
        key: 'site_description',
        value: '生活记录系统',
        description: '网站描述',
        isPublic: true,
      },
    ];

    for (const config of defaultConfigs) {
      const existing = await this.prisma.systemConfig.findUnique({
        where: { key: config.key },
      });
      
      if (!existing) {
        await this.prisma.systemConfig.create({
          data: config,
        });
      }
    }
  }

  // 检查注册是否开启
  async isRegistrationEnabled(): Promise<boolean> {
    return this.getBooleanConfig('registration_enabled', false);
  }
}
