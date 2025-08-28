'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Save, X, Activity, Target, Ruler } from 'lucide-react';
import { exerciseAPI } from '@/lib/api';

interface ExerciseType {
  id: string;
  name: string;
  type: 'COUNT' | 'DISTANCE';
  unit: string;
  increment?: number;
  icon?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
}

interface ExerciseConfigManagerProps {
  onUpdate?: () => void;
}

const ExerciseConfigManager: React.FC<ExerciseConfigManagerProps> = ({ onUpdate }) => {
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 新增/编辑表单数据
  const [formData, setFormData] = useState({
    name: '',
    type: 'COUNT' as 'COUNT' | 'DISTANCE',
    unit: '',
    increment: 1,
    icon: '🏃',
    color: '#3182ce'
  });

  // 加载运动类型
  const loadExerciseTypes = async () => {
    try {
      setLoading(true);
      // 在配置管理页面，我们需要显示所有运动类型（包括禁用的）
      const response = await exerciseAPI.getExerciseTypes(true);
      setExerciseTypes(response.data.data || []);
    } catch (error) {
      console.error('加载运动类型失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExerciseTypes();
  }, []);

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      type: 'COUNT',
      unit: '',
      increment: 1,
      icon: '🏃',
      color: '#3182ce'
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  // 开始编辑
  const startEdit = (exerciseType: ExerciseType) => {
    setFormData({
      name: exerciseType.name,
      type: exerciseType.type,
      unit: exerciseType.unit,
      increment: exerciseType.increment || 1,
      icon: exerciseType.icon || '🏃',
      color: exerciseType.color || '#3182ce'
    });
    setEditingId(exerciseType.id);
    setShowAddForm(false);
  };

  // 保存运动类型
  const handleSave = async () => {
    if (!formData.name.trim() || !formData.unit.trim()) {
      alert('请填写运动名称和单位');
      return;
    }

    try {
      setSubmitting(true);
      
      if (editingId) {
        // 更新现有运动类型
        await exerciseAPI.updateExerciseType(editingId, formData);
      } else {
        // 创建新运动类型
        await exerciseAPI.createExerciseType(formData);
      }

      await loadExerciseTypes();
      resetForm();
      onUpdate?.();
    } catch (error) {
      console.error('保存运动类型失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除运动类型
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除运动项目"${name}"吗？删除后相关的运动记录将无法显示。`)) {
      return;
    }

    try {
      await exerciseAPI.deleteExerciseType(id);
      await loadExerciseTypes();
      onUpdate?.();
    } catch (error) {
      console.error('删除运动类型失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 切换启用状态
  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await exerciseAPI.updateExerciseType(id, { isActive: !isActive });
      await loadExerciseTypes();
      onUpdate?.();
    } catch (error) {
      console.error('更新状态失败:', error);
      alert('更新失败，请重试');
    }
  };

  // 预设图标
  const iconOptions = ['🏃', '💪', '🦵', '🤲', '🏊', '🚴', '⚽', '🏀', '🎾', '🏓', '🥊', '🤸', '🧘', '🏋️'];

  // 预设颜色
  const colorOptions = ['#3182ce', '#38a169', '#d69e2e', '#e53e3e', '#805ad5', '#dd6b20', '#319795', '#c53030'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div style={{ color: 'var(--text-muted)' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div className="exercise-config-manager">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            运动项目管理
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            添加、编辑和管理您的运动项目配置
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          添加运动项目
        </button>
      </div>

      {/* 添加/编辑表单 */}
      {(showAddForm || editingId) && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1rem' }}>
            {editingId ? '编辑运动项目' : '添加运动项目'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* 运动名称 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                运动名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="如：俯卧撑、跑步等"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* 运动类型 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                运动类型 *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  type: e.target.value as 'COUNT' | 'DISTANCE',
                  unit: e.target.value === 'COUNT' ? '个' : 'km'
                }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              >
                <option value="COUNT">计数型（如俯卧撑、深蹲）</option>
                <option value="DISTANCE">距离型（如跑步、游泳）</option>
              </select>
            </div>

            {/* 单位 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                单位 *
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                placeholder={formData.type === 'COUNT' ? '个、次、组' : 'km、米、圈'}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* 固定数量/增量 */}
            {formData.type === 'COUNT' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  固定数量
                </label>
                <input
                  type="number"
                  value={formData.increment}
                  onChange={(e) => setFormData(prev => ({ ...prev, increment: parseInt(e.target.value) || 1 }))}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem'
                  }}
                />
                <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  每次点击增加的数量
                </small>
              </div>
            )}
          </div>

          {/* 图标和颜色选择 */}
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* 图标选择 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                图标
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {iconOptions.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, icon }))}
                    style={{
                      width: '32px',
                      height: '32px',
                      border: formData.icon === icon ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      borderRadius: '4px',
                      background: 'var(--bg-primary)',
                      fontSize: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* 颜色选择 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                颜色
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {colorOptions.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    style={{
                      width: '32px',
                      height: '32px',
                      border: formData.color === color ? '3px solid var(--text-primary)' : '1px solid var(--border-color)',
                      borderRadius: '4px',
                      background: color,
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleSave}
              disabled={submitting}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Save size={16} />
              {submitting ? '保存中...' : '保存'}
            </button>
            <button
              onClick={resetForm}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <X size={16} />
              取消
            </button>
          </div>
        </div>
      )}

      {/* 运动项目列表 */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {exerciseTypes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px dashed var(--border-color)'
          }}>
            <Activity size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>还没有添加运动项目</p>
            <p style={{ fontSize: '0.875rem' }}>点击上方按钮添加您的第一个运动项目</p>
          </div>
        ) : (
          exerciseTypes.map(exerciseType => (
            <div
              key={exerciseType.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                background: exerciseType.isActive ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                opacity: exerciseType.isActive ? 1 : 0.6
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: exerciseType.color || '#3182ce',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}
                >
                  {exerciseType.icon || '🏃'}
                </div>
                <div>
                  <div style={{ fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {exerciseType.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {exerciseType.type === 'COUNT' ? <Target size={12} /> : <Ruler size={12} />}
                      {exerciseType.type === 'COUNT' ? '计数型' : '距离型'}
                    </span>
                    <span>单位: {exerciseType.unit}</span>
                    {exerciseType.type === 'COUNT' && exerciseType.increment && (
                      <span>固定数量: {exerciseType.increment}</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* 启用/禁用切换 */}
                <button
                  onClick={() => toggleActive(exerciseType.id, exerciseType.isActive)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    border: 'none',
                    borderRadius: '4px',
                    background: exerciseType.isActive ? 'var(--success-color)' : 'var(--text-muted)',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {exerciseType.isActive ? '已启用' : '已禁用'}
                </button>

                {/* 编辑按钮 */}
                <button
                  onClick={() => startEdit(exerciseType)}
                  style={{
                    width: '32px',
                    height: '32px',
                    border: 'none',
                    borderRadius: '4px',
                    background: 'var(--accent-primary)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="编辑"
                >
                  <Edit3 size={14} />
                </button>

                {/* 删除按钮 */}
                <button
                  onClick={() => handleDelete(exerciseType.id, exerciseType.name)}
                  style={{
                    width: '32px',
                    height: '32px',
                    border: 'none',
                    borderRadius: '4px',
                    background: 'var(--error-color)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ExerciseConfigManager;
