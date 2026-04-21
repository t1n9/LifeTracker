'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, X, Check, Clock, Play, Sunrise, Edit3, GripVertical } from 'lucide-react';
import { taskAPI, dailyAPI } from '@/lib/api';
import '@/styles/draggable-tasks.css';
import styles from './PendingTasks.module.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  description?: string;
  priority?: number; // 0=低，1=中，2=高
  pomodoroCount?: number; // 番茄数量
  sortOrder?: number; // 排序顺序
  createdAt: string;
  updatedAt: string;
}

interface PendingTasksProps {
  onTaskClick: (taskId: string, taskTitle: string) => void; // 点击任务绑定番茄钟
  onStartCountUp: (taskId: string, taskTitle: string) => void; // 开始正计时番茄钟
  currentBoundTask?: string | null; // 当前绑定的任务ID
  isRunning?: boolean; // 番茄钟是否正在运行
  dayStartRefreshTrigger?: number; // 开启内容刷新触发器
  pomodoroCompleteRefreshTrigger?: number; // 番茄钟完成刷新触发器
  onCompleteTaskWithPomodoro?: (taskId: string) => void; // 完成任务并结束番茄钟（计入番茄数）
  onCompleteTaskCancelPomodoro?: (taskId: string) => void; // 完成任务并取消番茄钟（不计入番茄数）
  pomodoroElapsedTime?: number; // 番茄钟已运行时间（秒）
  taskRefreshTrigger?: number; // 任务刷新触发器
  onUpdatePomodoroTaskId?: (oldId: string, newId: string) => void; // 更新番茄钟绑定任务ID
  onTaskAdded?: (newTask: any) => void; // 任务添加成功回调
}

// 可拖拽的任务项组件
interface SortableTaskItemProps {
  task: Task;
  onTaskClick: (taskId: string, taskTitle: string) => void;
  onStartCountUp: (taskId: string, taskTitle: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onToggleTask: (taskId: string, currentStatus: boolean) => void;
  currentBoundTask?: string | null;
  isRunning?: boolean;
  editingTaskId?: string | null;
  editingTaskTitle?: string;
  onSaveEdit?: () => void;

  onEditTitleChange?: (title: string) => void;
  onEditKeyPress?: (e: React.KeyboardEvent) => void;
}

const SortableTaskItem: React.FC<SortableTaskItemProps> = ({
  task,
  onTaskClick,
  onStartCountUp,
  onDeleteTask,
  onEditTask,
  onToggleTask,
  currentBoundTask,
  isRunning,
  editingTaskId,
  editingTaskTitle,
  onSaveEdit,
  onEditTitleChange,
  onEditKeyPress,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };



  const isBound = currentBoundTask === task.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`pending-task-item ${styles.item} ${isBound ? `bound ${styles.itemBound}` : ''} ${isDragging ? `dragging ${styles.dragging}` : ''}`}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={() => onTaskClick(task.id, task.title)}
      title={
        isRunning
          ? '番茄钟运行中，无法更换绑定'
          : isBound
            ? '点击取消绑定'
            : '点击绑定到番茄钟'
      }
    >
      {/* 拖拽手柄 */}
      <div
        className={`drag-handle-simple ${styles.dragHandle}`}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={16} />
      </div>



      {/* 任务内容 */}
      <div className={`task-content ${styles.content}`}>
        <div className={styles.row}>
          {/* 任务完成复选框 */}
          <input
            type="checkbox"
            checked={task.isCompleted}
            title="完成任务"
            onClick={(e) => {
              e.stopPropagation(); // 阻止冒泡到父元素的点击事件
            }}
            onChange={(e) => {
              e.stopPropagation();
              onToggleTask(task.id, task.isCompleted);
            }}
            className={`task-checkbox ${styles.checkbox}`}
          />

