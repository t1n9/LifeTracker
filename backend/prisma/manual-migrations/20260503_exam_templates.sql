CREATE TABLE IF NOT EXISTS exam_templates (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  exam_type    TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_templates_exam_type ON exam_templates(exam_type);
CREATE INDEX IF NOT EXISTS idx_exam_templates_is_active ON exam_templates(is_active);

CREATE TABLE IF NOT EXISTS exam_phase_templates (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  template_id  TEXT NOT NULL REFERENCES exam_templates(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  duration_pct INT NOT NULL DEFAULT 0,
  sort_order   INT NOT NULL DEFAULT 0,
  ref_links    JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_exam_phase_templates_template_id ON exam_phase_templates(template_id);

CREATE TABLE IF NOT EXISTS exam_week_plan_templates (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  template_id  TEXT NOT NULL REFERENCES exam_templates(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  plan_json    JSONB NOT NULL DEFAULT '{}',
  ref_links    JSONB NOT NULL DEFAULT '[]',
  sort_order   INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_exam_week_plan_templates_template_id ON exam_week_plan_templates(template_id);

-- Seed: 公务员考试模板
INSERT INTO exam_templates (id, exam_type, name, description, sort_order)
VALUES
  ('tpl-civil-1', 'civil_service', '国考/省考（行测+申论）', '适用于国家公务员考试及各省公务员考试', 1),
  ('tpl-postgrad-1', 'postgraduate', '考研（公共课+专业课）', '适用于全国硕士研究生招生考试', 2)
ON CONFLICT (id) DO NOTHING;

-- 公务员：阶段框架
INSERT INTO exam_phase_templates (template_id, name, description, duration_pct, sort_order, ref_links) VALUES
  ('tpl-civil-1', '基础期', '系统学习各科目知识体系，建立完整知识框架', 40, 1,
   '[{"title":"行测备考指南","url":"https://www.huatu.com/"},{"title":"华图教育官网","url":"https://www.huatu.com/"}]'),
  ('tpl-civil-1', '强化期', '专项训练，重点突破薄弱模块，大量刷题', 35, 2,
   '[{"title":"粉笔公考刷题","url":"https://www.fenbi.com/"}]'),
  ('tpl-civil-1', '冲刺期', '全套模拟练习，查漏补缺，心态调整', 25, 3,
   '[{"title":"历年真题解析","url":"https://www.offcn.com/"}]')
ON CONFLICT DO NOTHING;

-- 公务员：周计划框架
INSERT INTO exam_week_plan_templates (template_id, name, description, plan_json, ref_links, sort_order) VALUES
  ('tpl-civil-1', '基础学习周', '工作日以新知识学习为主，周末综合练习',
   '{"weekdayPattern":{"上午":{"subject":"言语理解","hours":2},"下午":{"subject":"判断推理","hours":3},"晚上":{"subject":"数量关系","hours":2}},"weekendPattern":{"上午":{"subject":"综合练习","hours":3},"下午":{"subject":"申论","hours":4}}}',
   '[{"title":"行测备考时间分配参考","url":"https://www.huatu.com/"}]', 1),
  ('tpl-civil-1', '强化刷题周', '每天专项刷题+错题复盘',
   '{"weekdayPattern":{"上午":{"subject":"专项练习","hours":2},"下午":{"subject":"专项练习","hours":3},"晚上":{"subject":"错题复盘","hours":2}},"weekendPattern":{"上午":{"subject":"套卷练习","hours":3},"下午":{"subject":"申论写作","hours":4}}}',
   '[{"title":"粉笔题库使用指南","url":"https://www.fenbi.com/"}]', 2)
ON CONFLICT DO NOTHING;

-- 考研：阶段框架
INSERT INTO exam_phase_templates (template_id, name, description, duration_pct, sort_order, ref_links) VALUES
  ('tpl-postgrad-1', '基础阶段', '梳理教材，建立知识体系，数学打基础', 30, 1,
   '[{"title":"考研时间规划参考","url":"https://www.kaoyan.com/"}]'),
  ('tpl-postgrad-1', '强化阶段', '配套辅导书，专项训练，英语长难句突破', 40, 2,
   '[{"title":"考研英语阅读技巧","url":"https://www.kaoyan.com/"}]'),
  ('tpl-postgrad-1', '冲刺阶段', '真题模拟，政治押题，查漏补缺', 30, 3,
   '[{"title":"考研政治冲刺资料","url":"https://www.kaoyan.com/"}]')
ON CONFLICT DO NOTHING;

-- 考研：周计划框架
INSERT INTO exam_week_plan_templates (template_id, name, description, plan_json, ref_links, sort_order) VALUES
  ('tpl-postgrad-1', '均衡学习周', '数学英语政治专业课均衡分配',
   '{"weekdayPattern":{"上午":{"subject":"数学","hours":3},"下午":{"subject":"专业课","hours":3},"晚上":{"subject":"英语","hours":2}},"weekendPattern":{"上午":{"subject":"政治","hours":3},"下午":{"subject":"真题练习","hours":4}}}',
   '[{"title":"考研备考规划","url":"https://www.kaoyan.com/"}]', 1)
ON CONFLICT DO NOTHING;
