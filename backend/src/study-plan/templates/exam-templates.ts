export const EXAM_TEMPLATES = {
  national_exam: {
    label: '国考/省考',
    subjects: [
      { name: '行测', weight: 0.6, level: 'beginner', defaultChapters: ['数量关系', '言语理解', '资料分析', '判断推理', '常识判断'] },
      { name: '申论', weight: 0.4, level: 'beginner', defaultChapters: ['归纳概括', '综合分析', '提出对策', '大作文'] },
    ],
  },
  postgraduate: {
    label: '考研',
    subjects: [
      { name: '数学', weight: 0.3, level: 'beginner', defaultChapters: ['高数', '线代', '概率论'] },
      { name: '英语', weight: 0.25, level: 'beginner', defaultChapters: ['词汇', '阅读', '翻译', '写作'] },
      { name: '政治', weight: 0.2, level: 'beginner', defaultChapters: ['马原', '毛中特', '史纲', '思修'] },
      { name: '专业课', weight: 0.25, level: 'beginner', defaultChapters: [] },
    ],
  },
  ielts: {
    label: '雅思/托福',
    subjects: [
      { name: '听力', weight: 0.25, level: 'beginner', defaultChapters: [] },
      { name: '阅读', weight: 0.25, level: 'beginner', defaultChapters: [] },
      { name: '写作', weight: 0.25, level: 'beginner', defaultChapters: [] },
      { name: '口语', weight: 0.25, level: 'beginner', defaultChapters: [] },
    ],
  },
  custom: {
    label: '自定义目标',
    subjects: [],
  },
} as const;

