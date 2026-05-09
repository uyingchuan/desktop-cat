import { useDrag } from '../hooks/useDrag';
import catImage from '../assets/cat3.png';

function Cat() {
  const { handleMouseDown, handleDragStart } = useDrag();

  return (
    <div
      className="cat-container"
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
    >
      <img
        src={catImage}
        alt="Desktop Cat"
        className="cat-image"
        draggable={false}
      />
      <span className='cart-name'>小猫咪</span>
    </div>
  );
}

export default Cat;
