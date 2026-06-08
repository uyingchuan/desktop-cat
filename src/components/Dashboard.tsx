import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import ChatRoom from './ChatRoom';
import TodoPanel from './TodoPanel';
import PersonalityEditor from './PersonalityEditor';
import './Dashboard.css';

interface DashboardProps {
  initialTab?: string;
}

interface TabDef {
  id: string;
  icon: string;
  label: string;
  component: React.ReactNode;
}

function Dashboard({ initialTab = 'chat' }: DashboardProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // 监听 Rust 托盘菜单发出的导航事件
  useEffect(() => {
    const unlisten = listen<string>('navigate-tab', (event) => {
      setActiveTab(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // 监听 chat-reload 事件（托盘闪烁点击后触发）
  useEffect(() => {
    const unlisten = listen('chat-reload', () => {
      setActiveTab('chat');
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // 监听 todo-reminder-fired 事件（提醒触发后刷新）
  useEffect(() => {
    const unlisten = listen('todo-reminder-fired', () => {
      // TodoPanel 自己也会监听此事件来刷新数据，这里只需确保标签已激活
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const tabs: TabDef[] = [
    { id: 'chat', icon: '💬', label: '聊天', component: <ChatRoom /> },
    { id: 'todo', icon: '✅', label: '备忘录', component: <TodoPanel /> },
    { id: 'settings', icon: '⚙️', label: '设置', component: <PersonalityEditor /> },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div className="dashboard">
      <nav className="dashboard-sidebar">
        {tabs.map((tab) => (
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
      </nav>
      <main className="dashboard-content" key={activeTab}>
        {currentTab.component}
      </main>
    </div>
  );
}

export default Dashboard;
