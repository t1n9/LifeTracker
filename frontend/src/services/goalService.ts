import { api } from '../lib/api';

export interface UserGoal {
  id: string;
  userId: string;
  goalName: string;
  targetDate?: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  status: 'ACTIVE' | 'COMPLETED' | 'TERMINATED';
  createdAt: string;
  updatedAt: string;
}

export interface GoalOverview {
  period: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  tasks: {
    total: number;
    completed: number;
    completionRate: number;
  };
  study: {
    totalMinutes: number;
    totalHours: number;
    averageMinutesPerDay: number;
    pomodoroCount: number;
    averagePomodoroPerDay: number;
  };
  exercise: {
    totalRecords: number;
    exerciseTypes: Array<{
      name: string;
      total: number;
      unit: string;
    }>;
  };
  expense: {
    total: number;
    averagePerDay: number;
    recordCount: number;
  };
}

export interface StartGoalData {
  goalName: string;
  targetDate?: string;
  description?: string;
}

export interface UpdateGoalData {
  goalName?: string;
  targetDate?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

class GoalService {
  // 获取当前活跃目标
  async getCurrentGoal(): Promise<UserGoal | null> {
    try {
      const response = await api.get('/goals/current');
      const goal = response.data.data;
      return goal;
    } catch (error) {
      console.error('获取当前目标失败:', error);
      throw error;
    }
  }

  // 获取目标历史
  async getGoalHistory(): Promise<UserGoal[]> {
    try {
      const response = await api.get('/goals/history');
      const goals = response.data.data || [];
      return goals;
    } catch (error) {
      console.error('获取目标历史失败:', error);
      throw error;
    }
  }

  // 开启新目标
  async startNewGoal(goalData: StartGoalData): Promise<UserGoal> {
    try {
      const response = await api.post('/goals/start', goalData);
      return response.data.data;
    } catch (error) {
      console.error('开启新目标失败:', error);
      throw error;
    }
  }

  // 终止当前目标
  async terminateCurrentGoal(): Promise<UserGoal | null> {
    try {
      const response = await api.put('/goals/terminate');
      return response.data.data;
    } catch (error) {
      console.error('终止当前目标失败:', error);
      throw error;
    }
  }

  // 完成目标
  async completeGoal(goalId: string): Promise<UserGoal> {
    try {
      const response = await api.put(`/goals/${goalId}/complete`);
      return response.data.data;
    } catch (error) {
      console.error('完成目标失败:', error);
      throw error;
    }
  }

  // 获取目标概况（支持按目标筛选）
  async getGoalOverview(goalId?: string): Promise<GoalOverview> {
    try {
      const params = goalId ? { goalId } : {};
      const response = await api.get('/history/overview', { params });
      return response.data.data;
    } catch (error) {
      console.error('获取目标概况失败:', error);
      throw error;
    }
  }

  // 数据迁移（管理员功能）
  async migrateExistingUsers(): Promise<any> {
    try {
      const response = await api.post('/goals/migrate');
      return response.data;
    } catch (error) {
      console.error('数据迁移失败:', error);
      throw error;
    }
  }

  // 更新目标
  async updateGoal(goalId: string, data: UpdateGoalData): Promise<UserGoal> {
    try {
      const response = await api.patch(`/goals/${goalId}`, data);
      return response.data.data;
    } catch (error) {
      console.error('更新目标失败:', error);
      throw error;
    }
  }

  // 删除目标
  async deleteGoal(goalId: string): Promise<void> {
    try {
      await api.delete(`/goals/${goalId}`);
    } catch (error) {
      console.error('删除目标失败:', error);
      throw error;
    }
  }
}

export const goalService = new GoalService();