          {/* 任务标题 - 编辑状态或显示状态 */}
          {editingTaskId === task.id ? (
            <input
              type="text"
              value={editingTaskTitle}
              onChange={(e) => onEditTitleChange?.(e.target.value)}
              onBlur={onSaveEdit}
              onKeyDown={onEditKeyPress}
              onClick={(e) => e.stopPropagation()} // 阻止冒泡到父元素
              className="task-title-input"
              autoFocus
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                outline: 'none',
                flex: 1,
                minWidth: '120px'
              }}
            />
          ) : (
            <span
              className={`task-title ${styles.taskTitle} ${task.isCompleted ? styles.taskTitleCompleted : ''}`}
            >
              {task.title}
            </span>
          )}

          {/* 番茄数量显示 */}
          {(task.pomodoroCount || 0) > 0 && (
            <div className={`pomodoro-count-badge ${styles.badge}`} style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-tertiary)',
              padding: '0.125rem 0.375rem',
              borderRadius: '12px',
            }}>
              🍅 {task.pomodoroCount}
            </div>
          )}

          {/* 绑定状态指示 */}
          {isBound && (
            <div className={`bound-indicator ${styles.boundIndicator}`} style={{
              color: 'var(--accent-primary)',
              fontSize: '0.75rem',
            }}>
              <Clock size={14} />
            </div>
          )}
        </div>
        {task.description && (
          <div className={`task-description ${styles.taskDescription}`} style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginTop: '0.25rem',
          }}>
            {task.description}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className={styles.actions}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartCountUp(task.id, task.title);
          }}
          className={`action-btn start-btn ${styles.actionButton}`}
          title="开始正计时"
        >
          <Play size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditTask(task);
          }}
          className={`action-btn edit-btn ${styles.actionButton}`}
          title="编辑任务"
        >
          <Edit3 size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteTask(task.id);
          }}
          className={`action-btn delete-btn ${styles.actionButton} ${styles.actionButtonDanger}`}
          title="删除任务"
        >
          <X size={16} />
        </button>
      </div>


    </div>
  );
};

