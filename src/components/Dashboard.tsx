import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ChatRoom from './ChatRoom';
import TodoPanel from './TodoPanel';
import PersonalityEditor from './PersonalityEditor';
import type { PersonalityParams } from '../types/pet';
import './Dashboard.css';

interface Config {
  active_personality: string;
  personalities: PersonalityParams[];
}

interface PersonalityInfo {
  name: string;
  id: string;
  label: string;
}

function Dashboard() {
  const [personalities, setPersonalities] = useState<PersonalityInfo[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  const loadPersonalities = useCallback(() => {
    invoke<Config>('get_config')
      .then((c) => {
        const infos: PersonalityInfo[] = (c.personalities || [])
          .map((p) => ({ name: p.name, id: p.id, label: p.displayName || p.name }));
        setPersonalities(infos);
      })
      .catch(() => {});
  }, []);

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
        </div>

        {/* 功能 tab */}
        <div className="sidebar-bottom-tabs">
          <div className="sidebar-divider" />
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
          <Route path="todo" element={<TodoPanel />} />
          <Route path="settings" element={<PersonalityEditor />} />
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

export default Dashboard;