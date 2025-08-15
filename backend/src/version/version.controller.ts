import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VERSION_INFO, getVersionString, getFullVersionInfo } from '../common/version';

@ApiTags('系统信息')
@Controller('version')
export class VersionController {
  @Get()
  @ApiOperation({ summary: '获取系统版本信息' })
  getVersion() {
    return {
      version: VERSION_INFO.version,
      name: VERSION_INFO.name,
      description: VERSION_INFO.description,
      buildDate: VERSION_INFO.buildDate,
      features: VERSION_INFO.features,
      versionString: getVersionString(),
      fullInfo: getFullVersionInfo(),
    };
  }

  @Get('simple')
  @ApiOperation({ summary: '获取简单版本号' })
  getSimpleVersion() {
    return {
      version: VERSION_INFO.version,
      versionString: getVersionString(),
    };
  }
}
