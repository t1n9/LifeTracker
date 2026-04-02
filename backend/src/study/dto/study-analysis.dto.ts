import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnalysisQueryDto {
  @ApiProperty({ description: '分析类型', enum: ['time-range', 'goal-based', 'subject-based'] })
  @IsEnum(['time-range', 'goal-based', 'subject-based'])
  queryType: string;

  @ApiProperty({
    description: '时间周期',
    enum: ['day', 'week', 'month', 'custom'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'custom'])
  period?: string;

  @ApiProperty({
    description: '开始日期 (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: '结束日期 (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: '目标ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  goalId?: string;
}

export class StudyAnalysisResponse {
  summary: {
    totalMinutes: number;
    totalSessions: number;
    averageSessionDuration: number;
    consistencyScore: number;
  };

  bySubject: Array<{
    subject: string;
    minutes: number;
    percentage: number;
    sessionCount: number;
  }>;

  dailyBreakdown: Array<{
    date: string;
    minutes: number;
    sessions: number;
  }>;

  healthScore: {
    score: number;
    factors: {
      consistency: number;
      duration: number;
      variety: number;
      efficiency: number;
    };
  };

  insights?: string[];
  recommendations?: string[];
}

export class AnalysisQueryHistoryResponse {
  id: string;
  queryType: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  result: StudyAnalysisResponse;
}
