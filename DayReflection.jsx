import React, { useState, useEffect } from 'react';
import { Sunrise, Moon, X, CheckCircle, Download } from 'lucide-react';
import { useSimpleStore } from '../stores/useSimpleStore';
import { exportTodayData } from '../utils/simpleExport';

const DayReflection = () => {
  const {
    dayStart,
    dayReflection,
    reflectionTime,
    health,
    config,
    subjectGoals,
    setDayStart,
    setDayReflection,
    setReflectionTime,
    setWeight,
    setSleepData,
    setPhoneUsage,
    setSubjectGoals
  } = useSimpleStore();
  
  const [showStartModal, setShowStartModal] = useState(false);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [startContent, setStartContent] = useState('');
  const [reflectionContent, setReflectionContent] = useState(() => {
    // 从store中解析已有的反思内容
    if (dayReflection) {
      const parts = dayReflection.split('\n\n明天计划：\n');
      return parts[0] || '';
    }
    return '';
  });
  const [tomorrowPlan, setTomorrowPlan] = useState(() => {
    // 从store中解析已有的明天计划
    if (dayReflection) {
      const parts = dayReflection.split('\n\n明天计划：\n');
      return parts[1] || '';
    }
    return '';
  });
  const [hasExported, setHasExported] = useState(false);

  // 健康数据状态
  const [weight, setWeightInput] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState(3);
  const [phoneUsage, setPhoneUsageInput] = useState('');

  // 学科目标状态
  const [localSubjectGoals, setLocalSubjectGoals] = useState(() => {
    // 初始化时从store中获取现有的学科目标
    return subjectGoals || {};
  });

  // 监听store中复盘数据的变化，同步到本地状态
  useEffect(() => {
    if (dayReflection) {
      const parts = dayReflection.split('\n\n明天计划：\n');
      setReflectionContent(parts[0] || '');
      setTomorrowPlan(parts[1] || '');
    } else {
      setReflectionContent('');
      setTomorrowPlan('');
    }
  }, [dayReflection]);

  // 检查今天是否已经开启
  const hasStartedToday = dayStart && dayStart.trim() !== '';
  
  // 检查今天是否已经复盘
  const hasReflectedToday = dayReflection && dayReflection.trim() !== '';

  const handleStartDay = () => {
    if (startContent.trim()) {
      setDayStart(startContent.trim());

      // 保存学科目标并创建对应任务
      setSubjectGoals(localSubjectGoals);

      // 保存健康数据
      if (weight) setWeight(parseFloat(weight));
      if (sleepHours) setSleepData(parseFloat(sleepHours), sleepQuality);
      if (phoneUsage) setPhoneUsage(parseInt(phoneUsage));

      // 重置表单
      setStartContent('');
      setWeightInput('');
      setSleepHours('');
      setSleepQuality(3);
      setPhoneUsageInput('');
      setShowStartModal(false);
    }
  };

  const handleReflection = () => {
    if (reflectionContent.trim()) {
      const now = new Date();
      const timeString = now.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      const fullReflection = tomorrowPlan.trim()
        ? `${reflectionContent.trim()}\n\n明天计划：\n${tomorrowPlan.trim()}`
        : reflectionContent.trim();

      setDayReflection(fullReflection);
      setReflectionTime(timeString);

      // 只关闭模态框，不清空内容（内容已保存到store）
      setShowReflectionModal(false);
    }
  };

  const openStartModal = () => {
    setStartContent(dayStart || '');
    // 初始化健康数据（如果已有数据则显示）
    setWeightInput(health.weight > 0 ? health.weight.toString() : '');
    setSleepHours(health.sleepHours > 0 ? health.sleepHours.toString() : '');
    setSleepQuality(health.sleepQuality > 0 ? health.sleepQuality : 3);
    setShowStartModal(true);
  };

  const openReflectionModal = () => {
    // 从store中加载已有的反思内容和明天计划
    if (dayReflection) {
      const parts = dayReflection.split('\n\n明天计划：\n');
      setReflectionContent(parts[0] || '');
      setTomorrowPlan(parts[1] || '');
    }
    setHasExported(false);
    // 初始化手机使用时间（如果已有数据则显示）
    setPhoneUsageInput(health.phoneUsage > 0 ? health.phoneUsage.toString() : '');
    setShowReflectionModal(true);
  };

  const handleExportData = () => {
    exportTodayData();
    setHasExported(true);
  };

  // 体重输入变化处理（自动保存）
  const handleWeightChange = (e) => {
    const value = e.target.value;
    setWeightInput(value);

    if (value === '') {
      setWeight(0);
    } else {
      const weightValue = parseFloat(value);
      if (!isNaN(weightValue) && weightValue >= 30 && weightValue <= 200) {
        setWeight(weightValue);
      }
    }
  };

  // 睡眠时长输入变化处理（自动保存）
  const handleSleepHoursChange = (e) => {
    const value = e.target.value;
    setSleepHours(value);

    if (value === '') {
      setSleepData(0, sleepQuality);
    } else {
      const hoursValue = parseFloat(value);
      if (!isNaN(hoursValue) && hoursValue >= 0 && hoursValue <= 24) {
        setSleepData(hoursValue, sleepQuality);
      }
    }
  };

  // 睡眠质量选择变化处理（自动保存）
  const handleSleepQualityChange = (e) => {
    const quality = parseInt(e.target.value);
    setSleepQuality(quality);

    // 如果已有睡眠时长，则一起保存
    const currentHours = sleepHours ? parseFloat(sleepHours) : 0;
    setSleepData(currentHours, quality);
  };

  // 手机使用时间输入变化处理（自动保存）
  const handlePhoneUsageChange = (e) => {
    const value = e.target.value;
    setPhoneUsageInput(value);

    // 自动保存逻辑（类似运动和消费记录的处理方式）
    if (value === '') {
      // 如果清空输入，设置为0
      setPhoneUsage(0);
    } else {
      const minutes = parseInt(value);
      if (!isNaN(minutes) && minutes >= 0 && minutes <= 1440) {
        setPhoneUsage(minutes);
      }
    }
  };



  return (
    <>
      {/* 开启按钮 */}
      <button
        onClick={openStartModal}
        className="footer-link footer-reflection-btn"
        style={{
          backgroundColor: hasStartedToday ? 'rgba(72, 187, 120, 0.2)' : 'rgba(66, 153, 225, 0.2)',
          color: hasStartedToday ? '#48bb78' : '#4299e1',
          border: `1px solid ${hasStartedToday ? '#48bb78' : '#4299e1'}`
        }}
        title={hasStartedToday ? "查看今日开启内容" : "开启新的一天"}
      >
        <Sunrise size={16} />
        {hasStartedToday ? '已开启' : '开启'}
      </button>

      {/* 复盘按钮 */}
      <button
        onClick={openReflectionModal}
        className="footer-link footer-reflection-btn"
        style={{
          backgroundColor: hasReflectedToday ? 'rgba(72, 187, 120, 0.2)' : 'rgba(237, 137, 54, 0.2)',
          color: hasReflectedToday ? '#48bb78' : '#ed8936',
          border: `1px solid ${hasReflectedToday ? '#48bb78' : '#ed8936'}`
        }}
        title={hasReflectedToday ? `已复盘 (${reflectionTime})` : "结束今天并复盘"}
      >
        <Moon size={16} />
        {hasReflectedToday ? '已复盘' : '复盘'}
      </button>

      {/* 开启模态框 */}
      {showStartModal && (
        <div className="modal-overlay">
          <div className="modal-content reflection-modal">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Sunrise size={24} className="text-blue-500" />
                <h3 className="modal-title">开启新的一天</h3>
              </div>
              <button
                onClick={() => setShowStartModal(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  今日目标与计划
                </label>
                <textarea
                  value={startContent}
                  onChange={(e) => setStartContent(e.target.value)}
                  placeholder="写下今天的学习目标、重要任务或想要完成的事情..."
                  className="form-textarea"
                  rows={4}
                />
              </div>

              {/* 学科目标设置 */}
              <div className="form-group">
                <label className="form-label">
                  📚 今日学科目标 (分钟)
                </label>
                <div className="subject-goals-grid">
                  {Object.entries(config?.studySubjects || {})
                    .filter(([key, subject]) => subject.enabled)
                    .map(([key, subject]) => (
                    <div key={key} className="subject-goal-item">
                      <div className="subject-goal-header">
                        <span
                          className="subject-goal-name"
                          style={{ color: subject.color }}
                        >
                          {subject.name}
                        </span>
                      </div>
                      <input
                        type="number"
                        value={localSubjectGoals[key] || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setLocalSubjectGoals(prev => ({
                            ...prev,
                            [key]: value
                          }));
                        }}
                        placeholder="0"
                        className="subject-goal-input no-spinner"
                        min="0"
                        max="480"
                        step="5"
                      />
                    </div>
                  ))}
                </div>
                <div className="subject-goals-hint">
                  💡 只有设置了目标时间的学科才会出现在任务列表中
                </div>
              </div>

              {/* 健康数据记录 */}
              <div className="form-group">
                <label className="form-label">
                  健康记录 (可选)
                </label>
                <div className="health-inputs-horizontal">
                  <div className="health-input-item">
                    <label className="health-input-label">体重 (kg)</label>
                    <input
                      type="number"
                      value={weight}
                      onChange={handleWeightChange}
                      placeholder="65.5"
                      className="health-input-field no-spinner"
                      min="30"
                      max="200"
                      step="0.1"
                    />
                  </div>

                  <div className="health-input-item">
                    <label className="health-input-label">睡眠时长 (小时)</label>
                    <input
                      type="number"
                      value={sleepHours}
                      onChange={handleSleepHoursChange}
                      placeholder="7.5"
                      className="health-input-field no-spinner"
                      min="0"
                      max="24"
                      step="0.5"
                    />
                  </div>

                  <div className="health-input-item">
                    <label className="health-input-label">睡眠质量</label>
                    <select
                      value={sleepQuality}
                      onChange={handleSleepQualityChange}
                      className="health-input-field"
                    >
                      <option value={1}>很差 😴</option>
                      <option value={2}>较差 😪</option>
                      <option value={3}>一般 😐</option>
                      <option value={4}>良好 😊</option>
                      <option value={5}>很好 😄</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                onClick={() => setShowStartModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleStartDay}
                className="btn btn-primary"
                disabled={!startContent.trim()}
              >
                <CheckCircle size={16} />
                确认开启
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 复盘模态框 */}
      {showReflectionModal && (
        <div className="modal-overlay">
          <div className="modal-content reflection-modal">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Moon size={24} className="text-orange-500" />
                <h3 className="modal-title">今日复盘总结</h3>
              </div>
              <button
                onClick={() => setShowReflectionModal(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  今日总结与反思 (填写后导出)
                </label>
                <textarea
                  value={reflectionContent}
                  onChange={(e) => setReflectionContent(e.target.value)}
                  placeholder="总结今天的学习情况、完成的任务、遇到的问题、收获与感悟..."
                  className="form-textarea"
                  rows={5}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  明日计划 (可选)
                </label>
                <textarea
                  value={tomorrowPlan}
                  onChange={(e) => setTomorrowPlan(e.target.value)}
                  placeholder="明天想要完成的重要任务或学习计划..."
                  className="form-textarea"
                  rows={3}
                />
              </div>

              {/* 手机使用时间记录 */}
              <div className="form-group">
                <label className="form-label">
                  数字健康记录 (可选)
                </label>
                <div className="phone-usage-input-row">
                  <label className="phone-usage-label">手机使用时间 (分钟)</label>
                  <input
                    type="number"
                    value={phoneUsage}
                    onChange={handlePhoneUsageChange}
                    placeholder="120"
                    className="phone-usage-input no-spinner"
                    min="0"
                    max="1440"
                    step="1"
                  />
                  <small className="phone-usage-hint">
                    可查看手机的"屏幕使用时间"或"数字健康"功能，输入后自动保存
                  </small>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                onClick={() => setShowReflectionModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>

              {/* 导出数据按钮 */}
              <button
                onClick={handleExportData}
                className="btn btn-success"
                disabled={!reflectionContent.trim()}
                style={{
                  backgroundColor: hasExported ? '#38a169' : '#48bb78',
                  opacity: hasExported ? 0.8 : 1
                }}
              >
                <Download size={16} />
                {hasExported ? '已导出' : '导出数据'}
              </button>

              <button
                onClick={handleReflection}
                className="btn btn-warning"
                disabled={!reflectionContent.trim()}
              >
                <CheckCircle size={16} />
                完成复盘
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DayReflection;
