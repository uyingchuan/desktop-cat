import Cat from './components/Cat';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const hash = window.location.hash;

  // Dashboard 统一窗口：通过 tab 参数指定初始标签
  if (hash.startsWith('#/dashboard')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const initialTab = params.get('tab') || 'chat';
    return <Dashboard initialTab={initialTab} />;
  }

  // 主猫咪窗口（无哈希）
  return <Cat />;
}

export default App;
