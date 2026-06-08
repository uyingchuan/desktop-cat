import { useState, useEffect, useCallback, useRef } from 'react';
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

function getRoute(): { page: string; personalityId?: string; sub?: string } {
  const raw = window.location.hash.replace(/^#/, '') || '/dashboard';
  const hash = decodeURIComponent(raw);
  const parts = hash.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean);

  // /dashboard → 空
  // /dashboard/chat/calm → ['chat', 'calm']
  // /dashboard/chat/calm/settings → ['chat', 'calm', 'settings']
  // /dashboard/todo → ['todo']
  // /dashboard/settings → ['settings']

  if (parts.length === 0) return { page: 'chat' };
  if (parts[0] === 'chat') {
    if (parts.length === 1) return { page: 'chat' };
    if (parts.length === 2) return { page: 'chat', personalityId: parts[1] };
    return { page: 'chat', personalityId: parts[1], sub: parts[2] };
  }
  if (parts[0] === 'todo') return { page: 'todo' };
  if (parts[0] === 'settings') return { page: 'settings' };
  return { page: 'chat' };
}

function navigate(path: string) {
  window.location.hash = '#/dashboard' + path;
  // 手动触发 hashchange（某些浏览器设置相同 hash 不触发）
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function Dashboard() {
  const [personalities, setPersonalities] = useState<PersonalityInfo[]>([]);
  const [route, setRoute] = useState(getRoute());

  // 监听 hash 变化
  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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
        navigate(`/chat/${firstId}`);
      } else if (tab === 'todo') {
        navigate('/todo');
      } else if (tab === 'settings') {
        navigate('/settings');
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [personalities]);

  // chat-reload 事件
  useEffect(() => {
    const unlisten = listen('chat-reload', () => {
      const firstId = personalities[0]?.id || 'calm';
      navigate(`/chat/${firstId}`);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [personalities]);

  // /dashboard 重定向到第一个聊天室
  useEffect(() => {
    if (route.page === 'chat' && !route.personalityId && personalities.length > 0) {
      navigate(`/chat/${personalities[0].id}`);
    }
  }, [route, personalities]);

  // 确保 personalityId 有效（personalities 加载完成后才校验）
  const loadedRef = useRef(false);
  useEffect(() => {
    if (personalities.length > 0) {
      loadedRef.current = true;
    }
    if (!loadedRef.current) return;
    if (route.personalityId && personalities.length > 0) {
      const found = personalities.find((p) => p.id === route.personalityId);
      if (!found) {
        navigate(`/chat/${personalities[0].id}`);
      }
    }
  }, [route.personalityId, personalities]);

  const { page, personalityId, sub } = route;

  const chatTabs = personalities.map((p) => ({
    id: p.id,
    icon: '💬',
    label: p.label,
  }));

  const isActive = (tabId: string) => {
    if (tabId === 'todo') return page === 'todo';
    if (tabId === 'settings') return page === 'settings';
    return personalityId === tabId;
  };

  const renderContent = () => {
    switch (page) {
      case 'chat': {
        if (!personalityId) return null;
        const info = personalities.find((p) => p.id === personalityId);
        if (!info) return null;
        if (sub === 'settings') {
          return <ChatRoom personality={info.name} mode="settings" />;
        }
        return <ChatRoom personality={info.name} mode="chat" />;
      }
      case 'todo':
        return <TodoPanel />;
      case 'settings':
        return <PersonalityEditor />;
      default:
        return null;
    }
  };

  return (
    <div className="dashboard">
      <nav className="dashboard-sidebar">
        {/* 聊天 tab */}
        <div className="sidebar-chat-tabs">
          {chatTabs.map((tab) => (
            <button
              key={tab.id}
              className={`sidebar-tab ${isActive(tab.id) ? 'active' : ''}`}
              onClick={() => navigate(`/chat/${tab.id}`)}
              title={tab.label}
            >
              <span className="sidebar-tab-icon">{tab.icon}</span>
              <span className="sidebar-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 功能 tab */}
        <div className="sidebar-bottom-tabs">
          <div className="sidebar-divider" />
          <button
            className={`sidebar-tab ${page === 'todo' ? 'active' : ''}`}
            onClick={() => navigate('/todo')}
            title="备忘录"
          >
            <span className="sidebar-tab-icon">✅</span>
            <span className="sidebar-tab-label">备忘录</span>
          </button>
          <button
            className={`sidebar-tab ${page === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('/settings')}
            title="设置"
          >
            <span className="sidebar-tab-icon">⚙️</span>
            <span className="sidebar-tab-label">设置</span>
          </button>
        </div>
      </nav>
      <main className="dashboard-content" key={`${page}-${personalityId || ''}-${sub || ''}`}>
        {renderContent()}
      </main>
    </div>
  );
}

export default Dashboard;
