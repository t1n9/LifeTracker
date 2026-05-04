import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { StudyPlanReferenceService } from '../study-plan/study-plan-reference.service';
import {
  UpdateUserRoleDto,
  BanUserDto,
  UpdateSubscriptionDto,
  ListUsersQueryDto,
} from './dto/admin.dto';

@ApiTags('管理后台')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly refService: StudyPlanReferenceService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: '用户列表（分页/搜索/筛选）' })
  async listUsers(@Query() query: ListUsersQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    return this.adminService.listUsers({
      page,
      limit,
      search: query.search,
      role: query.role,
      status: query.status,
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: '用户详情（含订阅、统计、审计日志）' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: '修改用户角色' })
  async updateUserRole(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(req.user.id, id, dto);
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: '封禁用户' })
  async banUser(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: BanUserDto,
  ) {
    return this.adminService.banUser(req.user.id, id, dto);
  }

  @Post('users/:id/unban')
  @ApiOperation({ summary: '解封用户' })
  async unbanUser(@Request() req, @Param('id') id: string) {
    return this.adminService.unbanUser(req.user.id, id);
  }

  @Patch('users/:id/subscription')
  @ApiOperation({ summary: '修改用户订阅' })
  async updateSubscription(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.adminService.updateSubscription(req.user.id, id, dto);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: '审计日志列表' })
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('adminId') adminId?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10));
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    return this.adminService.getAuditLogs({ page: p, limit: l, adminId });
  }

  // ─── 计划参考管理 ────────────────────────────────────────────

  @Get('plan-references')
  @ApiOperation({ summary: '所有计划参考' })
  listRefs() {
    return this.refService.listAll();
  }

  @Post('plan-references/fetch-title')
  @ApiOperation({ summary: '抓取 URL 标题' })
  fetchTitle(@Body('url') url: string) {
    return this.refService.fetchTitleForUrl(url);
  }

  @Post('plan-references')
  @ApiOperation({ summary: '新建计划参考' })
  createRef(@Body() dto: any) {
    return this.refService.create(dto);
  }

  @Patch('plan-references/:id')
  @ApiOperation({ summary: '更新计划参考' })
  updateRef(@Param('id') id: string, @Body() dto: any) {
    return this.refService.update(id, dto);
  }

  @Patch('plan-references/:id/active')
  @ApiOperation({ summary: '启用/停用计划参考' })
  setRefActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.refService.setActive(id, isActive);
  }

  @Delete('plan-references/:id')
  @ApiOperation({ summary: '删除计划参考' })
  deleteRef(@Param('id') id: string) {
    return this.refService.delete(id);
  }
}
