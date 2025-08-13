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
import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExpenseService } from './expense.service';

export class SetMealExpenseDto {
  @IsEnum(['breakfast', 'lunch', 'dinner'])
  category: 'breakfast' | 'lunch' | 'dinner';

  @IsNumber()
  @Min(0)
  amount: number;
}

export class AddOtherExpenseDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller('expense')
@UseGuards(JwtAuthGuard)
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  // 获取今日消费记录
  @Get('today')
  async getTodayExpenses(@Req() req: any) {
    const userId = req.user.id;
    const expenses = await this.expenseService.getTodayExpenses(userId);
    return { data: expenses };
  }

  // 设置今日餐饮消费
  @Put('meals')
  async setTodayMealExpense(@Body() setDto: SetMealExpenseDto, @Req() req: any) {
    const userId = req.user.id;
    const record = await this.expenseService.setTodayMealExpense(userId, setDto);
    return { 
      data: record,
      message: record ? '餐饮消费更新成功' : '无变化'
    };
  }

  // 添加其他消费记录
  @Post('others')
  async addOtherExpense(@Body() addDto: AddOtherExpenseDto, @Req() req: any) {
    const userId = req.user.id;
    const record = await this.expenseService.addOtherExpense(userId, addDto);
    return { 
      data: record,
      message: '消费记录添加成功'
    };
  }

  // 删除其他消费记录
  @Delete('others/:id')
  async deleteOtherExpense(@Param('id') expenseId: string, @Req() req: any) {
    const userId = req.user.id;
    await this.expenseService.deleteOtherExpense(userId, expenseId);
    return { message: '消费记录删除成功' };
  }

  // 获取消费统计
  @Get('stats')
  async getExpenseStats(@Query('days') days: string, @Req() req: any) {
    const userId = req.user.id;
    const dayCount = days ? parseInt(days) : 7;
    const stats = await this.expenseService.getExpenseStats(userId, dayCount);
    return { data: stats };
  }

  // 清理重复记录
  @Post('cleanup-duplicates')
  async cleanupDuplicates(@Req() req: any) {
    const userId = req.user.id;
    const result = await this.expenseService.cleanupDuplicateMealRecords(userId);
    return {
      data: result,
      message: `已清理${result.deletedCount}条重复记录`
    };
  }
}
