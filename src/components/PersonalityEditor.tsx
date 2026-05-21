import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { PersonalityParams } from '../types/pet';
import { BUILTIN_PARAMS, BUILTIN_PERSONALITIES } from '../types/pet';
import './PersonalityEditor.css';

interface Config {
  active_personality: string;
  custom_personalities: Record<string, PersonalityParams>;
}

interface EditingState {
  name: string;
  params: PersonalityParams;
  isNew: boolean;
  rawSpeeches: Record<string, string>;  // raw textarea text, parsed to params.speeches on save
}

const defaultParams: PersonalityParams = {
  activity: 50,
  sleepiness: 30,
  grooming: 30,
  playfulness: 40,
};

const DEFAULT_SPEECHES: Record<string, string[]> = {
  idle:   ['喵?', '嗯?', '什么声音?'],
  walking:['走一走~', '溜达溜达', '散个步', '逛逛'],
  running:['冲鸭!', '跑起来!', '追!'],
  sleeping:['睡醒了...', '喵~好舒服', '伸个懒腰~'],
  playing:['嘿!', '跳!', '喵!'],
  floating:['飞起来~', '飘呀飘', '好轻盈'],
  licking:['舔舔毛', '要干净', '美美的'],
  attacking:['嗷呜!', '看爪!', '抓到你了!'],
};

// 将 string[] 转成 textarea 可用的 raw text
function speechesToRaw(custom?: Record<string, string[]>): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const key of Object.keys(DEFAULT_SPEECHES)) {
    const src = custom?.[key] && custom[key].length > 0 ? custom[key] : DEFAULT_SPEECHES[key];
    raw[key] = src.join('\n');
  }
  return raw;
}

