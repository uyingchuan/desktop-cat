import { useEffect, useRef } from 'react';
import { getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import { usePetStore } from '../stores/usePetStore';
import type { PetAnimationState, PetPosition } from '../types/pet';

const SCREEN_PADDING = 50;
const WALK_SPEED = 80;
const RUN_SPEED = 150;
const RUN_DISTANCE_THRESHOLD = 300;
const IDLE_MIN_MS = 3000;
const IDLE_MAX_MS = 8000;
const SLEEP_MIN_MS = 5000;
const SLEEP_MAX_MS = 15000;

// Action durations (ms) before returning to idle
const ACTION_DURATIONS: Record<string, number> = {
  playing: 800,
  floating: 1500,
  licking: 2000,
  attacking: 800,
};

// Walk-like states that use position animation
const MOVE_STATES: PetAnimationState[] = ['walking', 'running'];

export function useCatBehavior() {
  const {
    animationState,
    position,
    setPosition,
    setAnimationState,
    setFacingDirection,
  } = usePetStore();

  const positionRef = useRef<PetPosition>(position);
  const moveRafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleVariantRef = useRef<'idle' | 'idle2'>('idle');
  const appWindow = useRef(getCurrentWindow());

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Position sync: listen for window movement (user drags)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    appWindow.current.onMoved(({ payload }) => {
      const pos = { x: payload.x, y: payload.y };
      setPosition(pos.x, pos.y);
      positionRef.current = pos;
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [setPosition]);

  // Get initial position
  useEffect(() => {
    appWindow.current.outerPosition().then((pos) => {
      const p = { x: pos.x, y: pos.y };
      setPosition(p.x, p.y);
      positionRef.current = p;
    });
  }, [setPosition]);

  const generateTarget = (): PetPosition => {
    const screenW = window.screen.availWidth;
    const screenH = window.screen.availHeight;
    const current = positionRef.current;
    return {
      x: Math.max(SCREEN_PADDING, Math.min(screenW - 120 - SCREEN_PADDING,
        current.x + (Math.random() - 0.5) * 600)),
      y: Math.max(SCREEN_PADDING, Math.min(screenH - 120 - SCREEN_PADDING,
        current.y + (Math.random() - 0.5) * 400)),
    };
  };

  const getDistance = (a: PetPosition, b: PetPosition) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const startMoving = (target: PetPosition) => {
    const dist = getDistance(positionRef.current, target);
    const moveState: PetAnimationState = dist >= RUN_DISTANCE_THRESHOLD ? 'running' : 'walking';
    const speed = dist >= RUN_DISTANCE_THRESHOLD ? RUN_SPEED : WALK_SPEED;

    setAnimationState(moveState);

    const animate = () => {
      const current = positionRef.current;
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 3) {
        const nextIdle = idleVariantRef.current;
        setAnimationState(nextIdle);
        moveRafRef.current = null;
        return;
      }

      setFacingDirection(dx >= 0 ? 'right' : 'left');

      const step = speed / 60;
      const vx = (dx / dist) * step;
      const vy = (dy / dist) * step;
      const newPos = { x: current.x + vx, y: current.y + vy };

      positionRef.current = newPos;
      appWindow.current.setPosition(
        new LogicalPosition(Math.round(newPos.x), Math.round(newPos.y))
      );

      moveRafRef.current = requestAnimationFrame(animate);
    };

    moveRafRef.current = requestAnimationFrame(animate);
  };

  // Pick a random idle variant
  const pickIdle = (): 'idle' | 'idle2' => {
    return Math.random() < 0.5 ? 'idle' : 'idle2';
  };

  // Schedule next behavior from idle state
  const scheduleFromIdle = () => {
    const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
    timerRef.current = setTimeout(() => {
      const rand = Math.random();

      if (rand < 0.40) {
        // Switch idle variant
        const next = idleVariantRef.current === 'idle' ? 'idle2' : 'idle';
        idleVariantRef.current = next;
        setAnimationState(next);
      } else if (rand < 0.65) {
        // Walk or run (25%)
        startMoving(generateTarget());
      } else if (rand < 0.75) {
        // Sleep (10%)
        setAnimationState('sleeping');
      } else if (rand < 0.85) {
        // Lick (10%)
        setAnimationState('licking');
      } else if (rand < 0.90) {
        // Jump (5%)
        setAnimationState('playing');
      } else if (rand < 0.95) {
        // Float (5%)
        setAnimationState('floating');
      } else {
        // Attack (5%)
        setAnimationState('attacking');
      }
    }, delay);
  };

  // State machine
  useEffect(() => {
    // Clear any pending timeout from previous state
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Idle variants
    if (animationState === 'idle' || animationState === 'idle2') {
      idleVariantRef.current = animationState as 'idle' | 'idle2';
      scheduleFromIdle();
      return;
    }

    // Sleeping
    if (animationState === 'sleeping') {
      const delay = SLEEP_MIN_MS + Math.random() * (SLEEP_MAX_MS - SLEEP_MIN_MS);
      timerRef.current = setTimeout(() => {
        const next = pickIdle();
        idleVariantRef.current = next;
        setAnimationState(next);
      }, delay);
      return;
    }

    // Timed play actions
    const actionDuration = ACTION_DURATIONS[animationState];
    if (actionDuration) {
      timerRef.current = setTimeout(() => {
        const next = pickIdle();
        idleVariantRef.current = next;
        setAnimationState(next);
      }, actionDuration);
      return;
    }

    // Movement states: cleanup RAF on exit
    if (MOVE_STATES.includes(animationState)) {
      return () => {
        if (moveRafRef.current) {
          cancelAnimationFrame(moveRafRef.current);
          moveRafRef.current = null;
        }
      };
    }
  }, [animationState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
    };
  }, []);
}
