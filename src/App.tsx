import Cat from './components/Cat';
import PersonalityEditor from './components/PersonalityEditor';
import ChatRoom from './components/ChatRoom';
import './App.css';

function App() {
  const hash = window.location.hash;
  if (hash === '#/settings') {
    return <PersonalityEditor />;
  }
  if (hash === '#/chat') {
    return <ChatRoom />;
  }
  return <Cat />;
}

export default App;
