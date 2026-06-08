import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useChatStore } from '../stores/useChatStore';
import { useMemoryStore } from '../stores/useMemoryStore';
import { chatCompletion } from '../services/llm';
import { extractMemories, formatMemoriesForPrompt } from '../services/memory';
import type { PersonalityParams } from '../types/pet';
import type { ChatMessage } from '../stores/useChatStore';
import './ChatRoom.css';

interface Config {
  active_personality: string;
  personalities: PersonalityParams[];
  deepseek_api_key?: string;
}

interface ChatData {
  memories: Record<string, string[]>;
  conversations: Record<string, ChatMessage[]>;
}

const DEFAULT_SYSTEM_PROMPT = '你是一只可爱的桌面猫猫，回复要简短可爱（1-2句话），用"喵"结尾。';

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

const SPEECH_STATES = [
  { key: 'idle', label: '待机' },
  { key: 'walking', label: '走路' },
  { key: 'running', label: '跑步' },
  { key: 'sleeping', label: '睡醒' },
  { key: 'licking', label: '舔毛' },
  { key: 'playing', label: '跳跃' },
  { key: 'floating', label: '漂浮' },
  { key: 'attacking', label: '攻击' },
];

function speechesToRaw(custom?: Record<string, string[]>): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const { key } of SPEECH_STATES) {
    const src = custom?.[key] && custom[key].length > 0 ? custom[key] : (DEFAULT_SPEECHES[key] || []);
    raw[key] = src.join('\n');
  }
  return raw;
}

function getPersonalityParams(personality: string, config: Config | null): PersonalityParams {
  return config?.personalities.find(p => p.name === personality) || {
    id: personality, name: personality, activity: 50, sleepiness: 30, grooming: 30, playfulness: 40,
  };
}

function personalityDisplayLabel(name: string, config: Config | null): string {
  const params = getPersonalityParams(name, config);
  if (params.displayName) return params.displayName;
  return name;
}

