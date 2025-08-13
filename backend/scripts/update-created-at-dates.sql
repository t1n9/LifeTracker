-- 更新StudyRecord表的createdAt为startedAt的日期
-- 保持时间为当前时间，只修改日期部分

UPDATE study_records 
SET created_at = DATE(started_at) + TIME(created_at)
WHERE DATE(created_at) != DATE(started_at);

-- 更新PomodoroSession表的createdAt为startedAt的日期
-- 保持时间为当前时间，只修改日期部分

UPDATE pomodoro_sessions 
SET created_at = DATE(started_at) + TIME(created_at)
WHERE DATE(created_at) != DATE(started_at);

-- 查看更新结果
SELECT 
  'StudyRecord' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN DATE(created_at) = DATE(started_at) THEN 1 END) as matching_dates
FROM study_records

UNION ALL

SELECT 
  'PomodoroSession' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN DATE(created_at) = DATE(started_at) THEN 1 END) as matching_dates
FROM pomodoro_sessions;
