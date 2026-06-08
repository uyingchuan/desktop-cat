import Cat from './components/Cat';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const hash = window.location.hash.replace(/^#/, '');

  if (hash.startsWith('/dashboard')) {
    return <Dashboard />;
  }

  // 主猫咪浮动窗口
  return <Cat />;
}

export default App;
