import { useDrag } from '../hooks/useDrag';
import { useCatBehavior } from '../hooks/useCatBehavior';
import CatSprite from './CatSprite';
import SpeechBubble from './SpeechBubble';

function Cat() {
  const { handleMouseDown, handleDragStart } = useDrag();
  useCatBehavior();

  return (
    <div
      className="cat-container"
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
    >
      <SpeechBubble />
      <CatSprite />
    </div>
  );
}

export default Cat;
