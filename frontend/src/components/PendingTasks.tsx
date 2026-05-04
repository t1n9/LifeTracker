'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, X, Check, GripVertical, Pencil, Trash2, Timer } from 'lucide-react';
import { taskAPI } from '@/lib/api';
import { dispatchAgentDataChanged, PROACTIVE_TRIGGER_EVENT } from '@/lib/agent-events';
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
  priority?: number; // 0=浣庯紝1=涓紝2=楂?
  pomodoroCount?: number; // 鐣寗鏁伴噺
  sortOrder?: number; // 鎺掑簭椤哄簭
  createdAt: string;
  updatedAt: string;
}

function parseTaskDisplayTitle(title: string) {
  const match = title.match(/^\[(上午|下午|晚上|早上|中午)\](?:\(([\d.]+)h\))?\s*(.+)$/u);
  if (!match) {
    return { title, timeSegment: '', hours: '' };
  }
  return {
    title: match[3],
    timeSegment: match[1],
    hours: match[2] ? `${match[2]}h` : '',
  };
}

interface PendingTasksProps {
  onTaskClick: (taskId: string, taskTitle: string) => void; // 鐐瑰嚮浠诲姟缁戝畾鐣寗閽?
  onStartCountUp: (taskId: string, taskTitle: string) => void; // 寮€濮嬫璁℃椂鐣寗閽?
  currentBoundTask?: string | null; // 褰撳墠缁戝畾鐨勪换鍔D
  isRunning?: boolean; // 鐣寗閽熸槸鍚︽鍦ㄨ繍琛?
  pomodoroCompleteRefreshTrigger?: number; // 鐣寗閽熷畬鎴愬埛鏂拌Е鍙戝櫒
  onCompleteTaskWithPomodoro?: (taskId: string) => void; // 瀹屾垚浠诲姟骞剁粨鏉熺暘鑼勯挓锛堣鍏ョ暘鑼勬暟锛?
  onCompleteTaskCancelPomodoro?: (taskId: string) => void; // 瀹屾垚浠诲姟骞跺彇娑堢暘鑼勯挓锛堜笉璁″叆鐣寗鏁帮級
  pomodoroElapsedTime?: number; // 鐣寗閽熷凡杩愯鏃堕棿锛堢锛?
  taskRefreshTrigger?: number; // 浠诲姟鍒锋柊瑙﹀彂鍣?
  onUpdatePomodoroTaskId?: (oldId: string, newId: string) => void; // 鏇存柊鐣寗閽熺粦瀹氫换鍔D
  onTaskAdded?: (newTask: any) => void; // 浠诲姟娣诲姞鎴愬姛鍥炶皟
}

