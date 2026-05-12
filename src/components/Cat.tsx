import { useEffect, useRef } from 'react';
import { useDrag } from '../hooks/useDrag';
import { usePetStore } from '../stores/usePetStore';
import { PetEngine } from '../engine/petEngine';

// import idleSprite from '../assets/sprites/up.png';
// import leftSprite from '../assets/sprites/left.png';

import bg4K from '../assets/mania/4K/bg.png';

import leftUp from '../assets/mania/leftup.png';
import left0 from '../assets/mania/left0.png';
import left1 from '../assets/mania/left1.png';
// import left2 from '../assets/mania/left2.png';

import rightUp from '../assets/mania/rightup.png';
import right0 from '../assets/mania/right0.png';
// import right1 from '../assets/mania/right1.png';
import right2 from '../assets/mania/right2.png';

import k1 from '../assets/mania/4K/0.png';
import k2 from '../assets/mania/4K/1.png';
import k3 from '../assets/mania/4K/2.png';
import k4 from '../assets/mania/4K/3.png';

// import rightSprite from '../assets/sprites/right.png';

const leftHandAction: Record<number, string> = {
  0: leftUp,
  1: left0,
  2: left1,
};

const rightHandAction: Record<number, string> = {
  0: rightUp,
  3: right0,
  4: right2,
};

const keyboardEffect: Record<number, string> = {
  1: k1,
  2: k2,
  3: k3,
  4: k4,
}

function Cat() {
  const activeZone = usePetStore((s) => s.activeZone);
  const engineRef = useRef<PetEngine | null>(null);
  const { handleMouseDown, handleDragStart } = useDrag();

  useEffect(() => {
    const engine = new PetEngine();
    engineRef.current = engine;
    engine.start();
    return () => { engine.stop(); };
  }, []);

  return (
    <div
      className="cat-container"
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
    >
      {/* 左手 */}
      <img
        src={leftHandAction[activeZone] ?? leftHandAction[0]}
        alt="Left Hand"
        className="cat-image-left-hand"
        draggable={false}
      />
      {/* 右手 */}
      <img
        src={rightHandAction[activeZone] ?? rightHandAction[0]}
        alt="Left Hand"
        className="cat-image-left-hand"
        draggable={false}
      />
      {/* 键盘背景 */}
      <img
        src={bg4K}
        alt="Desktop Cat"
        className="cat-image-bg"
        draggable={false}
      />
      {/* 按键效果 */}
      {
        activeZone !== 0 && <img
              src={keyboardEffect[activeZone]}
              alt="Keyboard Effect"
              className="cat-image-left-hand"
              draggable={false}
          />
      }
    </div>
  );
}

export default Cat;
/*
*
* ascasl;k\'';skdl;jwqifklk;AAJAL;SMCAKVMASMK;'GGJ'AKS
* */
