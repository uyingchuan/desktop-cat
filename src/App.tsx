import Cat from './components/Cat';
import PersonalityEditor from './components/PersonalityEditor';
import './App.css';

function App() {
  const hash = window.location.hash;
  if (hash === '#/settings') {
    return <PersonalityEditor />;
  }
  return <Cat />;
}

export default App;
