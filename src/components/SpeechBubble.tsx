import { useEffect } from 'react';
import { usePetStore } from '../stores/usePetStore';
import './SpeechBubble.css';

function SpeechBubble() {
  const speech = usePetStore((s) => s.speech);
  const setSpeech = usePetStore((s) => s.setSpeech);

  useEffect(() => {
    if (!speech) return;
    const t = setTimeout(() => setSpeech(null), 2500);
    return () => clearTimeout(t);
  }, [speech, setSpeech]);

  if (!speech) return null;

  return <div className="speech-bubble">{speech}</div>;
}

export default SpeechBubble;
