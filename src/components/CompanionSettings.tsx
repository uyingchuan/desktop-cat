import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCompanionStore } from '../stores/useCompanionStore';
import type { CompanionData, RelationshipData, InternalCatState, ContactPolicy } from '../types/companion';
import './CompanionSettings.css';

interface Config {
  active_personality: string;
  personalities: { name: string; id: string; displayName?: string }[];
}

const STAGE_LABELS: Record<string, string> = {
  new: '初识',
  familiar: '熟悉',
  close: '亲密',
};

const MEMORY_TYPE_LABELS: Record<string, string> = {
  fact: '事实',
  event: '事件',
  preference: '偏好',
  relationship: '关系',
};

const MEMORY_TYPE_EMOJI: Record<string, string> = {
  fact: '📋',
  event: '📅',
  preference: '💜',
  relationship: '🤝',
};

function CompanionSettings() {
  const {
    relationships,
    internal_states,
    contact_policy,
    memories_v2,
    loadCompanionData,
    updateContactPolicy,
    removeMemoryV2,
  } = useCompanionStore();

  const [personalities, setPersonalities] = useState<{ name: string; id: string; displayName?: string }[]>([]);
  const [memoryFilter, setMemoryFilter] = useState<string>('all');

  // 加载配置（获取人格列表）和陪伴数据
  const loadData = useCallback(() => {
    invoke<CompanionData>('get_companion_data')
      .then((data) => loadCompanionData(data))
      .catch(() => {});

    invoke<Config>('get_config')
      .then((c) => {
        setPersonalities(c.personalities || []);
      })
      .catch(() => {});
  }, [loadCompanionData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 监听人格列表变化
  useEffect(() => {
    const unlisten = listen('personality-list-changed', () => loadData());
    return () => { unlisten.then((fn) => fn()); };
  }, [loadData]);

  // --- 切换开关 ---
  const toggleCompanion = () => {
    updateContactPolicy({ companion_enabled: !contact_policy.companion_enabled });
  };

  // --- 数字输入变更 ---
  const updatePolicy = (field: keyof ContactPolicy, value: number) => {
    updateContactPolicy({ [field]: value });
  };

  // --- 关系重置 ---
  const handleReset = (personality: string) => {
    if (!confirm(`确定要重置「${personality}」的关系数据吗？熟悉度、信任度将归零。`)) return;
    invoke('reset_relationship', { personality })
      .then(() => loadData())
      .catch(() => {});
  };

  // --- 记忆过滤 ---
  const allMemories = memoryFilter === 'all'
    ? memories_v2
    : memories_v2.filter((m) => m.memory_type === memoryFilter);

  return (
    <div className="pe-container">
      <div className="pe-header">
        <h2>🤝 陪伴设置</h2>
      </div>

      {/* 主动聊天总开关 */}
      <div className="pe-section">
        <h3>🐾 主动陪伴</h3>
        <div className="pe-quick-settings">
          <div className="pe-quick-row">
            <label>主动聊天</label>
            <button
              className={`pe-toggle ${contact_policy.companion_enabled ? 'pe-toggle-on' : ''}`}
              onClick={toggleCompanion}
            >
              {contact_policy.companion_enabled ? '开启' : '关闭'}
            </button>
          </div>
        </div>
      </div>

      {/* 联系策略 */}
      <div className="pe-section">
        <h3>📋 联系策略</h3>
        <div className="cs-policy-grid">
          <div className="cs-policy-field">
            <label>每日最多主动消息</label>
            <input
              type="number"
              min={0}
              max={10}
              value={contact_policy.max_proactive_per_day}
              onChange={(e) => updatePolicy('max_proactive_per_day', Number(e.target.value))}
            />
            <span className="cs-field-hint">次</span>
          </div>
          <div className="cs-policy-field">
            <label>最小间隔</label>
            <input
              type="number"
              min={1}
              max={72}
              value={contact_policy.min_interval_hours}
              onChange={(e) => updatePolicy('min_interval_hours', Number(e.target.value))}
            />
            <span className="cs-field-hint">小时</span>
          </div>
          <div className="cs-policy-field">
            <label>连续忽略冷却</label>
            <input
              type="number"
              min={1}
              max={720}
              value={contact_policy.ignore_cooldown_hours}
              onChange={(e) => updatePolicy('ignore_cooldown_hours', Number(e.target.value))}
            />
            <span className="cs-field-hint">小时</span>
          </div>
        </div>
        {!contact_policy.companion_enabled && (
          <p className="cs-disabled-notice">主动陪伴已关闭，猫猫不会主动联系你。</p>
        )}
      </div>

      {/* 关系状态（每人格） */}
      <div className="pe-section">
        <h3>💞 关系状态</h3>
        {personalities.map((p) => {
          const rel: RelationshipData = relationships[p.name] || {
            familiarity: 0, trust: 50, interaction_days: 0,
            ignored_count: 0, last_contact_at: 0, last_proactive_times: [],
            consecutive_ignores: 0, daily_interaction_count: 0,
            daily_interaction_date: '', stage: 'new',
          };
          return (
            <div key={p.name} className="cs-rel-card">
              <div className="cs-rel-header">
                <span className="cs-rel-name">{p.displayName || p.name}</span>
                <span className={`cs-stage-badge cs-stage-${rel.stage}`}>
                  {STAGE_LABELS[rel.stage] || rel.stage}
                </span>
              </div>
              <div className="cs-rel-bars">
                <div className="cs-bar-row">
                  <span className="cs-bar-label">熟悉度</span>
                  <div className="cs-bar-track">
                    <div className="cs-bar-fill cs-bar-familiarity" style={{ width: `${rel.familiarity}%` }} />
                  </div>
                  <span className="cs-bar-val">{rel.familiarity}</span>
                </div>
                <div className="cs-bar-row">
                  <span className="cs-bar-label">信任度</span>
                  <div className="cs-bar-track">
                    <div className="cs-bar-fill cs-bar-trust" style={{ width: `${rel.trust}%` }} />
                  </div>
                  <span className="cs-bar-val">{rel.trust}</span>
                </div>
              </div>
              <div className="cs-rel-stats">
                <span>互动天数: {rel.interaction_days}</span>
                <span>忽略次数: {rel.ignored_count}</span>
                {rel.last_contact_at > 0 && (
                  <span>最后互动: {new Date(rel.last_contact_at * 1000).toLocaleDateString('zh-CN')}</span>
                )}
              </div>
              <button className="pe-btn pe-btn-sm cs-reset-btn" onClick={() => handleReset(p.name)}>
                重置关系
              </button>
            </div>
          );
        })}
      </div>

      {/* 内部猫状态 */}
      <div className="pe-section">
        <h3>🐱 猫猫内部状态</h3>
        {personalities.map((p) => {
          const state: InternalCatState = internal_states[p.name] || {
            energy: 80, curiosity: 50, loneliness: 0, sleepiness: 0, last_decay_at: 0,
          };
          return (
            <div key={p.name} className="cs-rel-card">
              <div className="cs-rel-header">
                <span className="cs-rel-name">{p.displayName || p.name}</span>
              </div>
              <div className="cs-rel-bars">
                <div className="cs-bar-row">
                  <span className="cs-bar-label">精力</span>
                  <div className="cs-bar-track">
                    <div className="cs-bar-fill cs-bar-energy" style={{ width: `${state.energy}%` }} />
                  </div>
                  <span className="cs-bar-val">{state.energy}</span>
                </div>
                <div className="cs-bar-row">
                  <span className="cs-bar-label">好奇心</span>
                  <div className="cs-bar-track">
                    <div className="cs-bar-fill cs-bar-curiosity" style={{ width: `${state.curiosity}%` }} />
                  </div>
                  <span className="cs-bar-val">{state.curiosity}</span>
                </div>
                <div className="cs-bar-row">
                  <span className="cs-bar-label">孤独感</span>
                  <div className="cs-bar-track">
                    <div className="cs-bar-fill cs-bar-loneliness" style={{ width: `${state.loneliness}%` }} />
                  </div>
                  <span className="cs-bar-val">{state.loneliness}</span>
                </div>
                <div className="cs-bar-row">
                  <span className="cs-bar-label">困倦度</span>
                  <div className="cs-bar-track">
                    <div className="cs-bar-fill cs-bar-sleepiness" style={{ width: `${state.sleepiness}%` }} />
                  </div>
                  <span className="cs-bar-val">{state.sleepiness}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 记忆浏览器 */}
      <div className="pe-section">
        <h3>🧠 记忆浏览</h3>
        <div className="cs-memory-filter">
          <select
            className="pe-select"
            value={memoryFilter}
            onChange={(e) => setMemoryFilter(e.target.value)}
          >
            <option value="all">全部类型</option>
            <option value="fact">📋 事实</option>
            <option value="event">📅 事件</option>
            <option value="preference">💜 偏好</option>
            <option value="relationship">🤝 关系</option>
          </select>
          <span className="cs-memory-count">{allMemories.length} 条记忆</span>
        </div>
        {allMemories.length === 0 ? (
          <p className="cs-empty-hint">暂无记忆。多和猫猫聊天，它会记住关于你的事情~</p>
        ) : (
          <div className="cs-memory-list">
            {allMemories.map((m) => (
              <div key={m.id} className="cs-memory-item">
                <div className="cs-memory-type">
                  {MEMORY_TYPE_EMOJI[m.memory_type] || '📋'} {MEMORY_TYPE_LABELS[m.memory_type] || m.memory_type}
                  <span className="cs-memory-importance">{'★'.repeat(m.importance)}</span>
                </div>
                <div className="cs-memory-content">{m.content}</div>
                <div className="cs-memory-meta">
                  <span>{m.personality}</span>
                  <span>创建: {new Date(m.created_at * 1000).toLocaleDateString('zh-CN')}</span>
                </div>
                <button
                  className="cs-memory-delete"
                  onClick={() => {
                    if (confirm('删除这条记忆？')) {
                      removeMemoryV2(m.id);
                    }
                  }}
                  title="删除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanionSettings;
