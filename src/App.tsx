import { HashRouter, Routes, Route } from 'react-router-dom';
import Cat from './components/Cat';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/*" element={<Cat />} />
      </Routes>
    </HashRouter>
  );
}

export default App;