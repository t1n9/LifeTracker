'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  GripVertical,
  History,
  LayoutDashboard,
  Pencil,
  Play,
  PlayCircle,
  Target,
  Timer,
  TimerReset,
  Trash2,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import '@/styles/theme.css';
import dashboardStyles from '@/components/Dashboard.module.css';
import pendingStyles from '@/components/PendingTasks.module.css';
import pomodoroStyles from '@/components/PomodoroTimer.module.css';

const DEFAULT_DAILY_GOAL_MINUTES = 360;

const staticTasks = [
  { id: '1', title: '完成线性代数作业第 4 章', done: false },
  { id: '2', title: '整理产品需求文档并补充验收标准', done: false },
  { id: '3', title: '阅读 30 分钟英语材料', done: true },
];

export default function ExamplePage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.add('dark');
  }, [theme]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayLabel = useMemo(
    () =>
      currentTime.toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
    [currentTime],
  );

  const timeLabel = useMemo(
    () =>
      currentTime.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
    [currentTime],
  );

  return (
    <div className={dashboardStyles.page}>
      <Navbar theme={theme} onThemeToggle={() => undefined} demoCtaHref="https://t1n9.xyz" demoCtaLabel="Try!" />

      <main className={dashboardStyles.main}>
        <section className={dashboardStyles.hero}>
          <div className={dashboardStyles.heroCopy}>
            <div className={dashboardStyles.heroBadge}>
              <span className={dashboardStyles.heroBadgeDot} />
              <span>Today workspace</span>
            </div>
            <p className={dashboardStyles.heroEyebrow}>{todayLabel}</p>
            <h1 className={dashboardStyles.heroTitle}>这是示例页面，所有操作均为静态演示。</h1>
            <p className={dashboardStyles.heroDescription}>
              这里完整复用首页视觉样式。输入框、按钮、记录与计时都不会写入数据，仅用于体验界面效果。
            </p>

            <div className={dashboardStyles.quickActions}>
              <button type="button" className={dashboardStyles.primaryAction}>
                <PlayCircle size={16} />
                <span>开启今天</span>
              </button>
              <button type="button" className={dashboardStyles.secondaryAction}>
                <BookOpenText size={16} />
                <span>今日复盘</span>
              </button>
              <button type="button" className={dashboardStyles.secondaryAction}>
                <History size={16} />
                <span>历史记录</span>
              </button>
              <button type="button" className={dashboardStyles.secondaryAction}>
                <LayoutDashboard size={16} />
                <span>数据概览</span>
              </button>
            </div>
          </div>

          <div className={dashboardStyles.heroMetrics}>
            <div className={`${dashboardStyles.metricCard} ${dashboardStyles.metricCardAccent}`}>
              <div className={dashboardStyles.metricLabel}>当前目标</div>
              <div className={dashboardStyles.metricValue}>通过 Java 考试</div>
              <div className={dashboardStyles.metricMeta}>保持节奏，每天推进一点。</div>
              <div className={dashboardStyles.goalFooter}>
                <span className={dashboardStyles.goalDate}>2026年6月30日</span>
                <span className={dashboardStyles.goalCountdown}>70 天</span>
              </div>
            </div>

            <div className={dashboardStyles.metricGrid}>
              <div className={dashboardStyles.metricCard}>
                <div className={dashboardStyles.metricLabel}>当前时间</div>
                <div className={dashboardStyles.metricValue}>{timeLabel}</div>
                <div className={dashboardStyles.metricMeta}>保持今天的推进节奏</div>
              </div>
              <div className={dashboardStyles.metricCard}>
                <div className={dashboardStyles.metricLabel}>今日专注</div>
                <div className={dashboardStyles.metricValue}>4</div>
                <div className={dashboardStyles.metricMeta}>已完成番茄钟</div>
              </div>
              <div className={dashboardStyles.metricCard}>
                <div className={dashboardStyles.metricLabel}>待办任务</div>
                <div className={dashboardStyles.metricValue}>2</div>
                <div className={dashboardStyles.metricMeta}>1 项已完成</div>
              </div>
              <div className={dashboardStyles.metricCard}>
                <div className={dashboardStyles.metricLabel}>学习时长</div>
                <div className={dashboardStyles.metricValue}>3 小时 20 分</div>
                <div className={dashboardStyles.metricMeta}>目标 {DEFAULT_DAILY_GOAL_MINUTES / 60} 小时</div>
              </div>
            </div>
          </div>
        </section>

        <section className={dashboardStyles.focusArea}>
          <div className={dashboardStyles.primaryColumn}>
            <div className={dashboardStyles.sectionHeader}>
              <div>
                <p className={dashboardStyles.sectionEyebrow}>Today focus</p>
                <h2 className={dashboardStyles.sectionTitle}>任务与专注</h2>
              </div>
              <button type="button" className={dashboardStyles.inlineLink}>
                <span>查看更完整的数据概览</span>
                <ArrowRight size={16} />
              </button>
            </div>

            <section className={pendingStyles.card}>
              <div className={pendingStyles.header}>
                <div className={pendingStyles.titleWrap}>
                  <span className={pendingStyles.titleIcon}>
                    <CheckCircle2 size={18} />
                  </span>
                  <h3 className={pendingStyles.title}>今日任务</h3>
                </div>
                <span className={pendingStyles.meta}>2 个待完成</span>
              </div>

              <div className={pendingStyles.list}>
                {staticTasks.map((task) => (
                  <article key={task.id} className={pendingStyles.item}>
                    <div className={pendingStyles.dragHandle} aria-hidden>
                      <GripVertical size={15} />
                    </div>
                    <input type="checkbox" readOnly checked={task.done} className={pendingStyles.checkbox} />
                    <div className={pendingStyles.content}>
                      <div className={pendingStyles.row}>
                        <span className={task.done ? `${pendingStyles.taskTitle} ${pendingStyles.taskTitleCompleted}` : pendingStyles.taskTitle}>
                          {task.title}
                        </span>
                      </div>
                    </div>
                    <div className={pendingStyles.actions}>
                      <button type="button" className={`${pendingStyles.actionButton} ${pendingStyles.actionButtonStart}`} title="正计时">
                        <Play size={14} />
                      </button>
                      <button type="button" className={`${pendingStyles.actionButton} ${pendingStyles.actionButtonEdit}`} title="修改">
                        <Pencil size={14} />
                      </button>
                      <button type="button" className={`${pendingStyles.actionButton} ${pendingStyles.actionButtonDanger}`} title="删除">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className={pendingStyles.addForm}>
                <input type="text" className={pendingStyles.addInput} placeholder="输入任务名称" />
                <div className={pendingStyles.addActions}>
                  <button type="button" className={pendingStyles.addPrimaryButton}>
                    添加任务
                  </button>
                </div>
              </div>
            </section>

            <section className={pomodoroStyles.card}>
              <div className={pomodoroStyles.header}>
                <div className={pomodoroStyles.titleWrap}>
                  <span className={pomodoroStyles.icon}>
                    <Timer size={18} />
                  </span>
                  <div>
                    <h3 className={pomodoroStyles.title}>专注计时</h3>
                    <p className={pomodoroStyles.subtitle}>静态演示</p>
                  </div>
                </div>
                <div className={pomodoroStyles.badgeRow}>
                  <span className={dashboardStyles.studyBadge}>
                    <Target size={14} />
                    <span>演示模式</span>
                  </span>
                </div>
              </div>

              <div className={pomodoroStyles.body}>
                <div className={pomodoroStyles.time}>24:59</div>
                <div className={pomodoroStyles.metaRow}>
                  <span>目标 25 分钟</span>
                  <span>进度 48%</span>
                </div>
                <div className={pomodoroStyles.track}>
                  <div className={pomodoroStyles.fill} style={{ width: '48%', background: 'linear-gradient(90deg, #f97316, #ef4444)' }} />
                </div>
                <div className={pomodoroStyles.controls}>
                  <button type="button" className={pomodoroStyles.primaryButton}>
                    开始专注
                  </button>
                  <button type="button" className={pomodoroStyles.secondaryButton}>
                    重置
                  </button>
                  <button type="button" className={pomodoroStyles.ghostButton}>
                    切换模式
                  </button>
                </div>
                <div className={pomodoroStyles.infoCard}>
                  <span className={pomodoroStyles.cardLabel}>当前任务</span>
                  <div className={pomodoroStyles.taskTitle}>完成线性代数作业第 4 章</div>
                  <p className={pomodoroStyles.helperText}>这是演示倒计时，点击按钮不会真实启动。</p>
                </div>
              </div>
            </section>
          </div>

          <aside className={dashboardStyles.secondaryColumn}>
            <div className={dashboardStyles.sectionHeader}>
              <div>
                <p className={dashboardStyles.sectionEyebrow}>Daily system</p>
                <h2 className={dashboardStyles.sectionTitle}>记录与反馈</h2>
              </div>
            </div>

            <div className={dashboardStyles.studyCard}>
              <div className={dashboardStyles.studyHeader}>
                <div>
                  <p className={dashboardStyles.studyEyebrow}>Manual log</p>
                  <h3 className={dashboardStyles.studyTitle}>今日学习推进</h3>
                </div>
                <div className={dashboardStyles.studyBadge}>
                  <Target size={14} />
                  <span>56%</span>
                </div>
              </div>

              <div className={dashboardStyles.studyNumbers}>
                <div>
                  <span className={dashboardStyles.studyNumberLabel}>累计时长</span>
                  <strong className={dashboardStyles.studyNumberValue}>3 小时 20 分</strong>
                </div>
                <div>
                  <span className={dashboardStyles.studyNumberLabel}>专注次数</span>
                  <strong className={dashboardStyles.studyNumberValue}>4</strong>
                </div>
              </div>

              <div className={dashboardStyles.progressTrack}>
                <div className={dashboardStyles.progressFill} style={{ width: '56%' }} />
              </div>

              <p className={dashboardStyles.progressCaption}>默认目标 6 小时。你也可以手动补录今天的学习时长。</p>

              <button type="button" className={dashboardStyles.secondaryAction}>
                <TimerReset size={16} />
                <span>补录学习时长</span>
              </button>

              <div className={dashboardStyles.manualEntry}>
                <div className={dashboardStyles.manualInputRow}>
                  <input type="number" inputMode="numeric" min="1" max="600" placeholder="输入分钟数" className={dashboardStyles.manualInput} />
                  <button type="button" className={dashboardStyles.primaryAction}>
                    保存
                  </button>
                </div>
                <button type="button" className={dashboardStyles.textAction}>
                  取消
                </button>
              </div>
            </div>
          </aside>
        </section>
      </main>

      <footer className={dashboardStyles.footer}>
        <div>
          <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer">
            粤ICP备2025456526号-1
          </a>
        </div>
        <div>
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=44030002007784"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Image src="/beian-icon.png" alt="备案图标" width={14} height={14} />
            粤公网安备44030002007784号
          </a>
        </div>
      </footer>
    </div>
  );
}
