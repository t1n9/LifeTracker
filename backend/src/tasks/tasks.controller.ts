import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class TaskOrderDto {
  @IsString()
  id: string;

  @IsNumber()
  sortOrder: number;
}

class UpdateTasksOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskOrderDto)
  tasks: TaskOrderDto[];
}

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
    const timezone = req.user.timezone || 'Asia/Shanghai';
    return this.tasksService.getTodayTasks(req.user.id, timezone);
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

  @Put('order')
  @ApiOperation({ summary: '批量更新任务排序' })
  updateTasksOrder(@Request() req, @Body() updateTasksOrderDto: UpdateTasksOrderDto) {
    return this.tasksService.updateTasksOrder(req.user.id, updateTasksOrderDto.tasks);
  }
}
