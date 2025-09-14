import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuggestionsService } from './suggestions.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { UpdateSuggestionDto } from './dto/update-suggestion.dto';

@ApiTags('系统建议')
@Controller('suggestions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Post()
  @ApiOperation({ summary: '提交建议' })
  create(@Request() req, @Body() createSuggestionDto: CreateSuggestionDto) {
    return this.suggestionsService.create(req.user.id, createSuggestionDto);
  }

  @Get()
  @ApiOperation({ summary: '获取建议列表' })
  @ApiQuery({ name: 'all', required: false, description: '管理员查看所有建议' })
  findAll(@Request() req, @Query('all') all?: string) {
    const isAdmin = req.user.isAdmin;
    const showAll = isAdmin && all === 'true';
    return this.suggestionsService.findAll(showAll ? undefined : req.user.id, isAdmin);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取建议统计（管理员）' })
  getStats(@Request() req) {
    if (!req.user.isAdmin) {
      throw new Error('需要管理员权限');
    }
    return this.suggestionsService.getStats();
  }

  @Get('export')
  @ApiOperation({ summary: '导出所有建议（管理员）' })
  exportAllSuggestions(@Request() req) {
    if (!req.user.isAdmin) {
      throw new Error('需要管理员权限');
    }
    return this.suggestionsService.exportAllSuggestions();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个建议' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.suggestionsService.findOne(id, req.user.id, req.user.isAdmin);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新建议（管理员）' })
  update(@Request() req, @Param('id') id: string, @Body() updateSuggestionDto: UpdateSuggestionDto) {
    if (!req.user.isAdmin) {
      throw new Error('需要管理员权限');
    }
    return this.suggestionsService.update(id, updateSuggestionDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除建议' })
  remove(@Request() req, @Param('id') id: string) {
    return this.suggestionsService.remove(id, req.user.id, req.user.isAdmin);
  }
}
