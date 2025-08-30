// 自动生成的版本文件，请勿手动修改
export const VERSION_INFO = {
  version: '2.2.1',
  name: 'LifeTracker',
  description: '生活记录系统',
  buildDate: '2025-08-30',
  features: [
  "任务管理",
  "学习记录",
  "番茄钟计时",
  "运动记录",
  "消费记录",
  "数据统计",
  "概览分享",
  "用户管理"
]
} as const;

export const getVersionString = () => `v${VERSION_INFO.version}`;
export const getFullVersionInfo = () => `${VERSION_INFO.name} v${VERSION_INFO.version} (${VERSION_INFO.buildDate})`;
