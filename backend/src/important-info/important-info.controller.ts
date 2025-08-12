import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImportantInfoService } from './important-info.service';

export class UpdateImportantInfoDto {
  @IsString()
  content: string;
}

@Controller('important-info')
@UseGuards(JwtAuthGuard)
export class ImportantInfoController {
  constructor(private readonly importantInfoService: ImportantInfoService) {}

  @Get()
  async getCurrentInfo(@Req() req: any) {
    const userId = req.user.id;
    const info = await this.importantInfoService.getCurrentInfo(userId);
    return { data: info };
  }

  @Put()
  async updateInfo(@Body() updateDto: UpdateImportantInfoDto, @Req() req: any) {
    const userId = req.user.id;
    const { content } = updateDto;

    const result = await this.importantInfoService.updateInfo(userId, content);
    return {
      data: result,
      message: result.updated ? '重要信息已更新' : '内容未发生变化'
    };
  }

  @Get('history/count')
  async getHistoryCount(@Req() req: any) {
    const userId = req.user.id;
    const count = await this.importantInfoService.getHistoryCount(userId);
    return { data: { count } };
  }
}
