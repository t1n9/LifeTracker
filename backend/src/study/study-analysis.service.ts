import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisQueryDto, StudyAnalysisResponse } from './dto/study-analysis.dto';
import axios from 'axios';

@Injectable()
export class StudyAnalysisService {
  constructor(private prisma: PrismaService) {}

  private getDateRange(period?: string, startDate?: string, endDate?: string) {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (period) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        end = new Date(start);
        end.setDate(end.getDate() + 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'custom':
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), 0, 1);
        end = endDate ? new Date(endDate) : now;
        end.setDate(end.getDate() + 1);
        break;
      default:
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 32);
    }

    return { start, end };
  }

  async analyzeStudyRecords(
    userId: string,
    query: AnalysisQueryDto,
  ): Promise<StudyAnalysisResponse> {
    const { start, end } = this.getDateRange(query.period, query.startDate, query.endDate);

    // 获取分析时间范围内的所有学习记录
    const records = await this.prisma.studyRecord.findMany({
      where: {
        userId,
        startedAt: {
          gte: start,
          lt: end,
        },
      },
      include: {
        task: {
          select: {
            subject: true,
          },
        },
      },
    });

    // 计算总体统计
    const totalMinutes = records.reduce((sum, r) => sum + r.duration, 0);
    const totalSessions = records.length;
    const avgSessionDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

    // 按学科分组
    const subjectMap = new Map<string, { minutes: number; count: number }>();
    records.forEach((record) => {
      const subject = record.subject || record.task?.subject || '其他';
      const current = subjectMap.get(subject) || { minutes: 0, count: 0 };
      current.minutes += record.duration;
      current.count += 1;
      subjectMap.set(subject, current);
    });

    const bySubject = Array.from(subjectMap.entries())
      .map(([subject, { minutes, count }]) => ({
        subject,
        minutes,
        percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0,
        sessionCount: count,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    // 计算每日分解
    const dailyMap = new Map<string, { minutes: number; sessions: number }>();
    records.forEach((record) => {
      const dateStr = record.startedAt.toISOString().split('T')[0];
      const current = dailyMap.get(dateStr) || { minutes: 0, sessions: 0 };
      current.minutes += record.duration;
      current.sessions += 1;
      dailyMap.set(dateStr, current);
    });

    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, { minutes, sessions }]) => ({
        date,
        minutes,
        sessions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 计算健康分数
    const healthScore = this.calculateHealthScore(
      totalMinutes,
      totalSessions,
      dailyBreakdown,
      subjectMap,
    );

    // 计算坚持度分数
    const consistencyScore = this.calculateConsistencyScore(dailyBreakdown);

    // 生成基础洞察
    const basicInsights = this.generateInsights(totalMinutes, totalSessions, bySubject, healthScore);

    // 生成基础建议
    const basicRecommendations = this.generateRecommendations(
      avgSessionDuration,
      bySubject,
      healthScore,
    );

    // 尝试获取AI增强的见解
    let enhancedInsights = basicInsights;
    let enhancedRecommendations = basicRecommendations;

    try {
      const aiEnhancement = await this.getAIEnhancedInsights({
        totalMinutes,
        totalSessions,
        avgSessionDuration,
        healthScore,
        bySubject,
        consistency: consistencyScore,
        basicInsights,
      });

      if (aiEnhancement) {
        enhancedInsights = aiEnhancement.insights || basicInsights;
        enhancedRecommendations = aiEnhancement.recommendations || basicRecommendations;
      }
    } catch (error) {
      // 如果AI调用失败，使用基础见解
      // 不打印错误日志，静默降级
    }

    return {
      summary: {
        totalMinutes,
        totalSessions,
        averageSessionDuration: avgSessionDuration,
        consistencyScore,
      },
      bySubject,
      dailyBreakdown,
      healthScore,
      insights: enhancedInsights,
      recommendations: enhancedRecommendations,
    };
  }

  private calculateHealthScore(
    totalMinutes: number,
    totalSessions: number,
    dailyBreakdown: Array<{ date: string; minutes: number; sessions: number }>,
    subjectMap: Map<string, { minutes: number; count: number }>,
  ) {
    const consistencyScore = this.calculateConsistencyScore(dailyBreakdown);
    const durationScore = Math.min(100, Math.round((totalMinutes / 6000) * 100)); // 100小时为满分
    const varietyScore = Math.min(100, subjectMap.size * 20); // 每个学科20分，最多100
    const efficiencyScore = totalSessions > 0 ? Math.round((totalMinutes / totalSessions / 60) * 100) : 0; // 每个会话60分钟为满分

    const score = Math.round(
      (consistencyScore * 0.25 + durationScore * 0.25 + varietyScore * 0.25 + efficiencyScore * 0.25) /
        100,
    );

    return {
      score: Math.min(100, score),
      factors: {
        consistency: consistencyScore,
        duration: durationScore,
        variety: varietyScore,
        efficiency: efficiencyScore,
      },
    };
  }

  private calculateConsistencyScore(
    dailyBreakdown: Array<{ date: string; minutes: number; sessions: number }>,
  ): number {
    if (dailyBreakdown.length === 0) return 0;

    // 计算有学习记录的天数比例
    const uniqueDays = new Set(dailyBreakdown.map((d) => d.date)).size;
    const dateRange = dailyBreakdown.length > 0
      ? new Date(dailyBreakdown[dailyBreakdown.length - 1].date).getTime() -
        new Date(dailyBreakdown[0].date).getTime()
      : 1;
    const daysDiff = Math.ceil(dateRange / (1000 * 60 * 60 * 24)) + 1;

    return Math.round((uniqueDays / daysDiff) * 100);
  }

  private generateInsights(
    totalMinutes: number,
    totalSessions: number,
    bySubject: Array<{ subject: string; minutes: number; percentage: number }>,
    healthScore: any,
  ): string[] {
    const insights: string[] = [];

    if (totalMinutes === 0) {
      insights.push('还没有学习记录');
      return insights;
    }

    insights.push(`总共学习 ${Math.round(totalMinutes / 60)} 小时 ${totalMinutes % 60} 分钟`);

    if (totalSessions > 0) {
      const avgDuration = Math.round(totalMinutes / totalSessions);
      insights.push(`平均每次学习 ${avgDuration} 分钟`);
    }

    if (bySubject.length > 0) {
      const topSubject = bySubject[0];
      insights.push(`主要学习科目是 ${topSubject.subject}，占比 ${topSubject.percentage}%`);
    }

    if (healthScore.factors.consistency > 80) {
      insights.push('学习坚持度很好！保持这个节奏');
    } else if (healthScore.factors.consistency > 50) {
      insights.push('学习坚持度还可以，建议养成更规律的学习习惯');
    } else {
      insights.push('学习记录不够规律，建议制定更稳定的学习计划');
    }

    return insights;
  }

  private generateRecommendations(
    avgSessionDuration: number,
    bySubject: Array<{ subject: string; minutes: number; percentage: number }>,
    healthScore: any,
  ): string[] {
    const recommendations: string[] = [];

    if (avgSessionDuration < 25) {
      recommendations.push('建议每次学习保持在 25 分钟以上，可以提高学习效率');
    } else if (avgSessionDuration > 120) {
      recommendations.push('单次学习时间过长，建议分段学习，每次 25-50 分钟效果更佳');
    }

    if (bySubject.length > 0 && bySubject[0].percentage > 70) {
      recommendations.push('学习科目过于单一，建议均衡各科学习');
    }

    if (healthScore.factors.consistency < 60) {
      recommendations.push('建议设置学习提醒，每天都安排固定学习时间');
    }

    if (healthScore.factors.duration < 50) {
      recommendations.push('每日学习时间还不够，建议增加学习时长');
    }

    return recommendations;
  }

  async saveAnalysisQuery(userId: string, query: AnalysisQueryDto, result: StudyAnalysisResponse) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.prisma.studyAnalysisQuery.create({
      data: {
        userId,
        queryType: query.queryType,
        period: query.period,
        startDate,
        endDate,
        goalId: query.goalId,
        result: JSON.parse(JSON.stringify(result)) as any,
      },
    });
  }

  async getAnalysisHistory(userId: string, limit = 20) {
    return this.prisma.studyAnalysisQuery.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async deleteAnalysisQuery(userId: string, queryId: string) {
    const query = await this.prisma.studyAnalysisQuery.findFirst({
      where: {
        id: queryId,
        userId,
      },
    });

    if (!query) {
      throw new Error('分析记录不存在');
    }

    return this.prisma.studyAnalysisQuery.delete({
      where: { id: queryId },
    });
  }

  private async getAIEnhancedInsights(analysisData: {
    totalMinutes: number;
    totalSessions: number;
    avgSessionDuration: number;
    healthScore: any;
    bySubject: any[];
    consistency: number;
    basicInsights: string[];
  }) {
    const prompt = `基于以下学习数据，生成更深入的学习洞察和改进建议。

学习数据：
- 总学习时长：${Math.floor(analysisData.totalMinutes / 60)}小时${analysisData.totalMinutes % 60}分钟
- 学习次数：${analysisData.totalSessions}次
- 平均每次学习时长：${analysisData.avgSessionDuration}分钟
- 学习健康分数：${analysisData.healthScore.score}分
- 坚持度：${analysisData.consistency}%
- 学习效率分数：${analysisData.healthScore.factors.efficiency}%
- 主要学科：${analysisData.bySubject.length > 0 ? analysisData.bySubject[0].subject : '未知'}

请生成3-4条深入的学习洞察和3-4条具体的改进建议。
格式：每条洞察和建议单独成行。
`;

    try {
      const response = await axios.post(
        'https://llmapi.blsc.cn/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        },
        {
          headers: {
            'Authorization': `Bearer sk-tbxuh_Ubr2fFl8-pdayQSQ`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const content = response.data.choices?.[0]?.message?.content || '';
      const lines = content.split('\n').filter((line) => line.trim());

      // 分离洞察和建议
      const insights: string[] = [];
      const recommendations: string[] = [];
      let isRecommendation = false;

      for (const line of lines) {
        const cleanLine = line.replace(/^[\d•\-*]\s*/, '').trim();
        if (!cleanLine) continue;

        if (cleanLine.includes('建议') || isRecommendation) {
          isRecommendation = true;
          recommendations.push(cleanLine);
        } else {
          insights.push(cleanLine);
        }
      }

      return {
        insights: insights.length > 0 ? insights : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
      };
    } catch (error) {
      // 静默失败，返回undefined以使用基础见解
      return null;
    }
  }
}
