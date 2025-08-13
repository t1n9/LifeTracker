'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, X, Check, Clock, Play, Sunrise } from 'lucide-react';
import { taskAPI, dailyAPI } from '@/lib/api';

interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  description?: string;
  priority?: number; // 0=低，1=中，2=高
  pomodoroCount?: number; // 番茄数量
  createdAt: string;
  updatedAt: string;
}

interface PendingTasksProps {
  onTaskClick: (taskId: string, taskTitle: string) => void; // 点击任务绑定番茄钟
  onStartCountUp: (taskId: string, taskTitle: string) => void; // 开始正计时番茄钟
  currentBoundTask?: string | null; // 当前绑定的任务ID
  isRunning?: boolean; // 番茄钟是否正在运行
  dayStartRefreshTrigger?: number; // 开启内容刷新触发器
}

const PendingTasks: React.FC<PendingTasksProps> = ({
  onTaskClick,
  onStartCountUp,
  currentBoundTask,
  isRunning = false,
  dayStartRefreshTrigger
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingTasks, setUpdatingTasks] = useState<Record<string, boolean>>({});
  const [dayStart, setDayStart] = useState<string | null>(null);

  // 加载今日任务列表
  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await taskAPI.getTodayTasks();
      setTasks(response.data || []);
    } catch (error) {
      console.error('加载今日任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载今日开启内容
  const loadDayStart = async () => {
    try {
      const response = await dailyAPI.getTodayStatus();
      setDayStart(response.data.dayStart);
    } catch (error) {
      console.error('加载开启内容失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    loadTasks();
    loadDayStart();
  }, []);

  // 当开启内容刷新触发器变化时，重新加载开启内容
  useEffect(() => {
    if (dayStartRefreshTrigger !== undefined) {
      loadDayStart();
    }
  }, [dayStartRefreshTrigger]);

  // 添加新任务
  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;

    try {
      await taskAPI.createTask({
        title: newTaskText.trim(),
        isCompleted: false,
        priority: 1 // 使用数字：0=低，1=中，2=高
      });

      setNewTaskText('');
      setShowInput(false);
      await loadTasks(); // 重新加载任务列表
    } catch (error) {
      console.error('添加任务失败:', error);
      alert('添加任务失败，请重试');
    }
  };

  // 切换任务完成状态
  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      // 设置更新状态
      setUpdatingTasks(prev => ({ ...prev, [taskId]: true }));

      // 乐观更新：立即更新本地状态
      setTasks(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, isCompleted: !currentStatus }
          : task
      ));

      // 调用API更新
      await taskAPI.updateTask(taskId, {
        isCompleted: !currentStatus
      });

      // 成功后重新加载任务列表以确保数据一致性
      await loadTasks();
    } catch (error) {
      console.error('更新任务状态失败:', error);
      alert('更新任务失败，请重试');
      // 失败时重新加载任务列表
      await loadTasks();
    } finally {
      // 清除更新状态
      setUpdatingTasks(prev => ({ ...prev, [taskId]: false }));
    }
  };

  // 删除任务
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) return;

    try {
      await taskAPI.deleteTask(taskId);
      await loadTasks(); // 重新加载任务列表
    } catch (error) {
      console.error('删除任务失败:', error);
      alert('删除任务失败，请重试');
    }
  };

  // 处理任务点击（绑定番茄钟）
  const handleTaskClick = (task: Task) => {
    if (isRunning) {
      alert('番茄钟正在运行中，无法更换绑定任务');
      return;
    }

    onTaskClick(task.id, task.title);
  };

  // 处理正计时开始
  const handleStartCountUp = (task: Task) => {
    if (isRunning) {
      alert('番茄钟正在运行中，请先停止当前番茄钟');
      return;
    }

    onStartCountUp(task.id, task.title);
  };

  // 键盘事件处理
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    } else if (e.key === 'Escape') {
      setNewTaskText('');
      setShowInput(false);
    }
  };

  // 过滤未完成的任务
  const pendingTasks = tasks.filter(task => !task.isCompleted);
  const completedTasks = tasks.filter(task => task.isCompleted);

  // 获取优先级颜色
  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 2: return '#ef4444'; // 高优先级
      case 1: return '#f59e0b'; // 中优先级
      case 0: return '#10b981'; // 低优先级
      default: return '#6b7280';
    }
  };

  // 获取优先级标签
  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 2: return '🔴'; // 高优先级
      case 1: return '🟡'; // 中优先级
      case 0: return '🟢'; // 低优先级
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckSquare size={20} className="text-green-500" />
          <h3 className="text-lg font-semibold">今日任务</h3>
        </div>
        <div className="text-sm text-gray-500">
          {pendingTasks.length} 个待完成
        </div>
      </div>

      {/* 进度显示 */}
      {tasks.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-500">完成进度</span>
            <span className="text-sm text-gray-500">
              {Math.round((completedTasks.length / tasks.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedTasks.length / tasks.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
        {pendingTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckSquare size={40} className="mx-auto mb-2 opacity-50" />
            <p>今日暂无待完成任务</p>
            <p className="text-sm">点击下方按钮添加今日任务</p>
          </div>
        ) : (
          pendingTasks.map(task => (
            <div
              key={task.id}
              className={`pending-task-item ${currentBoundTask === task.id ? 'bound' : ''}`}
            >
              {/* 复选框 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleTask(task.id, task.isCompleted);
                }}
                className="task-checkbox"
                title="点击完成任务"
                disabled={updatingTasks[task.id]}
              >
                {updatingTasks[task.id] ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Check size={12} className="text-white opacity-0" />
                )}
              </button>

              {/* 任务内容 - 点击切换绑定状态 */}
              <div
                className="task-content"
                onClick={() => handleTaskClick(task)}
                title={
                  isRunning
                    ? '番茄钟运行中，无法更换绑定'
                    : currentBoundTask === task.id
                      ? '点击取消绑定'
                      : '点击绑定到番茄钟'
                }
              >
                <div className="flex items-center gap-2">
                  <span className="task-title">{task.title}</span>

                  {/* 番茄数量显示 */}
                  {(task.pomodoroCount || 0) > 0 && (
                    <div className="pomodoro-count-badge">
                      🍅 {task.pomodoroCount}
                    </div>
                  )}

                  {/* 绑定状态指示 */}
                  {currentBoundTask === task.id && (
                    <div className="bound-indicator">
                      <Clock size={14} />
                    </div>
                  )}
                </div>
                {task.description && (
                  <div className="task-description">{task.description}</div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="task-actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartCountUp(task);
                  }}
                  className={`action-btn start-btn ${isRunning ? 'disabled' : ''}`}
                  disabled={isRunning}
                  title={isRunning ? '番茄钟运行中' : '开始正计时'}
                >
                  <Play size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTask(task.id);
                  }}
                  className="action-btn delete-btn"
                  title="删除任务"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 已完成任务（折叠显示） */}
      {completedTasks.length > 0 && (
        <details className="mb-4">
          <summary className="cursor-pointer text-sm text-gray-500 mb-2">
            已完成任务 ({completedTasks.length})
          </summary>
          <div className="space-y-1 pl-4 border-l-2 border-gray-200">
            {completedTasks.map(task => (
              <div key={task.id} className="completed-task-item">
                <button
                  onClick={() => handleToggleTask(task.id, task.isCompleted)}
                  className="task-checkbox checked"
                  disabled={updatingTasks[task.id]}
                >
                  {updatingTasks[task.id] ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Check size={12} className="text-white" />
                  )}
                </button>
                <span className="task-title completed">{task.title}</span>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="action-btn delete-btn"
                  title="删除任务"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* 今日开启内容显示 */}
      {dayStart && (
        <div style={{
          marginTop: '1rem',
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: 'rgba(66, 153, 225, 0.1)',
          border: '1px solid rgba(66, 153, 225, 0.2)',
          borderRadius: '8px',
          borderLeft: '4px solid #4299e1',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}>
            <Sunrise size={16} style={{ color: '#4299e1' }} />
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: '#4299e1',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              今日开启
            </span>
          </div>
          <div style={{
            fontSize: '0.875rem',
            lineHeight: '1.4',
            color: 'var(--text-primary)',
            fontStyle: 'italic',
            whiteSpace: 'pre-wrap',
          }}>
            {dayStart}
          </div>
        </div>
      )}

      {/* 添加新任务 */}
      {showInput ? (
        <div className="add-task-form">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="输入新任务..."
            className="task-input"
            autoFocus
          />
          <div className="form-actions">
            <button
              onClick={handleAddTask}
              className="btn btn-primary"
              disabled={!newTaskText.trim()}
            >
              <Plus size={16} />
              添加
            </button>
            <button
              onClick={() => {
                setShowInput(false);
                setNewTaskText('');
              }}
              className="btn btn-secondary"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="add-task-btn"
        >
          <Plus size={18} />
          <span>添加今日任务</span>
        </button>
      )}
    </div>
  );
};

export default PendingTasks;
