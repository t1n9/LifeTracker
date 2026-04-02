import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export interface AnalysisQuery {
  queryType: 'time-range' | 'goal-based' | 'subject-based';
  period?: 'day' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
  goalId?: string;
}

export interface StudyAnalysisResponse {
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

export interface AnalysisHistoryItem {
  id: string;
  queryType: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  result: StudyAnalysisResponse;
}

export const useStudyAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (query: AnalysisQuery): Promise<StudyAnalysisResponse | null> => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post<StudyAnalysisResponse>('/study/analysis', query);
      return response.data;
    } catch (err) {
      const errorMessage = (err as any)?.response?.data?.message || '分析失败，请重试';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getHistory = useCallback(async (limit = 20): Promise<AnalysisHistoryItem[] | null> => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<AnalysisHistoryItem[]>(`/study/analysis/history?limit=${limit}`);
      return response.data;
    } catch (err) {
      const errorMessage = (err as any)?.response?.data?.message || '获取历史记录失败';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteQuery = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await api.delete(`/study/analysis/${id}`);
      return true;
    } catch (err) {
      const errorMessage = (err as any)?.response?.data?.message || '删除失败';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    analyze,
    getHistory,
    deleteQuery,
    loading,
    error,
  };
};
