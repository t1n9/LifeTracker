import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('应用')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '获取应用信息' })
  getAppInfo() {
    return this.appService.getAppInfo();
  }

  @Get('health')
  @ApiOperation({ summary: '健康检查' })
  getHealth() {
    return this.appService.getHealth();
  }
}
