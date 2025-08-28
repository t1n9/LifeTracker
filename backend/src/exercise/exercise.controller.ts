import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Req 
} from '@nestjs/common';
import { IsString, IsNumber, IsEnum, IsOptional, IsIn, Min, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExerciseService } from './exercise.service';

// 定义枚举常量，避免运行时undefined问题
const ExerciseTypeEnum = {
  COUNT: 'COUNT',
  DISTANCE: 'DISTANCE'
} as const;

type ExerciseTypeEnum = typeof ExerciseTypeEnum[keyof typeof ExerciseTypeEnum];

export class CreateExerciseTypeDto {
  @IsString()
  name: string;

  @IsEnum(ExerciseTypeEnum)
  type: ExerciseTypeEnum;

  @IsString()
  unit: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  increment?: number;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateExerciseTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ExerciseTypeEnum)
  type?: ExerciseTypeEnum;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  increment?: number;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class AddExerciseRecordDto {
  @IsString()
  exerciseId: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetExerciseValueDto {
  @IsString()
  exerciseId: string;

  @IsNumber()
  @Min(0)
  totalValue: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetExerciseFeelingDto {
  @IsString()
  @IsIn(['excellent', 'good', 'normal', 'tired'])
  feeling: string;
}

@Controller('exercise')
@UseGuards(JwtAuthGuard)
export class ExerciseController {
  constructor(private readonly exerciseService: ExerciseService) {}

  // 获取运动类型
  @Get('types')
  async getExerciseTypes(@Req() req: any, @Query('includeInactive') includeInactive?: string) {
    const userId = req.user.id;

    // 首次访问时初始化默认运动类型
    await this.exerciseService.initializeDefaultExerciseTypes(userId);

    // 解析查询参数
    const shouldIncludeInactive = includeInactive === 'true';

    const types = await this.exerciseService.getExerciseTypes(userId, shouldIncludeInactive);
    return { data: types };
  }

  // 创建运动类型
  @Post('types')
  async createExerciseType(@Body() createDto: CreateExerciseTypeDto, @Req() req: any) {
    const userId = req.user.id;
    const exerciseType = await this.exerciseService.createExerciseType(userId, createDto);
    return { 
      data: exerciseType,
      message: '运动类型创建成功'
    };
  }

  // 更新运动类型
  @Put('types/:id')
  async updateExerciseType(
    @Param('id') exerciseId: string,
    @Body() updateDto: UpdateExerciseTypeDto,
    @Req() req: any
  ) {
    const userId = req.user.id;
    const exerciseType = await this.exerciseService.updateExerciseType(userId, exerciseId, updateDto);
    return { 
      data: exerciseType,
      message: '运动类型更新成功'
    };
  }

  // 删除运动类型
  @Delete('types/:id')
  async deleteExerciseType(@Param('id') exerciseId: string, @Req() req: any) {
    const userId = req.user.id;
    await this.exerciseService.deleteExerciseType(userId, exerciseId);
    return { message: '运动类型删除成功' };
  }

  // 获取今日运动记录
  @Get('today')
  async getTodayRecords(@Req() req: any) {
    const userId = req.user.id;
    const timezone = req.user.timezone || 'Asia/Shanghai';
    const records = await this.exerciseService.getTodayRecords(userId, timezone);
    return { data: records };
  }

  // 添加运动记录
  @Post('records')
  async addExerciseRecord(@Body() addDto: AddExerciseRecordDto, @Req() req: any) {
    const userId = req.user.id;
    const timezone = req.user.timezone || 'Asia/Shanghai';
    const record = await this.exerciseService.addExerciseRecord(userId, addDto, timezone);
    return {
      data: record,
      message: '运动记录添加成功'
    };
  }

  // 设置今日运动总值
  @Put('records/today')
  async setTodayExerciseValue(@Body() setDto: SetExerciseValueDto, @Req() req: any) {
    const userId = req.user.id;
    const timezone = req.user.timezone || 'Asia/Shanghai';
    const record = await this.exerciseService.setTodayExerciseValue(userId, setDto, timezone);
    return {
      data: record,
      message: record ? '运动记录更新成功' : '无变化'
    };
  }

  // 设置今日运动感受
  @Put('feeling')
  async setTodayExerciseFeeling(@Body() feelingDto: SetExerciseFeelingDto, @Req() req: any) {
    const userId = req.user.id;
    const timezone = req.user.timezone || 'Asia/Shanghai';
    const dailyData = await this.exerciseService.setTodayExerciseFeeling(userId, feelingDto.feeling, timezone);
    return {
      data: dailyData,
      message: '运动感受设置成功'
    };
  }

  // 获取今日运动感受
  @Get('feeling')
  async getTodayExerciseFeeling(@Req() req: any) {
    const userId = req.user.id;
    const timezone = req.user.timezone || 'Asia/Shanghai';
    const feeling = await this.exerciseService.getTodayExerciseFeeling(userId, timezone);
    return { data: { feeling } };
  }

  // 获取运动统计
  @Get('stats')
  async getExerciseStats(@Query('days') days: string, @Req() req: any) {
    const userId = req.user.id;
    const dayCount = days ? parseInt(days) : 7;
    const stats = await this.exerciseService.getExerciseStats(userId, dayCount);
    return { data: stats };
  }
}
