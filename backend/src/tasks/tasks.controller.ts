import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('任务')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: '创建任务' })
  create(@Request() req, @Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(req.user.id, createTaskDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有任务' })
  findAll(@Request() req) {
    return this.tasksService.findAll(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取任务统计' })
  getStats(@Request() req) {
    return this.tasksService.getTaskStats(req.user.id);
  }

  @Get('today')
  @ApiOperation({ summary: '获取今日任务' })
  getTodayTasks(@Request() req) {
    return this.tasksService.getTodayTasks(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个任务' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.tasksService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新任务' })
  update(@Request() req, @Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.update(req.user.id, id, updateTaskDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除任务' })
  remove(@Request() req, @Param('id') id: string) {
    return this.tasksService.remove(req.user.id, id);
  }
}
