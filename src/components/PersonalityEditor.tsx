import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { PersonalityParams } from '../types/pet';
import './PersonalityEditor.css';

interface Config {
  active_personality: string;
  personalities: PersonalityParams[];
  show_text: boolean;
  reminder_enabled: boolean;
  deepseek_api_key?: string;
}

function personalityLabel(name: string, config: Config | null): string {
  const params = config?.personalities.find(p => p.name === name);
  if (params?.displayName) return params.displayName;
  return name;
}

function PersonalityEditor() {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showText, setShowText] = useState(true);
  const [reminderEnabled, setReminderEnabled] = useState(true);

  const loadConfig = () => {
    invoke<Config>('get_config')
      .then((c) => {
        setConfig(c);
        setApiKey(c.deepseek_api_key || '');
        setShowText(c.show_text);
        setReminderEnabled(c.reminder_enabled);
      })
      .catch((e) => setError(String(e)));
  };

  useEffect(() => { loadConfig(); }, []);

  useEffect(() => {
    const unlisten = listen('personality-list-changed', () => loadConfig());
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    invoke('set_api_key', { key }).catch((e) => setError(String(e)));
  };

  const switchPersonality = (name: string) => {
    invoke('set_active_personality', { name })
      .then(() => loadConfig())
      .catch((e) => setError(String(e)));
  };

  const toggleShowText = () => {
    const next = !showText;
    setShowText(next);
    invoke('set_show_text', { show: next }).catch((e) => setError(String(e)));
  };

  const toggleReminder = () => {
    const next = !reminderEnabled;
    setReminderEnabled(next);
    invoke('set_reminder_enabled', { enabled: next }).catch((e) => setError(String(e)));
  };

  if (!config) return <div className="pe-container"><p>加载中...</p></div>;

  const activeName = config.active_personality;
  const personalities = config.personalities || [];

  return (
    <div className="pe-container">
      <div className="pe-header">
        <h2>🐱 设置</h2>
      </div>

      {error && <div className="pe-error">{error}</div>}

      {/* 快捷设置 */}
      <div className="pe-section">
        <h3>⚡ 快捷设置</h3>
        <div className="pe-quick-settings">
          <div className="pe-quick-row">
            <label>当前猫格</label>
            <select
              className="pe-select"
              value={activeName}
              onChange={(e) => switchPersonality(e.target.value)}
            >
              {personalities.map((p) => (
                <option key={p.id} value={p.name}>
                  {personalityLabel(p.name, config)}
                </option>
              ))}
            </select>
          </div>
          <div className="pe-quick-row">
            <label>显示文本</label>
            <button
              className={`pe-toggle ${showText ? 'pe-toggle-on' : ''}`}
              onClick={toggleShowText}
            >
              {showText ? '开启' : '关闭'}
            </button>
          </div>
          <div className="pe-quick-row">
            <label>定时提醒</label>
            <button
              className={`pe-toggle ${reminderEnabled ? 'pe-toggle-on' : ''}`}
              onClick={toggleReminder}
            >
              {reminderEnabled ? '开启' : '关闭'}
            </button>
          </div>
        </div>
      </div>

      <div className="pe-section">
        <h3>DeepSeek API Key</h3>
        <input
          type="password"
          className="pe-api-key-input"
          value={apiKey}
          onChange={(e) => saveApiKey(e.target.value)}
          placeholder="输入你的 DeepSeek API Key..."
        />
        <p className="pe-hint" style={{ marginTop: 4 }}>在 https://platform.deepseek.com 获取</p>
      </div>
    </div>
  );
}

export default PersonalityEditor;