const PendingTasks: React.FC<PendingTasksProps> = ({
  onTaskClick,
  onStartCountUp,
  currentBoundTask,
  isRunning = false,
  dayStartRefreshTrigger,
  pomodoroCompleteRefreshTrigger,
  onCompleteTaskWithPomodoro,
  onCompleteTaskCancelPomodoro,
  pomodoroElapsedTime = 0,
  taskRefreshTrigger = 0,
  onUpdatePomodoroTaskId,
  onTaskAdded
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [updatingTasks, setUpdatingTasks] = useState<Record<string, boolean>>({});
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [dayStart, setDayStart] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState<string>('');

  // 拖拽传感器配置
  const sensors = useSensors(
    // 鼠标和触摸板支持
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要移动8px才开始拖拽，避免误触
      },
    }),
    // 移动设备触摸支持
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 长按200ms后开始拖拽
        tolerance: 8, // 允许8px的移动容差
      },
    }),
    // 键盘支持
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理拖拽开始
  const handleDragStart = () => {
    document.body.classList.add('dragging');
  };

  // 处理拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    document.body.classList.remove('dragging');

    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // 只在未完成任务中查找索引
    const pendingTasks = tasks.filter(task => !task.isCompleted);
    const oldIndex = pendingTasks.findIndex(task => task.id === active.id);
    const newIndex = pendingTasks.findIndex(task => task.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 重新排列未完成任务
    const newPendingTasks = arrayMove(pendingTasks, oldIndex, newIndex);

    // 合并已完成任务和重新排序的未完成任务
    const completedTasks = tasks.filter(task => task.isCompleted);
    const newTasks = [...newPendingTasks, ...completedTasks];
    setTasks(newTasks);

    // 只更新未完成任务的排序顺序
    const taskOrders = newPendingTasks.map((task, index) => ({
      id: task.id,
      sortOrder: index,
    }));

    try {
      await taskAPI.updateTasksOrder(taskOrders);
    } catch (error) {
      console.error('更新任务排序失败:', error);
      // 如果更新失败，恢复原来的顺序
      setTasks(tasks);
    }
  };

  // 处理拖拽取消
  const handleDragCancel = () => {
    document.body.classList.remove('dragging');
  };

  // 加载今日任务列表
  const loadTasks = async ({ silent = false }: { silent?: boolean } = {}) => {
    const useSilentRefresh = silent && hasLoadedOnce;

    try {
      if (useSilentRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await taskAPI.getTodayTasks();
      const loadedTasks = response.data || [];
      // 前端按sortOrder重新排序
      const sortedTasks = [...loadedTasks].sort((a: any, b: any) => {
        // 未完成任务在前，已完成任务在后
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1;
        }
        // 同类型任务按sortOrder排序
        if (!a.isCompleted && !b.isCompleted) {
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        }
        // 已完成任务按更新时间排序
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      setTasks(sortedTasks);
    } catch (error) {
      console.error('加载今日任务失败:', error);
    } finally {
      if (useSilentRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
        setHasLoadedOnce(true);
      }
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

  // 当番茄钟完成刷新触发器变化时，重新加载任务列表
  useEffect(() => {
    if (pomodoroCompleteRefreshTrigger !== undefined && pomodoroCompleteRefreshTrigger > 0) {
      loadTasks({ silent: true });
    }
  }, [pomodoroCompleteRefreshTrigger]);

  // 当任务刷新触发器变化时，重新加载任务列表
  useEffect(() => {
    if (taskRefreshTrigger !== undefined && taskRefreshTrigger > 0) {
      console.log('🔄 任务刷新触发器变化，重新加载任务列表');
      loadTasks({ silent: true });
    }
  }, [taskRefreshTrigger]);

  // 添加新任务
  const handleAddTask = async () => {
    if (!newTaskText.trim() || isAddingTask) return;

    const tempId = `temp-${Date.now()}`;
    const newTask = {
      id: tempId,
      title: newTaskText.trim(),
      isCompleted: false,
      priority: 1,
      sortOrder: tasks.filter(t => !t.isCompleted).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      setIsAddingTask(true);

      // 乐观更新：添加到未完成任务的最后
      setTasks(prev => {
        const pendingTasks = prev.filter(t => !t.isCompleted);
        const completedTasks = prev.filter(t => t.isCompleted);
        return [...pendingTasks, newTask, ...completedTasks];
      });
      setNewTaskText('');
      setShowInput(false);

      // 调用API创建任务
      const response = await taskAPI.createTask({
        title: newTask.title,
        isCompleted: false,
        priority: 1
      });

      // 用真实的任务数据替换临时任务
      setTasks(prev => prev.map(task =>
        task.id === tempId ? response.data : task
      ));

      // 通知Dashboard任务已添加
      if (onTaskAdded) {
        onTaskAdded(response.data);
      }

      // 如果当前绑定的任务是临时ID，更新为真实ID
      if (currentBoundTask === tempId) {
        console.log('🔄 更新番茄钟绑定任务ID:', tempId, '->', response.data.id);
        // 使用专门的更新方法，避免重新绑定
        if (onUpdatePomodoroTaskId) {
          onUpdatePomodoroTaskId(tempId, response.data.id);
        } else {
          // 兜底方案：重新绑定
          onTaskClick(response.data.id, response.data.title);
        }
      }

    } catch (error) {
      console.error('添加任务失败:', error);
      alert('添加任务失败，请重试');

      // 失败时移除临时任务
      setTasks(prev => prev.filter(task => task.id !== tempId));
      setShowInput(true); // 重新显示输入框
    } finally {
      setIsAddingTask(false);
    }
  };

  // 切换任务完成状态
  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      console.log('🔄 处理任务状态切换:', { taskId, currentStatus, isRunning, currentBoundTask, pomodoroElapsedTime });

      // 如果是要完成任务（从未完成变为完成）
      if (!currentStatus) {
        // 检查是否是番茄钟运行中的绑定任务
        const isCurrentBoundTask = currentBoundTask === taskId;
        const isPomodoroRunning = isRunning && isCurrentBoundTask;

        if (isPomodoroRunning) {
          // 番茄钟正在运行中，根据运行时间决定处理方式
          if (pomodoroElapsedTime >= 300) { // 5分钟 = 300秒
            // 超过5分钟，可以正常完成任务并计入番茄数
            if (onCompleteTaskWithPomodoro) {
              const confirmed = confirm('番茄钟正在运行中，完成此任务将提前结束番茄钟并计入番茄数。是否继续？');
              if (confirmed) {
                onCompleteTaskWithPomodoro(taskId);
                return;
              } else {
                return; // 用户取消，不执行任何操作
              }
            }
          } else {
            // 不足5分钟，完成任务但不计入番茄数
            if (onCompleteTaskCancelPomodoro) {
              const confirmed = confirm('番茄钟运行不足5分钟，完成此任务将取消番茄钟且不计入番茄数。是否继续？');
              if (confirmed) {
                onCompleteTaskCancelPomodoro(taskId);
                return;
              } else {
                return; // 用户取消，不执行任何操作
              }
            }
          }
        }
      }

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

    } catch (error) {
      console.error('更新任务状态失败:', error);
      alert('更新任务失败，请重试');

      // 失败时恢复原状态
      setTasks(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, isCompleted: currentStatus }
          : task
      ));
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

      // 本地移除任务，避免重新加载
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('删除任务失败:', error);
      alert('删除任务失败，请重试');
    }
  };



  // 保存任务编辑
  const handleSaveEdit = async () => {
    if (!editingTaskId || !editingTaskTitle.trim()) {
      setEditingTaskId(null);
      setEditingTaskTitle('');
      return;
    }

    try {
      // 设置更新状态
      setUpdatingTasks(prev => ({ ...prev, [editingTaskId]: true }));

      // 调用API更新任务标题
      await taskAPI.updateTask(editingTaskId, {
        title: editingTaskTitle.trim()
      });

      // 本地更新任务状态，避免重新加载
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === editingTaskId
            ? { ...task, title: editingTaskTitle.trim() }
            : task
        )
      );

      // 清除编辑状态
      setEditingTaskId(null);
      setEditingTaskTitle('');
    } catch (error) {
      console.error('更新任务失败:', error);
      alert('更新任务失败，请重试');
    } finally {
      // 清除更新状态
      setUpdatingTasks(prev => ({ ...prev, [editingTaskId]: false }));
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingTaskTitle('');
  };

  // 处理编辑输入框的键盘事件
  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
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



  if (loading) {
    return (
      <div className={styles.card}>
        <div className="flex items-center justify-center py-8">
          <div style={{ color: 'var(--text-muted)' }}>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}>
            <CheckSquare size={18} />
          </div>
          {refreshing && (
            <span className="text-xs opacity-60" style={{ color: 'var(--text-muted)' }}>
              同步中...
            </span>
          )}
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>今日任务</h3>
        </div>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {pendingTasks.length} 个待完成
        </div>
      </div>

      {/* 进度显示 */}
      {tasks.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>完成进度</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {Math.round((completedTasks.length / tasks.length) * 100)}%
            </span>
          </div>
          <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedTasks.length / tasks.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <div className={styles.list}>
        {pendingTasks.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <CheckSquare size={40} className="mx-auto mb-2 opacity-50" />
            <p>今日暂无待完成任务</p>
            <p className="text-sm">点击下方按钮添加今日任务</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="dnd-context">
            <SortableContext
              items={pendingTasks.map(task => task.id)}
              strategy={verticalListSortingStrategy}
            >
              {pendingTasks.map(task => (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  onTaskClick={onTaskClick}
                  onStartCountUp={onStartCountUp}
                  onDeleteTask={handleDeleteTask}
                  onEditTask={(task) => {
                    setEditingTaskId(task.id);
                    setEditingTaskTitle(task.title);
                  }}
                  onToggleTask={handleToggleTask}
                  currentBoundTask={currentBoundTask}
                  isRunning={isRunning}
                  editingTaskId={editingTaskId}
                  editingTaskTitle={editingTaskTitle}
                  onSaveEdit={handleSaveEdit}
                  onEditTitleChange={(title) => setEditingTaskTitle(title)}
                  onEditKeyPress={handleEditKeyPress}
                />
              ))}
            </SortableContext>
            </div>
          </DndContext>
        )}
      </div>

      {/* 已完成任务（折叠显示） */}
      {completedTasks.length > 0 && (
        <details className="mb-4">
          <summary className="cursor-pointer text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            已完成任务 ({completedTasks.length})
          </summary>
          <div className="space-y-1 pl-4 border-l-2" style={{ borderColor: 'var(--border-color)' }}>
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
                <span className="task-title completed" style={{ flex: 1 }}>{task.title}</span>

                {/* 番茄数量显示 */}
                {(task.pomodoroCount || 0) > 0 && (
                  <div className="pomodoro-count-badge" style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-tertiary)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '12px',
                    opacity: 0.8,
                    marginRight: '0.5rem',
                  }}>
                    🍅 {task.pomodoroCount}
                  </div>
                )}

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
          borderLeft: '4px solid var(--accent-primary)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}>
            <Sunrise size={16} style={{ color: 'var(--accent-primary)' }} />
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'var(--accent-primary)',
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
        <div className={styles.addForm}>
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="今天要完成什么任务？"
            className={styles.addInput}
            disabled={isAddingTask}
            autoFocus
          />
          <div className={styles.addActions}>
            <button
              onClick={handleAddTask}
              className={`${styles.addPrimaryButton} ${isAddingTask ? styles.loading : ''}`}
              disabled={!newTaskText.trim() || isAddingTask}
              title="添加任务"
            >
              {!isAddingTask && <Plus size={16} />}
              {isAddingTask ? '添加中...' : '添加任务'}
            </button>
            <button
              onClick={() => {
                setShowInput(false);
                setNewTaskText('');
              }}
              className={styles.addCloseButton}
              disabled={isAddingTask}
              title="取消"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className={styles.addOpenButton}
        >
          <Plus size={18} />
          <span>添加今日任务</span>
        </button>
      )}
    </div>
  );
};

export default PendingTasks;
