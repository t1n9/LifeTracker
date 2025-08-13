'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { userAPI, studyAPI, taskAPI, api } from '@/lib/api';
import HistoryViewer from './HistoryViewer';
import PomodoroTimer from './PomodoroTimer';
import PendingTasks from './PendingTasks';
import ImportantInfo from './ImportantInfo';
import ExerciseStats from './ExerciseStats';
import ExpenseStats from './ExpenseStats';
import ChangePasswordForm from './auth/ChangePasswordForm';


// CSS变量样式
const cssVariables = `
:root {
  --bg-primary: #f8f9fa;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f1f3f4;
  --text-primary: #2d3748;
  --text-secondary: #4a5568;
  --text-muted: #718096;
  --border-color: #e2e8f0;
  --accent-primary: #4299e1;
  --accent-secondary: #63b3ed;
  --success-color: #48bb78;
  --warning-color: #ed8936;
  --error-color: #f56565;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  line-height: 1.6;
  font-weight: 400;
}

[data-theme="dark"] {
  --bg-primary: #1a202c;
  --bg-secondary: #2d3748;
  --bg-tertiary: #4a5568;
  --text-primary: #f7fafc;
  --text-secondary: #e2e8f0;
  --text-muted: #cbd5e0;
  --border-color: #4a5568;
  --accent-primary: #4299e1;
  --accent-secondary: #63b3ed;
  --success-color: #48bb78;
  --warning-color: #ed8936;
  --error-color: #f56565;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.4);
}

.container {
  max-width: 1800px;
  margin: 0 auto;
  padding: 0 1rem;
}

.card {
  background-color: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  gap: 0.5rem;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.btn-primary {
  background-color: var(--accent-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--accent-secondary);
}

.btn-secondary {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background-color: var(--border-color);
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
}

.dashboard-header {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.dashboard-layout {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1.5rem;
  max-width: 1800px;
  margin: 0 auto;
  align-items: start;
}

.dashboard-left,
.dashboard-center,
.dashboard-right {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 100%;
}

/* 确保三列高度同步 */
@media (min-width: 1026px) {
  .dashboard-layout {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr;
    align-items: stretch;
  }

  .dashboard-left,
  .dashboard-center,
  .dashboard-right {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  /* 让最后一个卡片自动填充剩余空间 */
  .dashboard-left > .card:last-child,
  .dashboard-center > .card:last-child,
  .dashboard-right > .card:last-child {
    flex: 1;
  }
}

@media (max-width: 1025px) and (min-width: 769px) {
  .dashboard-layout {
    grid-template-columns: 1fr 1fr;
  }
  .dashboard-right {
    grid-column: 1;
    grid-row: 2;
  }
}

@media (max-width: 768px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .container {
    padding: 0 0.5rem;
  }
  .card {
    padding: 1rem;
  }
}

.theme-toggle {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: all 0.2s ease;
  font-size: 1.2rem;
}

.theme-toggle:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-lg);
}



.input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: border-color 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.875rem; }
.text-lg { font-size: 1.125rem; }
.text-xl { font-size: 1.25rem; }
.text-2xl { font-size: 1.5rem; }
.text-3xl { font-size: 1.875rem; }
.text-4xl { font-size: 2.25rem; }

.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.font-medium { font-weight: 500; }

.text-center { text-align: center; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-6 { margin-bottom: 1.5rem; }

.flex { display: flex; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.gap-2 { gap: 0.5rem; }
.gap-4 { gap: 1rem; }

.grid { display: grid; }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }

.min-h-screen { min-height: 100vh; }

/* 运动按钮特殊效果 */
.exercise-btn:hover {
  transform: translateY(-1px) scale(1.02);
  filter: brightness(1.1);
}

/* 底部导航链接效果 */
.footer-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: var(--shadow);
}

.footer-link:hover {
  background-color: var(--accent-primary);
  color: white;
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-primary);
}

/* 圆形按钮效果 */
.btn-circle {
  border-radius: 50% !important;
  width: 40px;
  height: 40px;
  padding: 0 !important;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-circle:hover {
  transform: translateY(-1px) scale(1.05);
}

/* 功能按钮样式 - 与跳转按钮统一 */
.footer-action {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--accent-primary);
  border: 1px solid var(--accent-primary);
  border-radius: 8px;
  color: white;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: var(--shadow);
  cursor: pointer;
}

.footer-action:hover {
  background-color: var(--accent-secondary);
  border-color: var(--accent-secondary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

/* 番茄时钟样式 */
.pomodoro-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.pomodoro-circle {
  position: relative;
  width: 200px;
  height: 200px;
}

.pomodoro-svg {
  width: 100%;
  height: 100%;
  transform: rotate(0deg);
}

.pomodoro-progress {
  transition: stroke-dashoffset 1s ease-in-out;
}

.pomodoro-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 10;
}

.pomodoro-time {
  font-size: 1.5rem;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

/* 正计时圈数指示器 */
.count-up-cycle-indicator {
  margin-bottom: 0.5rem;
}

.cycle-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.cycle-emoji {
  font-size: 0.875rem;
}

.cycle-text {
  font-weight: 500;
}

/* 3小时限制提示样式 */
.pomodoro-status.paused {
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(251, 146, 60, 0.1));
  border: 1px solid rgba(249, 115, 22, 0.3);
}

.pomodoro-status.paused:has-text("3小时") {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(248, 113, 113, 0.1));
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--error-color);
}

.pomodoro-controls {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.pomodoro-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pomodoro-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pomodoro-btn-start {
  background-color: var(--success-color);
  color: white;
}

.pomodoro-btn-start:hover {
  background-color: #16a34a;
  transform: scale(1.1);
}

.pomodoro-btn-pause {
  background-color: var(--warning-color);
  color: white;
}

.pomodoro-btn-pause:hover {
  background-color: #d97706;
  transform: scale(1.1);
}

.pomodoro-btn-reset {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.pomodoro-btn-reset:hover {
  background-color: var(--border-color);
  transform: scale(1.1);
}

.pomodoro-btn-focus {
  background-color: var(--accent-primary);
  color: white;
  border: 1px solid var(--accent-primary);
}

.pomodoro-btn-focus:hover {
  background-color: var(--accent-secondary);
  border-color: var(--accent-secondary);
  transform: scale(1.1);
}

.pomodoro-slider {
  width: 100%;
  max-width: 200px;
}

.time-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-tertiary);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.time-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent-primary);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.time-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent-primary);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.pomodoro-status {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  text-align: center;
  font-weight: 500;
}

.pomodoro-status.completed {
  background-color: rgba(34, 197, 94, 0.1);
  color: var(--success-color);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.pomodoro-status.paused {
  background-color: rgba(249, 115, 22, 0.1);
  color: var(--warning-color);
  border: 1px solid rgba(249, 115, 22, 0.2);
}

.pomodoro-status.running {
  background-color: rgba(249, 115, 22, 0.1);
  color: var(--warning-color);
  border: 1px solid rgba(249, 115, 22, 0.2);
}

/* 任务绑定样式 */
.pomodoro-task-binding {
  width: 100%;
  max-width: 200px;
  margin-bottom: 1rem;
}

.task-binding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.task-selector-toggle {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-selector-toggle:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-primary);
}

.task-selector-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: var(--shadow-lg);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}

.task-option {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: 0.875rem;
  border-bottom: 1px solid var(--border-color);
}

.task-option:last-child {
  border-bottom: none;
}

.task-option:hover {
  background: var(--bg-tertiary);
}

.task-option.selected {
  background: var(--accent-primary);
  color: white;
}

.task-option span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 专注模式样式 */
.focus-mode {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, var(--bg-primary), var(--bg-secondary));
  z-index: 9999;
  display: flex;
  flex-direction: column;
  animation: focusModeEnter 0.3s ease-out;
}

@keyframes focusModeEnter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.focus-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border-color);
}

.focus-header-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.focus-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.focus-icon {
  font-size: 1.5rem;
}

.focus-theme-toggle {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.focus-theme-toggle:hover {
  background-color: var(--bg-tertiary);
  border-color: var(--accent-primary);
}

.focus-exit-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.focus-exit-btn:hover {
  background-color: var(--error-color);
  border-color: var(--error-color);
  color: white;
}

.focus-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.focus-timer {
  text-align: center;
  max-width: 500px;
  width: 100%;
}

.focus-time {
  font-size: 4rem;
  font-weight: 700;
  color: var(--accent-primary);
  margin-bottom: 1rem;
  font-family: 'Courier New', monospace;
  animation: focusTimePulse 2s ease-in-out infinite;
}

@keyframes focusTimePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.focus-mode-indicator {
  font-size: 1rem;
  color: var(--success-color);
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 500;
  background: rgba(34, 197, 94, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.focus-task {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--warning-color);
  margin-bottom: 2rem;
  padding: 0.75rem 1.5rem;
  background: rgba(249, 115, 22, 0.1);
  border-radius: 12px;
  border: 2px solid rgba(249, 115, 22, 0.3);
}

.focus-progress-container {
  margin-bottom: 2rem;
}

.focus-progress-bar {
  width: 100%;
  height: 8px;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.focus-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary), var(--warning-color));
  border-radius: 4px;
  transition: width 0.3s ease;
}

.focus-progress-text {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-weight: 500;
}

.focus-controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.focus-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.focus-btn-start {
  background-color: var(--success-color);
  color: white;
}

.focus-btn-start:hover {
  background-color: #38a169;
  transform: translateY(-1px);
}

.focus-btn-pause {
  background-color: var(--warning-color);
  color: white;
}

.focus-btn-pause:hover {
  background-color: #dd6b20;
  transform: translateY(-1px);
}

.focus-btn-reset {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.focus-btn-reset:hover {
  background-color: var(--border-color);
  transform: translateY(-1px);
}

.focus-quote {
  font-size: 1.125rem;
  color: var(--text-secondary);
  font-style: italic;
  animation: focusQuoteFade 0.5s ease-in-out;
}

@keyframes focusQuoteFade {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.focus-footer {
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

.focus-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  font-size: 1rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.focus-divider {
  color: var(--border-color);
}

.focus-shortcuts {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  opacity: 0.7;
}

.focus-shortcuts span {
  background-color: var(--bg-tertiary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

/* 休息模式样式 */
.break-mode {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  animation: breakModeEnter 0.3s ease-out;
}

[data-theme="dark"] .break-mode {
  background: linear-gradient(135deg, #1e293b, #334155);
}

@keyframes breakModeEnter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.break-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.8);
}

[data-theme="dark"] .break-header {
  background-color: rgba(45, 55, 72, 0.8);
}

.break-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.break-header-actions {
  display: flex;
  gap: 0.5rem;
}

.break-theme-toggle,
.break-close-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.break-theme-toggle:hover,
.break-close-btn:hover {
  background-color: var(--bg-tertiary);
  border-color: var(--accent-primary);
}

.break-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.break-timer {
  text-align: center;
  max-width: 500px;
  width: 100%;
}

.break-time {
  font-size: 3.5rem;
  font-weight: 700;
  color: #0ea5e9;
  margin-bottom: 1rem;
  font-family: 'Courier New', monospace;
}

.break-type-info {
  font-size: 1.25rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
  padding: 0.75rem 1.5rem;
  background: rgba(14, 165, 233, 0.1);
  border-radius: 12px;
  border: 2px solid rgba(14, 165, 233, 0.3);
}

.break-progress-container {
  margin-bottom: 2rem;
}

.break-progress-bar {
  width: 100%;
  height: 8px;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.break-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0ea5e9, #06b6d4);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.break-progress-text {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-weight: 500;
}

.break-suggestion {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(14, 165, 233, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(14, 165, 233, 0.2);
}

.break-suggestion-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.break-suggestion-text {
  font-size: 1.125rem;
  color: var(--text-secondary);
  animation: breakTipFade 0.5s ease-in-out;
}

@keyframes breakTipFade {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.break-controls {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
}

.break-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.break-btn-skip {
  background-color: #0ea5e9;
  color: white;
}

.break-btn-skip:hover {
  background-color: #0284c7;
  transform: translateY(-1px);
}

.break-footer {
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.8);
}

[data-theme="dark"] .break-footer {
  background-color: rgba(45, 55, 72, 0.8);
}

.break-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  font-size: 1rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.break-divider {
  color: var(--border-color);
}

.break-shortcuts {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  opacity: 0.7;
}

.break-shortcuts span {
  background-color: var(--bg-tertiary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

/* 待完成任务样式 */
.pending-task-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  transition: all 0.2s ease;
  cursor: pointer;
}

.pending-task-item:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.pending-task-item.bound {
  background: rgba(249, 115, 22, 0.15);
  border-color: var(--warning-color);
  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2);
}

.pending-task-item .task-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.pending-task-item .task-checkbox:hover {
  border-color: var(--success-color);
  background: rgba(34, 197, 94, 0.1);
}

.pending-task-item .task-checkbox.checked {
  background: var(--success-color);
  border-color: var(--success-color);
}

.pending-task-item .task-checkbox:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pending-task-item .task-checkbox:disabled:hover {
  border-color: var(--border-color);
  background: var(--bg-primary);
}

.pending-task-item .task-content {
  flex: 1;
  min-width: 0;
}

.pending-task-item .task-title {
  font-weight: 500;
  color: var(--text-primary);
  word-break: break-word;
}

.pending-task-item .task-title.completed {
  text-decoration: line-through;
  color: var(--text-muted);
}

.pending-task-item .task-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}



/* 番茄数量徽章 */
.pomodoro-count-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.375rem;
  background: rgba(239, 68, 68, 0.1);
  color: var(--accent-primary);
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.pending-task-item .bound-indicator {
  display: flex;
  align-items: center;
  color: var(--warning-color);
  font-size: 0.75rem;
}

.pending-task-item .task-actions {
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.pending-task-item:hover .task-actions {
  opacity: 1;
}

.pending-task-item .action-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pending-task-item .action-btn.start-btn {
  background: var(--success-color);
  color: white;
}

.pending-task-item .action-btn.start-btn:hover:not(.disabled) {
  background: #16a34a;
  transform: scale(1.1);
}

.pending-task-item .action-btn.start-btn.disabled {
  background: var(--bg-tertiary);
  color: var(--text-muted);
  cursor: not-allowed;
}

.pending-task-item .action-btn.delete-btn {
  background: var(--error-color);
  color: white;
}

.pending-task-item .action-btn.delete-btn:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.completed-task-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  background: var(--bg-tertiary);
  opacity: 0.7;
}

.completed-task-item .task-checkbox {
  width: 16px;
  height: 16px;
  border: 2px solid var(--success-color);
  border-radius: 3px;
  background: var(--success-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.completed-task-item .task-checkbox:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.add-task-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.add-task-form .task-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s ease;
}

.add-task-form .task-input:focus {
  border-color: var(--accent-primary);
}

.add-task-form .form-actions {
  display: flex;
  gap: 0.5rem;
}

.add-task-form .btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-task-form .btn.btn-primary {
  background: var(--accent-primary);
  color: white;
  flex: 1;
}

.add-task-form .btn.btn-primary:hover:not(:disabled) {
  background: var(--accent-secondary);
  transform: translateY(-1px);
}

.add-task-form .btn.btn-primary:disabled {
  background: var(--bg-tertiary);
  color: var(--text-muted);
  cursor: not-allowed;
}

.add-task-form .btn.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.add-task-form .btn.btn-secondary:hover {
  background: var(--border-color);
}

.add-task-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-task-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: rgba(249, 115, 22, 0.05);
}


`;

