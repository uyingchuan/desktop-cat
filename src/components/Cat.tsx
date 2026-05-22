import { useCallback, useRef } from 'react';
import { useCatBehavior } from '../hooks/useCatBehavior';
import { usePetStore } from '../stores/usePetStore';
import CatSprite from './CatSprite';
import SpeechBubble from './SpeechBubble';
import FloatingChatInput from './FloatingChatInput';

function Cat() {
  useCatBehavior();

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleClick = useCallback(() => {
    const state = usePetStore.getState();
    if (state.reminding) {
      state.setReminding(false);
      state.setSpeech('知道啦~继续工作吧!');
      return;
    }
    if (state.chatting) {
      clickTimerRef.current = setTimeout(() => {
        usePetStore.getState().setChatting(false);
        usePetStore.getState().setSpeech(null);
      }, 300);
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const { chatting, setChatting, setAnimationState } = usePetStore.getState();
    if (!chatting) {
      setChatting(true);
      setAnimationState('idle');
    }
  }, []);

  const chatting = usePetStore((s) => s.chatting);
  const reminding = usePetStore((s) => s.reminding);

  const enableDrag = !reminding && !chatting;

  return (
    <div
      className="cat-container"
      data-tauri-drag-region={enableDrag ? '' : undefined}
      onDragStart={handleDragStart}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <SpeechBubble />
      <CatSprite />
      {chatting && <FloatingChatInput />}
    </div>
  );
}

export default Cat;
