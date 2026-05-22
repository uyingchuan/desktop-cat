import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCatBehavior } from '../hooks/useCatBehavior';
import { usePetStore } from '../stores/usePetStore';
import CatSprite from './CatSprite';
import SpeechBubble from './SpeechBubble';

function Cat() {
  useCatBehavior();

  const handleMouseDown = useCallback(() => {
    if (!usePetStore.getState().reminding) {
      getCurrentWindow().startDragging().catch((err) => {
        console.error('Failed to start window dragging:', err);
      });
    }
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleClick = useCallback(() => {
    const state = usePetStore.getState();
    if (state.reminding) {
      state.setReminding(false);
      state.setSpeech('知道啦~继续工作吧!');
    }
  }, []);

  return (
    <div
      className="cat-container"
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
      onClick={handleClick}
    >
      <SpeechBubble />
      <CatSprite />
    </div>
  );
}

export default Cat;
