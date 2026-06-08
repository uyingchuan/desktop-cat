import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ChatRoom from './ChatRoom';
import TodoPanel from './TodoPanel';
import PersonalityEditor from './PersonalityEditor';
import { BUILTIN_PARAMS, BUILTIN_PERSONALITIES } from '../types/pet';
import type { PersonalityParams } from '../types/pet';
import './Dashboard.css';

interface Config {
  active_personality: string;
  custom_personalities: Record<string, PersonalityParams>;
}

interface DashboardProps {
  initialTab?: string;
}

interface TabDef {
  id: string;
  icon: string;
  label: string;
  component: React.ReactNode;
}

interface PersonalityInfo {
  name: string;
  id: string;
  label: string;
}

function getPersonalityInfo(name: string, config: Config | null): PersonalityInfo {
  const params = name in BUILTIN_PARAMS
    ? { ...BUILTIN_PARAMS[name], ...(config?.custom_personalities[name] || {}) }
    : config?.custom_personalities[name];
  const id = params?.id || name;
  const label = params?.displayName || (name === 'calm' ? '慵懒' : name === 'active' ? '活泼' : name);
  return { name, id, label };
}

function Dashboard({ initialTab = 'chat' }: DashboardProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [personalities, setPersonalities] = useState<PersonalityInfo[]>([]);

  // 加载猫格列表
  const loadPersonalities = useCallback(() => {
    invoke<Config>('get_config')
      .then((c) => {
        const names = [...BUILTIN_PERSONALITIES, ...Object.keys(c.custom_personalities || {})];
        // 去重（custom 可能覆盖内置同名 key）
        const seen = new Set<string>();
        const infos: PersonalityInfo[] = [];
        for (const name of names) {
          if (!seen.has(name)) {
            seen.add(name);
            infos.push(getPersonalityInfo(name, c));
          }
        }
        setPersonalities(infos);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadPersonalities(); }, [loadPersonalities]);

  // 监听猫格列表变化（新增/删除自定义猫格时刷新）
  useEffect(() => {
    const unlisten = listen('personality-list-changed', () => loadPersonalities());
    return () => { unlisten.then((fn) => fn()); };
  }, [loadPersonalities]);

  // 监听 Rust 托盘发出的导航事件
  useEffect(() => {
    const unlisten = listen<string>('navigate-tab', (event) => {
      const tab = event.payload;
      if (tab === 'chat') {
        setActiveTab(`chat_${personalities[0]?.id || 'calm'}`);
      } else {
        setActiveTab(tab);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [personalities]);

  // 监听 chat-reload 事件（托盘闪烁点击后触发）
  useEffect(() => {
    const unlisten = listen('chat-reload', () => {
      setActiveTab(`chat_${personalities[0]?.id || 'calm'}`);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [personalities]);

  // 确保 initialTab 在 personalities 加载后正确设置
  useEffect(() => {
    if (initialTab === 'chat' && personalities.length > 0) {
      setActiveTab(`chat_${personalities[0].id}`);
    }
  }, [initialTab, personalities]);

  // 聊天 tab（动态）
  const chatTabs: TabDef[] = personalities.map((p) => ({
    id: `chat_${p.id}`,
    icon: '💬',
    label: p.label,
    component: <ChatRoom personality={p.name} />,
  }));

  // 功能 tab（固定在底部）
  const bottomTabs: TabDef[] = [
    { id: 'todo', icon: '✅', label: '备忘录', component: <TodoPanel /> },
    { id: 'settings', icon: '⚙️', label: '设置', component: <PersonalityEditor /> },
  ];

  const allTabs = [...chatTabs, ...bottomTabs];
  const currentTab = allTabs.find((t) => t.id === activeTab) ?? chatTabs[0] ?? bottomTabs[0];

  return (
    <div className="dashboard">
      <nav className="dashboard-sidebar">
        {/* 聊天 tab 组（上方） */}
        <div className="sidebar-chat-tabs">
          {chatTabs.map((tab) => (
            <button
              key={tab.id}
              className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              <span className="sidebar-tab-icon">{tab.icon}</span>
              <span className="sidebar-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 功能 tab 组（底部） */}
        <div className="sidebar-bottom-tabs">
          <div className="sidebar-divider" />
          {bottomTabs.map((tab) => (
            <button
              key={tab.id}
              className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              <span className="sidebar-tab-icon">{tab.icon}</span>
              <span className="sidebar-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <main className="dashboard-content" key={activeTab}>
        {currentTab.component}
      </main>
    </div>
  );
}

export default Dashboard;
