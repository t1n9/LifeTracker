import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HistoryService } from './history.service';

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('dates')
  async getAvailableDates(@Req() req: any) {
    const userId = req.user.id;
    const dates = await this.historyService.getAvailableDates(userId);
    return { dates };
  }

  @Get('day/:date')
  async getDayData(@Param('date') date: string, @Req() req: any) {
    const userId = req.user.id;
    const data = await this.historyService.getDayData(userId, date);
    
    if (!data) {
      return { data: null };
    }
    
    return { data };
  }
}
