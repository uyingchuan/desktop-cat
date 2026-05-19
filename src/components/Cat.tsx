import { useDrag } from '../hooks/useDrag';
import { useCatBehavior } from '../hooks/useCatBehavior';
import CatSprite from './CatSprite';

function Cat() {
  const { handleMouseDown, handleDragStart } = useDrag();
  useCatBehavior();

  return (
    <div
      className="cat-container"
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
    >
      <CatSprite />
    </div>
  );
}

export default Cat;
