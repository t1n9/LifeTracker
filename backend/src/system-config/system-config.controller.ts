import { Controller, Get, Put, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemConfigService } from './system-config.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';

@ApiTags('系统配置')
@Controller('system-config')
export class SystemConfigController {
  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly usersService: UsersService,
  ) {}

  @Get('public')
  @ApiOperation({ summary: '获取公开配置' })
  async getPublicConfigs() {
    return this.systemConfigService.getPublicConfigs();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取所有配置（管理员）' })
  async getAllConfigs(@Request() req) {
    const user = await this.usersService.findById(req.user.id);
    if (!user.isAdmin) {
      throw new ForbiddenException('需要管理员权限');
    }
    return this.systemConfigService.getAllConfigs();
  }

  @Put(':key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新配置（管理员）' })
  async updateConfig(
    @Param('key') key: string,
    @Body() updateConfigDto: UpdateConfigDto,
    @Request() req,
  ) {
    const user = await this.usersService.findById(req.user.id);
    if (!user.isAdmin) {
      throw new ForbiddenException('需要管理员权限');
    }

    await this.systemConfigService.setConfig(
      key,
      updateConfigDto.value,
      updateConfigDto.description,
      updateConfigDto.isPublic,
    );

    return { message: '配置更新成功' };
  }
}