export default function Dashboard() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [user, setUser] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState<'dark' | 'light'>('light'); // 默认浅色，等用户数据加载后再设置
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const [tasks, setTasks] = useState<Array<{
    id: string,
    title: string,
    isCompleted: boolean,
    pomodoroCount?: number,
    description?: string,
    priority?: number
  }>>([]);
  const [currentBoundTask, setCurrentBoundTask] = useState<string | null>(null);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [startCountUpMode, setStartCountUpMode] = useState<{taskId: string, taskTitle: string} | null>(null);

  // 学习时长相关状态
  const [studyTime, setStudyTime] = useState(0); // 总学习时长（分钟）
  const [pomodoroCount, setPomodoroCount] = useState(0); // 番茄钟数量
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [showUndo, setShowUndo] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(10);
  const [lastAddedMinutes, setLastAddedMinutes] = useState(0);
  const [lastAddedRecordId, setLastAddedRecordId] = useState<string | null>(null);

  // 加载用户数据
  const loadUserData = async () => {
    try {
      const response = await userAPI.getProfile();
      setUser(response.data);
    } catch (error) {
      console.error('加载用户数据失败:', error);
    }
  };

  // 主题切换处理
  const handleThemeToggle = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);

    try {
      // 同步到后端
      await userAPI.updateTheme(newTheme);
      console.log(`🎨 主题已切换为: ${newTheme}`);
    } catch (error) {
      console.error('主题更新失败:', error);
      // 如果失败，回滚主题
      setTheme(theme);
    }
  };

  // 应用主题到document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 初始化主题（从用户配置加载）
  useEffect(() => {
    if (user?.theme) {
      const userTheme = user.theme === 'dark' ? 'dark' : 'light';
      console.log(`🎨 从用户配置加载主题: ${userTheme}`);
      setTheme(userTheme);
    }
  }, [user?.theme]);

  // 加载今日学习数据
  const loadTodayStats = async () => {
    try {
      const response = await studyAPI.getTodayStats();
      const stats = response.data;
      setStudyTime(stats.totalMinutes);
      setPomodoroCount(stats.pomodoroCount);
    } catch (error) {
      console.error('加载今日学习数据失败:', error);
    }
  };

  // 加载任务列表
  const loadTasks = async () => {
    try {
      const response = await taskAPI.getTasks();
      const tasksData = response.data.map((task: {
        id: string,
        title: string,
        isCompleted: boolean,
        pomodoroCount?: number,
        description?: string,
        priority?: number
      }) => ({
        id: task.id,
        title: task.title,
        isCompleted: task.isCompleted,
        pomodoroCount: task.pomodoroCount || 0,
        description: task.description,
        priority: task.priority
      }));
      setTasks(tasksData);
    } catch (error) {
      console.error('加载任务列表失败:', error);
    }
  };

  // 处理任务点击（切换绑定状态）
  const handleTaskClick = (taskId: string, taskTitle: string) => {
    if (isPomodoroRunning) {
      alert('番茄钟正在运行中，无法更换绑定任务');
      return;
    }

    // 如果当前任务已绑定，则取消绑定；否则绑定该任务
    if (currentBoundTask === taskId) {
      console.log(`🔓 取消绑定任务: ${taskTitle} (${taskId})`);
      setCurrentBoundTask(null);
    } else {
      console.log(`🎯 绑定任务到番茄钟: ${taskTitle} (${taskId})`);
      setCurrentBoundTask(taskId);
    }
  };

  // 处理正计时开始
  const handleStartCountUp = (taskId: string, taskTitle: string) => {
    if (isPomodoroRunning) {
      alert('番茄钟正在运行中，请先停止当前番茄钟');
      return;
    }

    console.log(`⏱️ 开始正计时: ${taskTitle} (${taskId})`);
    setCurrentBoundTask(taskId);
    setStartCountUpMode({taskId, taskTitle});

    // 重置标志
    setTimeout(() => {
      setStartCountUpMode(null);
    }, 100);
  };

  useEffect(() => {
    loadUserData();
    loadTodayStats();
    loadTasks();
  }, []);

  // 实时时间更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 学习时长相关函数
  const formatStudyTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}分钟`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
    }
  };

  const addStudyTime = async (minutes: number) => {
    try {
      // 保存到数据库
      const response = await studyAPI.createStudyRecord({
        duration: minutes,
        subject: '手动添加',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      // 重新加载今日数据，而不是简单累加
      await loadTodayStats();
      setLastAddedMinutes(minutes);
      setLastAddedRecordId(response.data.id);
      showUndoButton();
    } catch (error) {
      console.error('保存学习记录失败:', error);
      alert('保存学习记录失败，请重试');
    }
  };

  const handleCustomTimeAdd = () => {
    const minutes = parseInt(customMinutes);
    if (minutes > 0 && minutes <= 600) { // 限制最大10小时
      addStudyTime(minutes);
      setCustomMinutes('');
      setShowTimeInput(false);
    } else if (minutes > 600) {
      alert('单次学习时长不能超过10小时，请分次记录');
    }
  };

  const showUndoButton = () => {
    // 清除之前的定时器（如果存在）
    if ((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer) {
      clearInterval((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer);
    }

    setShowUndo(true);
    setUndoCountdown(10);

    // 开始倒计时
    (window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 1) {
          clearInterval((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer!);
          setShowUndo(false);
          setLastAddedMinutes(0);
          setLastAddedRecordId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleUndo = async () => {
    if (lastAddedMinutes > 0 && lastAddedRecordId) {
      try {
        // 从数据库中删除记录
        await studyAPI.deleteStudyRecord(lastAddedRecordId);

        // 重新加载今日数据
        await loadTodayStats();

        // 清除定时器和状态
        if ((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer) {
          clearInterval((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer);
        }
        setShowUndo(false);
        setLastAddedMinutes(0);
        setLastAddedRecordId(null);
      } catch (error) {
        console.error('撤销学习记录失败:', error);
        alert('撤销失败，请重试');
      }
    }
  };



  // 清理定时器
  useEffect(() => {
    return () => {
      if ((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer) {
        clearInterval((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer);
      }
    };
  }, []);

  // 退出登录
  const handleLogout = () => {
    logout();
  };

  // 时间格式化函数
  const formatCurrentTime = () => {
    return currentTime.toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCurrentDate = () => {
    return currentTime.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    });
  };



  // 计算倒计时
  const getTargetInfo = () => {
    // 优先使用用户设置的考试日期，其次是目标日期
    const examDate = user?.examDate;
    const targetDate = user?.targetDate;
    const targetName = user?.targetName;

    let finalDate = null;
    let displayName = '';
    let hasTarget = false;

    if (examDate) {
      finalDate = new Date(examDate);
      displayName = targetName || '考研';
      hasTarget = true;
    } else if (targetDate) {
      finalDate = new Date(targetDate);
      displayName = targetName || '';
      hasTarget = true;
    }

    return { date: finalDate, name: displayName, hasTarget };
  };

  const { date: targetDate, name: targetName, hasTarget } = getTargetInfo();
  const daysLeft = hasTarget && targetDate ? Math.ceil((targetDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <style dangerouslySetInnerHTML={{ __html: cssVariables }} />
      
      {/* 主题切换按钮 */}
      <button
        onClick={handleThemeToggle}
        className="theme-toggle"
        title={`切换到${theme === 'dark' ? '浅色' : '深色'}主题`}
      >
        {theme === 'dark' ? '🌙' : '☀️'}
      </button>

      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
        {/* 页面标题 */}
        <header className="dashboard-header">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              生活记录系统 <span className="text-2xl" style={{ color: 'var(--text-muted)' }}>v2.0</span>
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>记录每一天的努力，见证成长的足迹</p>
            
            {/* 用户信息和退出按钮 */}
            <div className="flex justify-center items-center gap-4" style={{ marginTop: '1rem' }}>
              <span
                className="text-sm"
                style={{
                  color: 'var(--text-secondary)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px'
                }}
              >
                欢迎，{user?.name || user?.email}
              </span>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                退出
              </button>
            </div>
          </div>
        </header>

        {/* 三栏布局 */}
        <div className="dashboard-layout">
          {/* 左列：倒计时、学习时长和番茄时钟 */}
          <div className="dashboard-left">
            {/* 时间信息卡片 */}
            <div className="card" style={{
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              color: 'white'
            }}>
              <h2 className="text-xl font-semibold mb-4">
                {hasTarget ? (targetName ? `${targetName}倒计时` : '倒计时') : '时间信息'}
              </h2>

              {hasTarget ? (
                // 有目标时显示完整的倒计时信息
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatCurrentTime()}</div>
                    <div className="text-sm opacity-80">当前时间</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{daysLeft}天</div>
                    <div className="text-sm opacity-80">倒计时</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatCurrentDate()}</div>
                    <div className="text-sm opacity-80">当前日期</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {targetDate?.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                    </div>
                    <div className="text-sm opacity-80">目标日期</div>
                  </div>
                </div>
              ) : (
                // 没有目标时只显示当前时间和日期
                <div className="grid grid-cols-1 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{formatCurrentTime()}</div>
                    <div className="text-sm opacity-80">当前时间</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{formatCurrentDate()}</div>
                    <div className="text-sm opacity-80">当前日期</div>
                  </div>
                </div>
              )}
            </div>

            {/* 学习统计卡片 */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <span style={{ fontSize: '1.25rem' }}>📚</span>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>学习时长</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatStudyTime(studyTime)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>今日学习</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {pomodoroCount}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>番茄钟</div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>今日进度</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {Math.round((studyTime / 360) * 100)}%
                </span>
              </div>

              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min((studyTime / 360) * 100, 100)}%`,
                  height: '100%',
                  backgroundColor: 'var(--accent-primary)',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                目标：6小时
              </div>

              {/* 添加时长按钮或输入框 */}
              {!showTimeInput ? (
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '1rem' }}
                  onClick={() => setShowTimeInput(true)}
                >
                  <span>+</span>
                  <span>添加时长</span>
                </button>
              ) : (
                <div style={{ marginTop: '1rem' }}>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      placeholder="输入分钟数"
                      min="1"
                      max="600"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCustomTimeAdd();
                        }
                      }}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleCustomTimeAdd}
                      disabled={!customMinutes || parseInt(customMinutes) <= 0}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      添加
                    </button>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                    onClick={() => {
                      setShowTimeInput(false);
                      setCustomMinutes('');
                    }}
                  >
                    取消
                  </button>
                </div>
              )}

              {/* 撤销按钮 */}
              {showUndo && (
                <div style={{ marginTop: '1rem' }}>
                  <button
                    className="btn"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--warning-color)',
                      color: 'white',
                      fontSize: '0.875rem'
                    }}
                    onClick={handleUndo}
                  >
                    撤销 ({undoCountdown}s)
                  </button>
                </div>
              )}
            </div>

            {/* 番茄时钟卡片 */}
            <PomodoroTimer
              tasks={tasks}
              currentBoundTask={currentBoundTask}
              studyTime={studyTime}
              pomodoroCount={pomodoroCount}
              theme={theme}
              startCountUpTrigger={startCountUpMode}
              onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              onTaskBind={(taskId) => {
                setCurrentBoundTask(taskId);
                console.log('🔗 任务绑定:', taskId);
              }}
              onRunningStateChange={(isRunning) => {
                setIsPomodoroRunning(isRunning);
                console.log('🍅 番茄钟运行状态:', isRunning);
              }}
              onPomodoroComplete={() => {
                // 番茄钟完成后重新加载今日数据
                loadTodayStats();
              }}
              onEnterFocusMode={() => {
                // 进入专注模式的处理逻辑
                console.log('进入专注模式');
              }}
            />
          </div>

          {/* 中列：待办任务 */}
          <div className="dashboard-center">
            <PendingTasks
              onTaskClick={handleTaskClick}
              onStartCountUp={handleStartCountUp}
              currentBoundTask={currentBoundTask}
              isRunning={isPomodoroRunning}
            />
          </div>

          {/* 右列：重要信息和统计信息 */}
          <div className="dashboard-right">
            {/* 重要信息卡片 */}
            <ImportantInfo theme={theme} />

            {/* 运动统计卡片 */}
            <ExerciseStats theme={theme} />

            {/* 消费统计卡片 */}
            <ExpenseStats theme={theme} />
          </div>
        </div>
      </div>

      {/* 底部导航 */}
      <footer style={{
        marginTop: '3rem',
        padding: '2rem 0',
        background: 'linear-gradient(to bottom, transparent, var(--bg-tertiary))',
        borderTop: '1px solid var(--border-color)'
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 2rem'
        }}>
          <h4 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
            快速导航
          </h4>
          <div className="flex justify-center items-center gap-3 flex-wrap">
            {[
              { name: '🚢 启航', href: 'https://www.iqihang.com/ark/myCourse' },
              { name: '🏫 内部网', href: 'https://www1.szu.edu.cn/' },
              { name: '📋 公文通', href: 'https://www1.szu.edu.cn/board/' },
              { name: '🏢 办事大厅', href: 'http://ehall.szu.edu.cn/new/index.html' },
              { name: '🎓 研招网', href: 'https://yz.chsi.com.cn/' }
            ].map((item) => (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                {item.name}
              </a>
            ))}

            {/* 功能按钮 */}
            {[
              { name: '🌅 开启', action: 'start' },
              { name: '🌙 复盘', action: 'review' },
              { name: '📊 历史', action: 'history' },
              { name: '⚙️ 配置', action: 'settings' }
            ].map((item) => (
              <button
                key={item.name}
                className="footer-action"
                onClick={() => {
                  if (item.action === 'history') {
                    setIsHistoryOpen(true);
                  } else if (item.action === 'settings') {
                    router.push('/profile');
                  } else {
                    // 其他功能按钮的处理逻辑
                    console.log(`点击了${item.action}`);
                  }
                }}
              >
                {item.name}
              </button>
            ))}
          </div>

          {/* ICP备案信息 */}
          <div style={{
            marginTop: '2rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <a
              href="https://beian.miit.gov.cn"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                textDecoration: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'color 0.2s ease'
              }}
              onMouseOver={(e) => {
                (e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)';
              }}
              onMouseOut={(e) => {
                (e.target as HTMLAnchorElement).style.color = 'var(--text-muted)';
              }}
            >
              粤ICP备2025456526号-1
            </a>
          </div>
        </div>
      </footer>

      {/* 历史查看器 */}
      <HistoryViewer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* 修改密码表单 */}
      {isChangePasswordOpen && (
        <ChangePasswordForm
          onClose={() => setIsChangePasswordOpen(false)}
          onSuccess={() => {
            // 密码修改成功后的处理
            console.log('密码修改成功');
          }}
        />
      )}

    </div>
  );
}