function PersonalityEditor() {
  const [config, setConfig] = useState<Config | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [error, setError] = useState('');
  const [showSpeeches, setShowSpeeches] = useState(false);

  const loadConfig = () => {
    invoke<Config>('get_config').then(setConfig).catch((e) => setError(String(e)));
  };

  useEffect(() => { loadConfig(); }, []);

  useEffect(() => {
    const unlisten = listen('personality-list-changed', () => loadConfig());
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const startNew = () => {
    setEditing({ name: '', params: { ...defaultParams }, isNew: true, rawSpeeches: speechesToRaw() });
    setError('');
  };

  const startEdit = (name: string, params: PersonalityParams) => {
    setEditing({ name, params: { ...params }, isNew: false, rawSpeeches: speechesToRaw(params.speeches) });
    setError('');
  };

  const cancelEdit = () => setEditing(null);

  const savePersonality = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError('请输入猫格名称');
      return;
    }
    if (BUILTIN_PERSONALITIES.includes(editing.name.trim())) {
      setError('不能使用内置猫格名称');
      return;
    }
    // 将 rawSpeeches 解析为 string[] 存入 params.speeches
    const speeches: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(editing.rawSpeeches)) {
      const lines = v.split('\n').filter((l) => l.trim());
      if (lines.length > 0) speeches[k] = lines;
    }
    const params = { ...editing.params, speeches: Object.keys(speeches).length > 0 ? speeches : undefined };
    invoke('save_personality', { name: editing.name.trim(), params })
      .then(() => {
        setEditing(null);
        loadConfig();
      })
      .catch((e) => setError(String(e)));
  };

  const deletePersonality = (name: string) => {
    invoke('delete_personality', { name })
      .then(() => loadConfig())
      .catch((e) => setError(String(e)));
  };

  const setParam = (key: keyof PersonalityParams, value: number) => {
    if (!editing) return;
    setEditing({ ...editing, params: { ...editing.params, [key]: value } });
  };

  const setSpeech = (key: string, text: string) => {
    if (!editing) return;
    setEditing({ ...editing, rawSpeeches: { ...editing.rawSpeeches, [key]: text } });
  };

  if (!config) return <div className="pe-container"><p>加载中...</p></div>;

  const activeName = config.active_personality;
  const customs = config.custom_personalities || {};

  return (
    <div className="pe-container">
      <div className="pe-header">
        <h2>🐱 猫格管理</h2>
        <button className="pe-btn pe-btn-primary" onClick={startNew}>+ 新建猫格</button>
      </div>

      {error && <div className="pe-error">{error}</div>}

      {/* 编辑面板 */}
      {editing && (
        <div className="pe-editor">
          <h3>{editing.isNew ? '新建猫格' : `编辑: ${editing.name}`}</h3>
          {editing.isNew && (
            <div className="pe-field">
              <label>名称</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="输入猫格名称..."
                maxLength={20}
              />
            </div>
          )}
          <SliderRow label="活动度" emoji="🏃" value={editing.params.activity} onChange={(v) => setParam('activity', v)} hint="决定猫猫走/跑的频率" />
          <SliderRow label="睡眠欲" emoji="😴" value={editing.params.sleepiness} onChange={(v) => setParam('sleepiness', v)} hint="决定猫猫睡觉的频率" />
          <SliderRow label="舔毛欲" emoji="🧹" value={editing.params.grooming} onChange={(v) => setParam('grooming', v)} hint="决定猫猫舔毛的频率" />
          <SliderRow label="玩耍度" emoji="🎾" value={editing.params.playfulness} onChange={(v) => setParam('playfulness', v)} hint="决定猫猫跳/扑/飘的频率" />
          <button type="button" className="pe-btn pe-btn-sm" onClick={() => setShowSpeeches(!showSpeeches)} style={{ marginTop: 8 }}>
            {showSpeeches ? '收起话术 ▴' : '编辑话术 ▾'}
          </button>
          {showSpeeches && (
            <div className="pe-speeches">
              {[
                { key: 'idle', label: '待机' },
                { key: 'walking', label: '走路' },
                { key: 'running', label: '跑步' },
                { key: 'sleeping', label: '睡醒' },
                { key: 'licking', label: '舔毛' },
                { key: 'playing', label: '跳跃' },
                { key: 'floating', label: '漂浮' },
                { key: 'attacking', label: '攻击' },
              ].map(({ key, label }) => (
                <div key={key} className="pe-speech-row">
                  <label>{label}</label>
                  <textarea
                    rows={4}
                    value={editing.rawSpeeches[key] || ''}
                    onChange={(e) => setSpeech(key, e.target.value)}
                    placeholder="按 Enter 换行，每行一句"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="pe-editor-actions">
            <button className="pe-btn pe-btn-primary" onClick={savePersonality}>保存</button>
            <button className="pe-btn" onClick={cancelEdit}>取消</button>
          </div>
        </div>
      )}

      {/* 内置猫格列表 */}
      <div className="pe-section">
        <h3>内置猫格</h3>
        {BUILTIN_PERSONALITIES.map((name) => (
          <PersonalityRow
            key={name}
            name={name}
            label={name === 'calm' ? '慵懒' : '活泼'}
            params={BUILTIN_PARAMS[name]}
            isActive={activeName === name}
            isBuiltin
          />
        ))}
      </div>

      {/* 自定义猫格列表 */}
      {Object.keys(customs).length > 0 && (
        <div className="pe-section">
          <h3>自定义猫格</h3>
          {Object.entries(customs).map(([name, params]) => (
            <PersonalityRow
              key={name}
              name={name}
              label={name}
              params={params}
              isActive={activeName === name}
              isBuiltin={false}
              onEdit={() => startEdit(name, params)}
              onDelete={() => deletePersonality(name)}
            />
          ))}
        </div>
      )}

      {Object.keys(customs).length === 0 && (
        <p className="pe-hint">还没有自定义猫格，点击上方按钮新建一个吧~</p>
      )}
    </div>
  );
}

interface SliderRowProps {
  label: string;
  emoji: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
}

function SliderRow({ label, emoji, value, onChange, hint }: SliderRowProps) {
  return (
    <div className="pe-slider-row">
      <div className="pe-slider-label">
        {emoji} {label} <span className="pe-slider-value">{value}</span>
        <span className="pe-slider-hint">{hint}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

interface RowProps {
  name: string;
  label: string;
  params: PersonalityParams;
  isActive: boolean;
  isBuiltin: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

function PersonalityRow({  label, params, isActive, isBuiltin, onEdit, onDelete }: RowProps) {
  return (
    <div className={`pe-row ${isActive ? 'pe-row-active' : ''}`}>
      <div className="pe-row-header">
        <span className="pe-row-name">
          {label}
          {isBuiltin && <span className="pe-tag">内置</span>}
          {isActive && <span className="pe-tag pe-tag-active">当前</span>}
        </span>
        {!isBuiltin && (
          <span className="pe-row-actions">
            <button className="pe-btn-sm" onClick={onEdit}>编辑</button>
            <button className="pe-btn-sm pe-btn-danger" onClick={onDelete}>删除</button>
          </span>
        )}
      </div>
      <div className="pe-row-params">
        <span>🏃{params.activity}</span>
        <span>😴{params.sleepiness}</span>
        <span>🧹{params.grooming}</span>
        <span>🎾{params.playfulness}</span>
      </div>
    </div>
  );
}

export default PersonalityEditor;