// 鍙嫋鎷界殑浠诲姟椤圭粍浠?
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
  const displayTitle = parseTaskDisplayTitle(task.title);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.item} ${isBound ? styles.itemBound : ''} ${isDragging ? styles.dragging : ''}`}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* 拖拽手柄 */}
      <div
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={15} />
      </div>

      {/* 任务内容 + 操作区（hover展开） */}
      <div className={styles.content}>
        {/* 标题行 */}
        <div className={styles.row}>
          {editingTaskId === task.id ? (
            <input
              type="text"
              value={editingTaskTitle}
              onChange={(e) => onEditTitleChange?.(e.target.value)}
              onBlur={onSaveEdit}
              onKeyDown={onEditKeyPress}
              onClick={(e) => e.stopPropagation()}
              className={styles.editInput}
              autoFocus
            />
          ) : (
            <span className={`${styles.taskTitle} ${task.isCompleted ? styles.taskTitleCompleted : ''}`}>
              {displayTitle.timeSegment && (
                <span className={styles.taskMeta}>
                  {displayTitle.timeSegment}{displayTitle.hours ? ` · ${displayTitle.hours}` : ''}
                </span>
              )}
              {displayTitle.title}
            </span>
          )}

          {isBound && (
            <span className={styles.boundIndicator} title="专注中">
              <Timer size={12} />
            </span>
          )}

          {(task.pomodoroCount || 0) > 0 && (
            <div className={styles.badge}>🍅 {task.pomodoroCount}</div>
          )}
        </div>

        {task.description && (
          <div className={styles.taskDescription}>{task.description}</div>
        )}

        {/* hover / 绑定时展开的操作行 */}
        {!task.isCompleted && (
          <div className={styles.actions}>
            {/* 绑定番茄 */}
            <button
              onClick={(e) => { e.stopPropagation(); onTaskClick(task.id, task.title); }}
              className={`${styles.actionButton} ${isBound ? styles.actionButtonBound : ''}`}
              title={isBound ? '已绑定' : '绑定番茄'}
            >
              <Timer size={12} /> {isBound ? '已绑定' : '绑定番茄'}
            </button>

            {/* 标记完成 */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTask(task.id, task.isCompleted); }}
              className={styles.actionButton}
            >
              <Check size={12} /> 完成
            </button>

            {/* 修改 — 仅图标 */}
            <button
              onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
              className={`${styles.actionButton} ${styles.actionButtonIcon}`}
              title="修改"
            >
              <Pencil size={12} />
            </button>

            {/* 删除 — 仅图标 */}
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
              className={`${styles.actionButton} ${styles.actionButtonIcon} ${styles.actionButtonDanger}`}
              title="删除"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const PendingTasks: React.FC<PendingTasksProps> = ({
  onTaskClick,
  onStartCountUp,
  currentBoundTask,
  isRunning = false,
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState<string>('');

  // 鎷栨嫿浼犳劅鍣ㄩ厤缃?
  const sensors = useSensors(
    // 榧犳爣鍜岃Е鎽告澘鏀寔
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 闇€瑕佺Щ鍔?px鎵嶅紑濮嬫嫋鎷斤紝閬垮厤璇Е
      },
    }),
    // 绉诲姩璁惧瑙︽懜鏀寔
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 闀挎寜200ms鍚庡紑濮嬫嫋鎷?
        tolerance: 8, // 鍏佽8px鐨勭Щ鍔ㄥ宸?
      },
    }),
    // 閿洏鏀寔
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 澶勭悊鎷栨嫿寮€濮?
  const handleDragStart = () => {
    document.body.classList.add('dragging');
  };

  // 澶勭悊鎷栨嫿缁撴潫
  const handleDragEnd = async (event: DragEndEvent) => {
    document.body.classList.remove('dragging');

    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // 鍙湪鏈畬鎴愪换鍔′腑鏌ユ壘绱㈠紩
    const pendingTasks = tasks.filter(task => !task.isCompleted);
    const oldIndex = pendingTasks.findIndex(task => task.id === active.id);
    const newIndex = pendingTasks.findIndex(task => task.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 閲嶆柊鎺掑垪鏈畬鎴愪换鍔?
    const newPendingTasks = arrayMove(pendingTasks, oldIndex, newIndex);

    // 鍚堝苟宸插畬鎴愪换鍔″拰閲嶆柊鎺掑簭鐨勬湭瀹屾垚浠诲姟
    const completedTasks = tasks.filter(task => task.isCompleted);
    const newTasks = [...newPendingTasks, ...completedTasks];
    setTasks(newTasks);

    // 鍙洿鏂版湭瀹屾垚浠诲姟鐨勬帓搴忛『搴?
    const taskOrders = newPendingTasks.map((task, index) => ({
      id: task.id,
      sortOrder: index,
    }));

    try {
      await taskAPI.updateTasksOrder(taskOrders);
    } catch (error) {
      console.error('????????:', error);
      // 濡傛灉鏇存柊澶辫触锛屾仮澶嶅師鏉ョ殑椤哄簭
      setTasks(tasks);
    }
  };

  // 澶勭悊鎷栨嫿鍙栨秷
  const handleDragCancel = () => {
    document.body.classList.remove('dragging');
  };

  // 鍔犺浇浠婃棩浠诲姟鍒楄〃
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
      // 鍓嶇鎸塻ortOrder閲嶆柊鎺掑簭
      const sortedTasks = [...loadedTasks].sort((a: any, b: any) => {
        // 鏈畬鎴愪换鍔″湪鍓嶏紝宸插畬鎴愪换鍔″湪鍚?
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1;
        }
        // 鍚岀被鍨嬩换鍔℃寜sortOrder鎺掑簭
        if (!a.isCompleted && !b.isCompleted) {
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        }
        // 宸插畬鎴愪换鍔℃寜鏇存柊鏃堕棿鎺掑簭
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      setTasks(sortedTasks);
    } catch (error) {
      console.error('????????:', error);
    } finally {
      if (useSilentRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
        setHasLoadedOnce(true);
      }
    }
  };

  // 鍒濆鍔犺浇
  useEffect(() => {
    loadTasks();
  }, []);

  // 褰撶暘鑼勯挓瀹屾垚鍒锋柊瑙﹀彂鍣ㄥ彉鍖栨椂锛岄噸鏂板姞杞戒换鍔″垪琛?
  useEffect(() => {
    if (pomodoroCompleteRefreshTrigger !== undefined && pomodoroCompleteRefreshTrigger > 0) {
      loadTasks({ silent: true });
    }
  }, [pomodoroCompleteRefreshTrigger]);

  // 褰撲换鍔″埛鏂拌Е鍙戝櫒鍙樺寲鏃讹紝閲嶆柊鍔犺浇浠诲姟鍒楄〃
  useEffect(() => {
    if (taskRefreshTrigger !== undefined && taskRefreshTrigger > 0) {
      console.log('Task refresh trigger changed, reloading tasks');
      loadTasks({ silent: true });
    }
  }, [taskRefreshTrigger]);

  // 娣诲姞鏂颁换鍔?
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

      // 涔愯鏇存柊锛氭坊鍔犲埌鏈畬鎴愪换鍔＄殑鏈€鍚?
      setTasks(prev => {
        const pendingTasks = prev.filter(t => !t.isCompleted);
        const completedTasks = prev.filter(t => t.isCompleted);
        return [...pendingTasks, newTask, ...completedTasks];
      });
      setNewTaskText('');
      setShowInput(false);

      // 璋冪敤API鍒涘缓浠诲姟
      const response = await taskAPI.createTask({
        title: newTask.title,
        isCompleted: false,
        priority: 1
      });

      // 鐢ㄧ湡瀹炵殑浠诲姟鏁版嵁鏇挎崲涓存椂浠诲姟
      setTasks(prev => prev.map(task =>
        task.id === tempId ? response.data : task
      ));

      // 閫氱煡Dashboard浠诲姟宸叉坊鍔?
      if (onTaskAdded) {
        onTaskAdded(response.data);
      }

      // 濡傛灉褰撳墠缁戝畾鐨勪换鍔℃槸涓存椂ID锛屾洿鏂颁负鐪熷疄ID
      if (currentBoundTask === tempId) {
        console.log('??????ID:', tempId, '->', response.data.id);
        // 浣跨敤涓撻棬鐨勬洿鏂版柟娉曪紝閬垮厤閲嶆柊缁戝畾
        if (onUpdatePomodoroTaskId) {
          onUpdatePomodoroTaskId(tempId, response.data.id);
        } else {
          // 鍏滃簳鏂规锛氶噸鏂扮粦瀹?
          onTaskClick(response.data.id, response.data.title);
        }
      }

    } catch (error) {
      console.error('添加任务失败:', error);
      alert('添加任务失败，请重试');

      // 澶辫触鏃剁Щ闄や复鏃朵换鍔?
      setTasks(prev => prev.filter(task => task.id !== tempId));
      setShowInput(true); // 閲嶆柊鏄剧ず杈撳叆妗?
    } finally {
      setIsAddingTask(false);
    }
  };

  // 鍒囨崲浠诲姟瀹屾垚鐘舵€?
  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    try {

      // 濡傛灉鏄瀹屾垚浠诲姟锛堜粠鏈畬鎴愬彉涓哄畬鎴愶級
      if (!currentStatus) {
        // 妫€鏌ユ槸鍚︽槸鐣寗閽熻繍琛屼腑鐨勭粦瀹氫换鍔?
        const isCurrentBoundTask = currentBoundTask === taskId;
        const isPomodoroRunning = isRunning && isCurrentBoundTask;

        if (isPomodoroRunning) {
          // 鐣寗閽熸鍦ㄨ繍琛屼腑锛屾牴鎹繍琛屾椂闂村喅瀹氬鐞嗘柟寮?
          if (pomodoroElapsedTime >= 300) { // 5鍒嗛挓 = 300绉?
            // 瓒呰繃5鍒嗛挓锛屽彲浠ユ甯稿畬鎴愪换鍔″苟璁″叆鐣寗鏁?
            if (onCompleteTaskWithPomodoro) {
              const confirmed = confirm('当前专注时长已达标，确定完成任务并结束计时吗？');
              if (confirmed) {
                onCompleteTaskWithPomodoro(taskId);
                return;
              } else {
                return; // 鐢ㄦ埛鍙栨秷锛屼笉鎵ц浠讳綍鎿嶄綔
              }
            }
          } else {
            // 涓嶈冻5鍒嗛挓锛屽畬鎴愪换鍔′絾涓嶈鍏ョ暘鑼勬暟
            if (onCompleteTaskCancelPomodoro) {
              const confirmed = confirm('当前专注时长未达标，确定取消计时并完成任务吗？');
              if (confirmed) {
                onCompleteTaskCancelPomodoro(taskId);
                return;
              } else {
                return; // 鐢ㄦ埛鍙栨秷锛屼笉鎵ц浠讳綍鎿嶄綔
              }
            }
          }
        }
      }

      // 璁剧疆鏇存柊鐘舵€?
      setUpdatingTasks(prev => ({ ...prev, [taskId]: true }));

      // 涔愯鏇存柊锛氱珛鍗虫洿鏂版湰鍦扮姸鎬?
      setTasks(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, isCompleted: !currentStatus }
          : task
      ));

      // 璋冪敤API鏇存柊
      await taskAPI.updateTask(taskId, {
        isCompleted: !currentStatus
      });
      dispatchAgentDataChanged(['tasks', 'studyPlan']);

      // 任务完成时 dispatch task_done 事件，触发 AI 主动推送
      if (!currentStatus) {
        const completedTask = tasks.find(t => t.id === taskId);
        window.dispatchEvent(
          new CustomEvent(PROACTIVE_TRIGGER_EVENT, {
            detail: {
              trigger: 'task_done',
              context: { taskId, taskTitle: completedTask?.title },
            },
          }),
        );
      }

    } catch (error) {
      console.error('????????:', error);
      alert('更新任务状态失败，请重试');

      // 澶辫触鏃舵仮澶嶅師鐘舵€?
      setTasks(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, isCompleted: currentStatus }
          : task
      ));
    } finally {
      // 娓呴櫎鏇存柊鐘舵€?
      setUpdatingTasks(prev => ({ ...prev, [taskId]: false }));
    }
  };

  // 鍒犻櫎浠诲姟
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？此操作不可恢复。')) return;

    try {
      await taskAPI.deleteTask(taskId);

      // 鏈湴绉婚櫎浠诲姟锛岄伩鍏嶉噸鏂板姞杞?
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('删除任务失败:', error);
      alert('删除任务失败，请重试');
    }
  };



  // 淇濆瓨浠诲姟缂栬緫
  const handleSaveEdit = async () => {
    if (!editingTaskId || !editingTaskTitle.trim()) {
      setEditingTaskId(null);
      setEditingTaskTitle('');
      return;
    }

    try {
      // 璁剧疆鏇存柊鐘舵€?
      setUpdatingTasks(prev => ({ ...prev, [editingTaskId]: true }));

      // 璋冪敤API鏇存柊浠诲姟鏍囬
      await taskAPI.updateTask(editingTaskId, {
        title: editingTaskTitle.trim()
      });

      // 鏈湴鏇存柊浠诲姟鐘舵€侊紝閬垮厤閲嶆柊鍔犺浇
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === editingTaskId
            ? { ...task, title: editingTaskTitle.trim() }
            : task
        )
      );

      // 娓呴櫎缂栬緫鐘舵€?
      setEditingTaskId(null);
      setEditingTaskTitle('');
    } catch (error) {
      console.error('??????:', error);
      alert('更新任务失败，请重试');
    } finally {
      // 娓呴櫎鏇存柊鐘舵€?
      setUpdatingTasks(prev => ({ ...prev, [editingTaskId]: false }));
    }
  };

  // 鍙栨秷缂栬緫
  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingTaskTitle('');
  };

  // 澶勭悊缂栬緫杈撳叆妗嗙殑閿洏浜嬩欢
  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };



  // 閿洏浜嬩欢澶勭悊
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    } else if (e.key === 'Escape') {
      setNewTaskText('');
      setShowInput(false);
    }
  };

  // 过滤任务
  const pendingTasks = tasks.filter(task => !task.isCompleted);
  const completedTasks = tasks.filter(task => task.isCompleted);
  const pct = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <span className={styles.title}>今日任务</span>
          </div>
        </div>
        <div style={{ padding: '32px 20px', color: 'var(--fg-4)', fontSize: 13, textAlign: 'center' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      {/* 列头 */}
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <span className={styles.title}>今日任务</span>
          {refreshing && <span style={{ fontSize: 10, color: 'var(--fg-4)', marginLeft: 6 }}>刷新中</span>}
        </div>
        <span className={styles.meta}>
          <span style={{ color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>{completedTasks.length}</span>
          <span style={{ color: 'var(--fg-4)' }}> / {tasks.length}</span>
        </span>
      </div>

      {/* 进度条 */}
      <div className={styles.progressBlock}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* 任务列表（可滚动） */}
      <div className={styles.scrollArea}>
        <div className={styles.list}>
          {pendingTasks.length === 0 && completedTasks.length === 0 && !showInput ? (
            <div className={styles.empty}>
              <CheckSquare size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <span>今日暂无任务</span>
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
                      onEditTask={(t) => {
                        setEditingTaskId(t.id);
                        setEditingTaskTitle(t.title);
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

          {/* 添加表单 / 按钮：紧跟任务列表末尾 */}
          {showInput ? (
            <div className={styles.addForm}>
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="任务标题，回车确认"
                className={styles.addInput}
                disabled={isAddingTask}
                autoFocus
              />
              <div className={styles.addActions}>
                <button
                  onClick={handleAddTask}
                  className={styles.addPrimaryButton}
                  disabled={!newTaskText.trim() || isAddingTask}
                >
                  {isAddingTask ? '添加中...' : <><Plus size={12} /> 添加</>}
                </button>
                <button
                  onClick={() => { setShowInput(false); setNewTaskText(''); }}
                  className={styles.addCloseButton}
                  disabled={isAddingTask}
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowInput(true)} className={styles.addInlineBtn}>
              <Plus size={12} /> 添加任务
            </button>
          )}
        </div>

        {/* 已完成折叠 */}
        {completedTasks.length > 0 && (
          <details className={styles.completedWrap}>
            <summary className={styles.summary}>
              <span className={styles.completedArrow}>▸</span>
              已完成 ({completedTasks.length})
            </summary>
            <div className={styles.completedList}>
              {completedTasks.map(task => (
                <div key={task.id} className={styles.completedItem}>
                  <button
                    onClick={() => handleToggleTask(task.id, task.isCompleted)}
                    className={styles.checkboxDone}
                    disabled={updatingTasks[task.id]}
                    title="撤销完成"
                  >
                    {!updatingTasks[task.id] && <Check size={10} />}
                  </button>
                  <span className={styles.completedTitle}>{task.title}</span>
                  {(task.pomodoroCount || 0) > 0 && (
                    <span className={styles.pomodoroBadge}>🍅 {task.pomodoroCount}</span>
                  )}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className={styles.deleteCompletedBtn}
                    title="删除"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

    </div>
  );
};

export default PendingTasks;
