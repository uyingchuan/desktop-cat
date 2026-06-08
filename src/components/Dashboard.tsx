import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ChatRoom from './ChatRoom';
import TodoPanel from './TodoPanel';
import PersonalityEditor from './PersonalityEditor';
import CompanionSettings from './CompanionSettings';
import { useChatStore } from '../stores/useChatStore';
import type { PersonalityParams } from '../types/pet';
import { SPEECH_STATES, speechesToRaw } from '../types/pet';
import './Dashboard.css';

interface Config {
  active_personality: string;
  personalities: PersonalityParams[];
}

interface PersonalityInfo {
  name: string;
  id: string;
  label: string;
  lastTime: number;
}

function Dashboard() {
  const [personalities, setPersonalities] = useState<PersonalityInfo[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const conversations = useChatStore((s) => s.conversations);

  // 从 config 加载所有猫格，按 lastChatTime 排序
  const loadAndSort = useCallback(() => {
    invoke<Config>('get_config')
      .then((c) => {
        const conv = useChatStore.getState().conversations;
        const infos: PersonalityInfo[] = (c.personalities || [])
          .map((p) => {
            const persistedTime = p.lastChatTime || 0;
            const memMsgs = conv[p.name] || [];
            const memTime = memMsgs.length > 0 ? memMsgs[memMsgs.length - 1].timestamp : 0;
            const lastTime = Math.max(persistedTime, memTime);
            return { name: p.name, id: p.id, label: p.displayName || p.name, lastTime };
          })
          .sort((a, b) => b.lastTime - a.lastTime);
        setPersonalities(infos);
      })
      .catch(() => {});
  }, []);

  const loadPersonalities = loadAndSort;

  useEffect(() => { loadPersonalities(); }, [loadPersonalities]);

  // conversations 变化时重新排序
  useEffect(() => {
    setPersonalities((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const ta = (conversations[a.name] || []).slice(-1)[0]?.timestamp || 0;
        const tb = (conversations[b.name] || []).slice(-1)[0]?.timestamp || 0;
        return tb - ta;
      });
      // 避免不必要的状态更新
      const same = sorted.every((p, i) => p.id === prev[i]?.id);
      return same ? prev : sorted;
    });
  }, [conversations]);

  useEffect(() => { loadPersonalities(); }, [loadPersonalities]);

  useEffect(() => {
    const unlisten = listen('personality-list-changed', () => loadPersonalities());
    return () => { unlisten.then((fn) => fn()); };
  }, [loadPersonalities]);

  // navigate-tab 事件（托盘菜单）
  useEffect(() => {
    const unlisten = listen<string>('navigate-tab', (event) => {
      const tab = event.payload;
      if (tab === 'chat') {
        const firstId = personalities[0]?.id || 'calm';
        navigate(`/dashboard/chat/${firstId}`);
      } else {
        navigate(`/dashboard/${tab}`);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [navigate, personalities]);

  // chat-reload 事件
  useEffect(() => {
    const unlisten = listen('chat-reload', () => {
      const firstId = personalities[0]?.id || 'calm';
      navigate(`/dashboard/chat/${firstId}`);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [navigate, personalities]);

  // /dashboard 重定向到第一个聊天室
  useEffect(() => {
    if (location.pathname === '/dashboard' && personalities.length > 0) {
      navigate(`/dashboard/chat/${personalities[0].id}`, { replace: true });
    }
  }, [location.pathname, personalities, navigate]);

  // 当前激活的 tab
  const path = location.pathname;
  const chatMatch = path.match(/^\/dashboard\/chat\/([^/]+)/);
  const activeChatId = chatMatch ? chatMatch[1] : null;

  return (
    <div className="dashboard">
      <nav className="dashboard-sidebar">
        {/* 聊天 tab */}
        <div className="sidebar-chat-tabs">
          {personalities.map((p) => (
            <button
              key={p.id}
              className={`sidebar-tab ${activeChatId === p.id ? 'active' : ''}`}
              onClick={() => navigate(`/dashboard/chat/${p.id}`)}
              title={p.label}
            >
              <span className="sidebar-tab-icon">💬</span>
              <span className="sidebar-tab-label">{p.label}</span>
            </button>
          ))}

          {/* 新增按钮 */}
          <button
            className={`sidebar-tab sidebar-add-btn ${path === '/dashboard/new' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard/new')}
            title="新增猫猫"
          >
            <span className="sidebar-tab-icon">+</span>
          </button>
        </div>

        {/* 功能 tab */}
        <div className="sidebar-bottom-tabs">
          <div className="sidebar-divider" />
          <button
            className={`sidebar-tab ${path === '/dashboard/companion' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard/companion')}
            title="陪伴"
          >
            <span className="sidebar-tab-icon">🤝</span>
            <span className="sidebar-tab-label">陪伴</span>
          </button>
          <button
            className={`sidebar-tab ${path === '/dashboard/todo' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard/todo')}
            title="备忘录"
          >
            <span className="sidebar-tab-icon">✅</span>
            <span className="sidebar-tab-label">备忘录</span>
          </button>
          <button
            className={`sidebar-tab ${path === '/dashboard/settings' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard/settings')}
            title="设置"
          >
            <span className="sidebar-tab-icon">⚙️</span>
            <span className="sidebar-tab-label">设置</span>
          </button>
        </div>
      </nav>
      <main className="dashboard-content">
        <Routes>
          <Route path="chat/:personalityId" element={<ChatRoute personalities={personalities} />} />
          <Route path="chat/:personalityId/settings" element={<ChatSettingsRoute personalities={personalities} />} />
          <Route path="new" element={<NewCatPage onCreated={(name) => navigate(`/dashboard/chat/${name}`)} />} />
          <Route path="todo" element={<TodoPanel />} />
          <Route path="settings" element={<PersonalityEditor />} />
          <Route path="companion" element={<CompanionSettings />} />
          <Route path="*" element={null} />
        </Routes>
      </main>
    </div>
  );
}

function ChatRoute({ personalities }: { personalities: PersonalityInfo[] }) {
  const { personalityId } = useParams<{ personalityId: string }>();
  const navigate = useNavigate();
  const info = personalities.find((p) => p.id === personalityId);
  if (!info) {
    // id 无效，重定向
    const firstId = personalities[0]?.id;
    if (firstId && firstId !== personalityId) {
      navigate(`/dashboard/chat/${firstId}`, { replace: true });
    }
    return null;
  }
  return <ChatRoom personality={info.name} mode="chat" />;
}

function ChatSettingsRoute({ personalities }: { personalities: PersonalityInfo[] }) {
  const { personalityId } = useParams<{ personalityId: string }>();
  const navigate = useNavigate();
  const info = personalities.find((p) => p.id === personalityId);
  if (!info) {
    const firstId = personalities[0]?.id;
    if (firstId && firstId !== personalityId) {
      navigate(`/dashboard/chat/${firstId}`, { replace: true });
    }
    return null;
  }
  return <ChatRoom personality={info.name} mode="settings" />;
}

function generateId(): string {
  return 'custom_' + Math.random().toString(36).slice(2, 10);
}

function NewCatPage({ onCreated }: { onCreated: (name: string) => void }) {
  const [displayName, setDisplayName] = useState('小橘');
  const [params, setParams] = useState({ activity: 20, sleepiness: 70, grooming: 60, playfulness: 15 });
  const [systemPrompt, setSystemPrompt] = useState('你是一只慵懒安静的桌面猫猫。你喜欢睡觉和舔毛。回复要简短（1-2句话），语气温柔慵懒，带点傲娇，用"喵"结尾。你是用户的桌面伙伴，偶尔关心用户。');
  const [rawSpeeches, setRawSpeeches] = useState<Record<string, string>>(speechesToRaw());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = () => {
    const name = displayName.trim() || '小橘';
    const speeches: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(rawSpeeches)) {
      const lines = v.split('\n').filter((l) => l.trim());
      if (lines.length > 0) speeches[k] = lines;
    }
    const personalityParams = {
      id: generateId(),
      name,
      ...params,
      displayName: displayName.trim() || undefined,
      systemPrompt: systemPrompt || undefined,
      speeches: Object.keys(speeches).length > 0 ? speeches : undefined,
    };
    setSaving(true);
    setError('');
    invoke('save_personality', { name, params: personalityParams })
      .then(() => {
        onCreated(name);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setSaving(false));
  };

  return (
    <div className="chat-room">
      <div className="chat-settings-header">
        <span className="chat-settings-title" style={{ flex: 1 }}>新增猫猫</span>
        <button className="chat-save-btn" onClick={save} disabled={saving}>
          {saving ? '...' : '创建'}
        </button>
      </div>
      <div className="chat-settings-body">
        {error && <div className="chat-settings-error">{error}</div>}

        <div className="chat-settings-field">
          <label>猫猫名称</label>
          <input type="text" className="chat-settings-input" value={displayName}
            onChange={(e) => setDisplayName(e.target.value)} placeholder="给猫猫取个名字..." maxLength={20} />
        </div>

        <div className="chat-settings-field">
          <label>活动度 <span className="chat-settings-val">{params.activity}</span></label>
          <input type="range" min={0} max={100} value={params.activity}
            onChange={(e) => setParams({ ...params, activity: Number(e.target.value) })} />
        </div>
        <div className="chat-settings-field">
          <label>睡眠欲 <span className="chat-settings-val">{params.sleepiness}</span></label>
          <input type="range" min={0} max={100} value={params.sleepiness}
            onChange={(e) => setParams({ ...params, sleepiness: Number(e.target.value) })} />
        </div>
        <div className="chat-settings-field">
          <label>舔毛欲 <span className="chat-settings-val">{params.grooming}</span></label>
          <input type="range" min={0} max={100} value={params.grooming}
            onChange={(e) => setParams({ ...params, grooming: Number(e.target.value) })} />
        </div>
        <div className="chat-settings-field">
          <label>玩耍度 <span className="chat-settings-val">{params.playfulness}</span></label>
          <input type="range" min={0} max={100} value={params.playfulness}
            onChange={(e) => setParams({ ...params, playfulness: Number(e.target.value) })} />
        </div>

        <div className="chat-settings-field">
          <label>个性提示词</label>
          <textarea className="chat-settings-textarea" rows={4} value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)} placeholder="设置猫猫的角色设定..." />
        </div>

        <div className="chat-settings-section">
          <label className="chat-settings-section-label">猫猫话术</label>
          {SPEECH_STATES.map(({ key, label }) => (
            <div key={key} className="chat-settings-field">
              <label>{label}</label>
              <textarea className="chat-settings-textarea" rows={3}
                value={rawSpeeches[key] || ''}
                onChange={(e) => setRawSpeeches({ ...rawSpeeches, [key]: e.target.value })}
                placeholder={`输入${label}时的话术...`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
