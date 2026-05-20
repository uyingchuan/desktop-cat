import { usePetStore } from '../stores/usePetStore';
import { FRAME_SIZE, SPRITE_CONFIGS, SPRITE_MAP } from '../animation/spriteConfig';
import '../animation/animations.css';

function CatSprite() {
  const animationState = usePetStore((s) => s.animationState);
  const facingDirection = usePetStore((s) => s.facingDirection);

  const imageSrc = SPRITE_MAP[animationState]?.[facingDirection];
  const config = SPRITE_CONFIGS[animationState];

  return (
    <div
      className={`cat-sprite sprite-${animationState}`}
      style={{
        width: FRAME_SIZE,
        height: FRAME_SIZE,
        backgroundImage: `url(${imageSrc})`,
        backgroundSize: `${config.sheetWidth}px ${FRAME_SIZE}px`,
      }}
    />
  );
}

export default CatSprite;
