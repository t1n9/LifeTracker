import { Controller, Post, Get, UseGuards, Req, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MigrationService } from './migration.service';

@Controller('migration')
@UseGuards(JwtAuthGuard)
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  // 检查迁移状态
  @Get('status')
  async getMigrationStatus() {
    const isCompleted = await this.migrationService.checkMigrationStatus();
    return {
      data: { isCompleted },
      message: isCompleted ? '迁移已完成' : '迁移未执行'
    };
  }

  // 清空现有记录（仅当前用户）
  @Post('clear-records')
  async clearRecords(@Req() req: any) {
    const userId = req.user.id;
    const result = await this.migrationService.clearExistingRecords(userId);
    return {
      data: result,
      message: `已清空 ${result.deletedExerciseRecords} 条运动记录和 ${result.deletedExpenseRecords} 条消费记录`
    };
  }

  // 执行数据迁移（仅当前用户）
  @Post('migrate-daily-data')
  async migrateDailyData(@Req() req: any) {
    const userId = req.user.id;
    const result = await this.migrationService.migrateDailyDataToRecords(userId);
    return {
      data: result,
      message: result.message
    };
  }

  // 完整迁移流程（清空 + 迁移）
  @Post('full-migration')
  async fullMigration(@Req() req: any) {
    const userId = req.user.id;
    
    // 先清空现有记录
    const clearResult = await this.migrationService.clearExistingRecords(userId);
    
    // 再执行迁移
    const migrateResult = await this.migrationService.migrateDailyDataToRecords(userId);
    
    return {
      data: {
        cleared: clearResult,
        migrated: migrateResult
      },
      message: `迁移完成：清空了 ${clearResult.deletedExerciseRecords + clearResult.deletedExpenseRecords} 条记录，迁移了 ${migrateResult.migratedExpenseCount + migrateResult.migratedExerciseCount} 条新记录`
    };
  }
}
