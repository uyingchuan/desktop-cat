import { useEffect, useRef } from 'react';
import { getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import { usePetStore } from '../stores/usePetStore';
import type { PetPosition } from '../types/pet';

const SCREEN_PADDING = 50;
const SPEED_PX_PER_SEC = 80;
const IDLE_MIN_MS = 3000;
const IDLE_MAX_MS = 8000;
const SLEEP_MIN_MS = 5000;
const SLEEP_MAX_MS = 15000;
const PLAY_DURATION_MS = 1200;
const PLAY_CHANCE = 0.2;
const WALK_CHANCE = 0.6;

export function useCatBehavior() {
  const {
    animationState,
    position,
    setPosition,
    setAnimationState,
    setFacingDirection,
  } = usePetStore();

  const positionRef = useRef<PetPosition>(position);
  const walkingRafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appWindow = useRef(getCurrentWindow());

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Position sync: listen for window movement (user drags via onMoved)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    appWindow.current.onMoved(({ payload }) => {
      const pos = { x: payload.x, y: payload.y };
      setPosition(pos.x, pos.y);
      positionRef.current = pos;
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [setPosition]);

  // Also get initial position
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
        current.x + (Math.random() - 0.5) * 400)),
      y: Math.max(SCREEN_PADDING, Math.min(screenH - 120 - SCREEN_PADDING,
        current.y + (Math.random() - 0.5) * 300)),
    };
  };

  const startWalking = (target: PetPosition) => {
    setAnimationState('walking');

    const animate = () => {
      const current = positionRef.current;
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 3) {
        setAnimationState('idle');
        walkingRafRef.current = null;
        return;
      }

      setFacingDirection(dx >= 0 ? 'right' : 'left');

      const speed = SPEED_PX_PER_SEC / 60;
      const vx = (dx / dist) * speed;
      const vy = (dy / dist) * speed;
      const newPos = { x: current.x + vx, y: current.y + vy };

      positionRef.current = newPos;
      appWindow.current.setPosition(
        new LogicalPosition(Math.round(newPos.x), Math.round(newPos.y))
      );

      walkingRafRef.current = requestAnimationFrame(animate);
    };

    walkingRafRef.current = requestAnimationFrame(animate);
  };

  const clearTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (walkingRafRef.current) {
      cancelAnimationFrame(walkingRafRef.current);
      walkingRafRef.current = null;
    }
  };

  // State machine
  useEffect(() => {
    clearTimers();

    if (animationState === 'idle') {
      const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
      timerRef.current = setTimeout(() => {
        const rand = Math.random();
        if (rand < PLAY_CHANCE) {
          setAnimationState('playing');
        } else if (rand < PLAY_CHANCE + WALK_CHANCE) {
          startWalking(generateTarget());
        } else {
          setAnimationState('sleeping');
        }
      }, delay);
      return;
    }

    if (animationState === 'sleeping') {
      const delay = SLEEP_MIN_MS + Math.random() * (SLEEP_MAX_MS - SLEEP_MIN_MS);
      timerRef.current = setTimeout(() => {
        setAnimationState('idle');
      }, delay);
      return;
    }

    if (animationState === 'playing') {
      timerRef.current = setTimeout(() => {
        setAnimationState('idle');
      }, PLAY_DURATION_MS);
      return;
    }

    // walking: cleanup is handled by the return
    return () => {
      if (walkingRafRef.current) {
        cancelAnimationFrame(walkingRafRef.current);
        walkingRafRef.current = null;
      }
    };
  }, [animationState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, []);
}
