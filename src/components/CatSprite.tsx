import { usePetStore } from '../stores/usePetStore';
import {
  FRAME_SIZE,
  SPRITE_CONFIGS,
  SPRITE_MAP,
  ANIMATION_SPRITE_KEY,
} from '../animation/spriteConfig';
import '../animation/animations.css';

function CatSprite() {
  const animationState = usePetStore((s) => s.animationState);
  const facingDirection = usePetStore((s) => s.facingDirection);

  const spriteKey = ANIMATION_SPRITE_KEY[animationState];
  const imageSrc = SPRITE_MAP[spriteKey]?.[facingDirection];
  const config = SPRITE_CONFIGS[spriteKey];
  const cssClass = `sprite-${animationState}`;

  return (
    <div
      className={`cat-sprite ${cssClass}`}
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