function ChatRoom({ personality, mode = 'chat' }: { personality: string; mode?: 'chat' | 'settings' }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState<Config | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 设置面板状态
  const [settingsDisplayName, setSettingsDisplayName] = useState('');
  const [settingsParams, setSettingsParams] = useState<PersonalityParams>(
    getPersonalityParams(personality, config),
  );
  const [settingsPrompt, setSettingsPrompt] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rawSpeeches, setRawSpeeches] = useState<Record<string, string>>({});

  const { conversations, addMessage, clearConversation, loadConversations } = useChatStore();
  const { memories, loadMemories, updateMemories } = useMemoryStore();

  const loadConfig= useCallback(() => {
    Promise.all([
      invoke<Config>('get_config'),
      invoke<ChatData>('get_chat_data'),
    ])
      .then(([c, chatData]) => {
        setConfig(c);
        loadMemories(chatData.memories || {});
        loadConversations(chatData.conversations || {});
      })
      .catch(() => {});
  }, [loadMemories, loadConversations]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // 托盘闪烁时点击 → 重新加载对话
  useEffect(() => {
    const unlisten = listen('chat-reload', () => { loadConfig(); });
    return () => { unlisten.then((fn) => fn()); };
  }, [loadConfig]);

  // 提醒触发时 → 实时注入新消息
  useEffect(() => {
    const unlisten = listen<{ personality: string; content: string }>('chat-new-message', (event) => {
      const { personality: p, content } = event.payload;
      useChatStore.getState().addMessage(p, { role: 'assistant', content });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, personality]);

  useEffect(() => {
    if (!loading && mode === 'chat') inputRef.current?.focus();
  }, [loading, mode]);

  // 直接导航到设置页时初始化表单
  useEffect(() => {
    if (mode === 'settings' && config) {
      const params = getPersonalityParams(personality, config);
      setSettingsDisplayName(params.displayName || '');
      setSettingsParams(params);
      setSettingsPrompt(params.systemPrompt || '');
      setRawSpeeches(speechesToRaw(params.speeches));
      setDirty(false);
    }
  }, [mode, personality, config]);

  // 手动保存设置
  const saveSettings = () => {
    // 将 rawSpeeches 解析为 string[]
    const speeches: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(rawSpeeches)) {
      const lines = v.split('\n').filter((l) => l.trim());
      if (lines.length > 0) speeches[k] = lines;
    }
    const params: PersonalityParams = {
      ...settingsParams,
      displayName: settingsDisplayName.trim() || undefined,
      systemPrompt: settingsPrompt || undefined,
      speeches: Object.keys(speeches).length > 0 ? speeches : undefined,
    };
    setSaving(true);
    setSettingsError('');
    invoke('save_personality', { name: personality, params })
      .then(() => { setDirty(false); loadConfig(); })
      .catch((e) => setSettingsError(String(e)))
      .finally(() => setSaving(false));
  };

  // 进入设置时初始化表单
  const openSettings = () => {
    const params = getPersonalityParams(personality, config);
    setSettingsDisplayName(params.displayName || '');
    setSettingsParams(params);
    setSettingsPrompt(params.systemPrompt || '');
    setRawSpeeches(speechesToRaw(params.speeches));
    setSettingsError('');
    setDirty(false);
    const id = params.id || personality;
    navigate(`/dashboard/chat/${id}/settings`);
  };

  const getSystemPrompt = (name: string): string => {
    const custom = config?.personalities.find(p => p.name === name);
    return custom?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  };

  const doSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !config) return;
    if (!config.deepseek_api_key) return;

    setInput('');
    setLoading(true);
    addMessage(personality, { role: 'user', content: text });

    const myMemories = memories[personality] || [];
    const history = conversations[personality] || [];
    const messages = [
      { role: 'system' as const, content: getSystemPrompt(personality) + formatMemoriesForPrompt(myMemories) },
      ...history,
      { role: 'user' as const, content: text },
    ];

    try {
      const reply = await chatCompletion(messages, config.deepseek_api_key);
      addMessage(personality, { role: 'assistant', content: reply });

      extractMemories(text, reply, myMemories, config.deepseek_api_key).then((newMemories) => {
        if (JSON.stringify(newMemories) !== JSON.stringify(myMemories)) {
          updateMemories(personality, newMemories);
        }
      });
    } catch {
      addMessage(personality, { role: 'assistant', content: '呜...网络出问题了喵，等会儿再试吧~' });
    } finally {
      setLoading(false);
    }
  }, [input, loading, config, personality, memories, conversations, addMessage, updateMemories]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    },
    [doSend],
  );

  const currentMessages = conversations[personality] || [];

  // === 设置视图 ===
  if (mode === 'settings') {
    return (
      <div className="chat-room">
        <div className="chat-settings-header">
          <button className="chat-back-btn" onClick={() => {
            const id = settingsParams.id || personality;
            navigate(`/dashboard/chat/${id}`, { replace: true });
          }} title="返回">
            ←
          </button>
          <span className="chat-settings-title">设置</span>
          <button className="chat-save-btn" onClick={saveSettings} disabled={!dirty || saving}>
            {saving ? '...' : '保存'}
          </button>
        </div>

        <div className="chat-settings-body">
          {settingsError && <div className="chat-settings-error">{settingsError}</div>}

          <div className="chat-settings-field">
            <label>猫猫名称</label>
            <input
              type="text"
              className="chat-settings-input"
              value={settingsDisplayName}
              onChange={(e) => {
                setSettingsDisplayName(e.target.value);
                setDirty(true);
              }}
              placeholder="给猫猫取个名字..."
              maxLength={20}
            />
          </div>

          <div className="chat-settings-field">
            <label>活动度 <span className="chat-settings-val">{settingsParams.activity}</span></label>
            <input
              type="range" min={0} max={100} value={settingsParams.activity}
              onChange={(e) => {
                setSettingsParams({ ...settingsParams, activity: Number(e.target.value) });
                setDirty(true);
              }}
            />
          </div>

          <div className="chat-settings-field">
            <label>睡眠欲 <span className="chat-settings-val">{settingsParams.sleepiness}</span></label>
            <input
              type="range" min={0} max={100} value={settingsParams.sleepiness}
              onChange={(e) => {
                setSettingsParams({ ...settingsParams, sleepiness: Number(e.target.value) });
                setDirty(true);
              }}
            />
          </div>

          <div className="chat-settings-field">
            <label>舔毛欲 <span className="chat-settings-val">{settingsParams.grooming}</span></label>
            <input
              type="range" min={0} max={100} value={settingsParams.grooming}
              onChange={(e) => {
                setSettingsParams({ ...settingsParams, grooming: Number(e.target.value) });
                setDirty(true);
              }}
            />
          </div>

          <div className="chat-settings-field">
            <label>玩耍度 <span className="chat-settings-val">{settingsParams.playfulness}</span></label>
            <input
              type="range" min={0} max={100} value={settingsParams.playfulness}
              onChange={(e) => {
                setSettingsParams({ ...settingsParams, playfulness: Number(e.target.value) });
                setDirty(true);
              }}
            />
          </div>

          <div className="chat-settings-field">
            <label>个性提示词</label>
            <textarea
              className="chat-settings-textarea"
              rows={4}
              value={settingsPrompt}
              onChange={(e) => {
                setSettingsPrompt(e.target.value);
                setDirty(true);
              }}
              placeholder="设置猫猫的角色设定..."
            />
          </div>

          <div className="chat-settings-section">
            <label className="chat-settings-section-label">猫猫话术</label>
            <p className="chat-settings-hint">每行一句，不同动作随机选一句播放</p>
            {SPEECH_STATES.map(({ key, label }) => (
              <div key={key} className="chat-settings-field">
                <label>{label}</label>
                <textarea
                  className="chat-settings-textarea"
                  rows={3}
                  value={rawSpeeches[key] || ''}
                  onChange={(e) => {
                    setRawSpeeches({ ...rawSpeeches, [key]: e.target.value });
                    setDirty(true);
                  }}
                  placeholder={`输入${label}时的话术...`}
                />
              </div>
            ))}
          </div>

          <button
            className="chat-clear-btn"
            onClick={() => {
              if (confirm('确定要清空当前猫格的所有对话记录吗？')) {
                clearConversation(personality);
                const id = settingsParams.id || personality;
                navigate(`/dashboard/chat/${id}`, { replace: true });
              }
            }}
          >
            清空对话
          </button>

          <button
            className="chat-delete-btn"
            onClick={() => {
              if (!confirm(`确定要删除这只猫猫吗？${personality === 'calm' ? '将恢复内置默认设置。' : '此操作不可恢复。'}`)) return;
              invoke('delete_personality', { name: personality })
                .then(() => {
                  const id = settingsParams.id || personality;
                  navigate(`/dashboard/chat/${id}`, { replace: true });
                  loadConfig();
                })
                .catch((e) => setSettingsError(String(e)));
            }}
          >
            删除猫猫
          </button>
        </div>
      </div>
    );
  }

  // === 聊天视图 ===
  const label = personalityDisplayLabel(personality, config);

  return (
    <div className="chat-room">
      <div className="chat-header">
        <span className="chat-header-title">
          🐱 {label}
        </span>
        <button className="chat-menu-btn" onClick={openSettings} title="设置">
          ☰
        </button>
      </div>

      <div className="chat-messages">
        {!config?.deepseek_api_key && (
          <div className="chat-notice">
            请先在设置中配置 DeepSeek API Key
          </div>
        )}
        {currentMessages.length === 0 && config?.deepseek_api_key && (
          <div className="chat-notice">
            和猫猫打个招呼吧~
          </div>
        )}
        {currentMessages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            <div className="chat-bubble">
              {msg.content}
              {msg.timestamp > 0 && (
                <div className="chat-time">
                  {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <div className="chat-bubble loading">猫猫思考中...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-bar">
        <input
          ref={inputRef}
          className="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? '猫猫思考中...' : '输入消息...'}
          disabled={!config?.deepseek_api_key}
        />
        <button
          className="send-btn"
          onClick={doSend}
          disabled={loading || !input.trim() || !config?.deepseek_api_key}
        >
          发送
        </button>
      </div>
    </div>
  );
}

export default ChatRoom;
export { personalityDisplayLabel };
