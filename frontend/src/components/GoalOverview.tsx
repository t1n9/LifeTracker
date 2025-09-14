import React, { useState, useEffect } from 'react';
import { goalService, UserGoal, GoalOverview as GoalOverviewData } from '../services/goalService';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar, Target, TrendingUp, BookOpen, Activity, DollarSign, Clock } from 'lucide-react';

interface GoalOverviewProps {
  userId?: string;
}

const GoalOverview: React.FC<GoalOverviewProps> = ({ userId }) => {
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [overviewData, setOverviewData] = useState<GoalOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  useEffect(() => {
    if (selectedGoalId !== undefined) {
      loadOverviewData();
    }
  }, [selectedGoalId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const goalHistory = await goalService.getGoalHistory();
      setGoals(goalHistory);

      // 默认选择全部时间
      setSelectedGoalId('');
    } catch (error) {
      console.error('加载目标数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewData = async () => {
    try {
      const data = await goalService.getGoalOverview(selectedGoalId || undefined);
      setOverviewData(data);
    } catch (error) {
      console.error('加载概况数据失败:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy年MM月dd日', { locale: zhCN });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '进行中';
      case 'COMPLETED': return '已完成';
      case 'TERMINATED': return '已终止';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'COMPLETED': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20';
      case 'TERMINATED': return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 目标选择器 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-blue-500 dark:text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">数据概况</h3>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            选择时间段
          </label>
          <select
            value={selectedGoalId}
            onChange={(e) => setSelectedGoalId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">全部时间</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.goalName} ({formatDate(goal.startDate)} - {goal.endDate ? formatDate(goal.endDate) : '进行中'})
                <span className="ml-2 text-sm">
                  [{getStatusText(goal.status)}]
                </span>
              </option>
            ))}
          </select>
        </div>

        {/* 选中目标信息 */}
        {selectedGoalId && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            {(() => {
              const selectedGoal = goals.find(g => g.id === selectedGoalId);
              if (!selectedGoal) return null;

              return (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200">{selectedGoal.goalName}</h4>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(selectedGoal.status)}`}>
                      {getStatusText(selectedGoal.status)}
                    </span>
                  </div>
                  {selectedGoal.description && (
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">{selectedGoal.description}</p>
                  )}
                  <div className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                    <p>开始时间: {formatDate(selectedGoal.startDate)}</p>
                    {selectedGoal.endDate && <p>结束时间: {formatDate(selectedGoal.endDate)}</p>}
                    {selectedGoal.targetDate && <p>目标日期: {formatDate(selectedGoal.targetDate)}</p>}

                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* 概况数据 */}
      {overviewData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 时间段信息 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-purple-500 dark:text-purple-400" size={20} />
              <h4 className="font-semibold text-gray-900 dark:text-white">时间段</h4>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p><span className="font-medium">开始:</span> {overviewData.period.startDate}</p>
              <p><span className="font-medium">结束:</span> {overviewData.period.endDate}</p>
              <p><span className="font-medium">总天数:</span> {overviewData.period.totalDays} 天</p>
            </div>
          </div>

          {/* 任务统计 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-green-500 dark:text-green-400" size={20} />
              <h4 className="font-semibold text-gray-900 dark:text-white">任务完成</h4>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p><span className="font-medium">总任务:</span> {overviewData.tasks.total}</p>
              <p><span className="font-medium">已完成:</span> {overviewData.tasks.completed}</p>
              <p><span className="font-medium">完成率:</span> {overviewData.tasks.completionRate}%</p>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className="bg-green-500 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${overviewData.tasks.completionRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 学习统计 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="text-blue-500 dark:text-blue-400" size={20} />
              <h4 className="font-semibold text-gray-900 dark:text-white">学习时间</h4>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p><span className="font-medium">总时长:</span> {overviewData.study.totalHours} 小时</p>
              <p><span className="font-medium">日均:</span> {overviewData.study.averageMinutesPerDay} 分钟</p>
              <p><span className="font-medium">番茄钟:</span> {overviewData.study.pomodoroCount} 个</p>
              <p><span className="font-medium">日均番茄:</span> {overviewData.study.averagePomodoroPerDay} 个</p>
            </div>
          </div>

          {/* 运动统计 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-orange-500 dark:text-orange-400" size={20} />
              <h4 className="font-semibold text-gray-900 dark:text-white">运动记录</h4>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p><span className="font-medium">总记录:</span> {overviewData.exercise.totalRecords}</p>
              {overviewData.exercise.exerciseTypes.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium mb-2">运动类型:</p>
                  <div className="space-y-1">
                    {overviewData.exercise.exerciseTypes.map((exercise, index) => (
                      <div key={index} className="flex justify-between text-xs">
                        <span>{exercise.name}:</span>
                        <span>{exercise.total} {exercise.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 消费统计 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="text-red-500 dark:text-red-400" size={20} />
              <h4 className="font-semibold text-gray-900 dark:text-white">消费记录</h4>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p><span className="font-medium">总消费:</span> ¥{overviewData.expense.total}</p>
              <p><span className="font-medium">日均:</span> ¥{overviewData.expense.averagePerDay}</p>
              <p><span className="font-medium">记录数:</span> {overviewData.expense.recordCount}</p>
            </div>
          </div>

          {/* 效率指标 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-indigo-500 dark:text-indigo-400" size={20} />
              <h4 className="font-semibold text-gray-900 dark:text-white">效率指标</h4>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p><span className="font-medium">学习效率:</span> {overviewData.study.averageMinutesPerDay > 60 ? '高' : overviewData.study.averageMinutesPerDay > 30 ? '中' : '低'}</p>
              <p><span className="font-medium">任务效率:</span> {overviewData.tasks.completionRate > 80 ? '优秀' : overviewData.tasks.completionRate > 60 ? '良好' : '需改进'}</p>
              <p><span className="font-medium">运动频率:</span> {overviewData.exercise.totalRecords / overviewData.period.totalDays > 0.5 ? '经常' : '偶尔'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalOverview;
