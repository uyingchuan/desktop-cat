import { useEffect, useRef } from 'react';
import { getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { usePetStore } from '../stores/usePetStore';
import type { PetAnimationState, PetPosition, Personality } from '../types/pet';

const SCREEN_PADDING = 50;
const WALK_SPEED = 80;
const RUN_SPEED = 150;
const RUN_DISTANCE_THRESHOLD = 300;
const IDLE_MIN_MS = 3000;
const IDLE_MAX_MS = 8000;
const SLEEP_MIN_MS = 5000;
const SLEEP_MAX_MS = 15000;

const ACTION_DURATIONS: Record<string, number> = {
  playing: 800,
  floating: 1500,
  licking: 2000,
  attacking: 800,
};

const MOVE_STATES: PetAnimationState[] = ['walking', 'running'];

interface Transition {
  state: PetAnimationState;
  weight: number;
}

type TransitionTable = Record<PetAnimationState, Transition[]>;

// 慵懒性格：安静、爱舔毛、爱睡觉、少动
const CALM_TRANSITIONS: TransitionTable = {
  idle: [
    { state: 'idle2', weight: 30 },
    { state: 'walking', weight: 15 },
    { state: 'running', weight: 5 },
    { state: 'sleeping', weight: 20 },
    { state: 'licking', weight: 18 },
    { state: 'playing', weight: 4 },
    { state: 'floating', weight: 4 },
    { state: 'attacking', weight: 4 },
  ],
  idle2: [
    { state: 'idle', weight: 30 },
    { state: 'walking', weight: 15 },
    { state: 'running', weight: 5 },
    { state: 'sleeping', weight: 20 },
    { state: 'licking', weight: 18 },
    { state: 'playing', weight: 4 },
    { state: 'floating', weight: 4 },
    { state: 'attacking', weight: 4 },
  ],
  walking: [
    { state: 'idle', weight: 35 },
    { state: 'idle2', weight: 35 },
    { state: 'licking', weight: 30 },
  ],
  running: [
    { state: 'idle', weight: 50 },
    { state: 'idle2', weight: 50 },
  ],
  sleeping: [
    { state: 'idle', weight: 50 },
    { state: 'idle2', weight: 50 },
  ],
  licking: [
    { state: 'idle', weight: 30 },
    { state: 'idle2', weight: 30 },
    { state: 'sleeping', weight: 40 },
  ],
  playing: [
    { state: 'idle', weight: 50 },
    { state: 'idle2', weight: 50 },
  ],
  floating: [
    { state: 'idle', weight: 50 },
    { state: 'idle2', weight: 50 },
  ],
  attacking: [
    { state: 'idle', weight: 50 },
    { state: 'idle2', weight: 50 },
  ],
  hurt: [
    { state: 'idle', weight: 100 },
  ],
  dead: [
    { state: 'idle', weight: 100 },
  ],
};

// 活泼性格：好动、爱跑爱跳、不爱睡觉
const ACTIVE_TRANSITIONS: TransitionTable = {
  idle: [
    { state: 'idle2', weight: 20 },
    { state: 'walking', weight: 25 },
    { state: 'running', weight: 15 },
    { state: 'sleeping', weight: 5 },
    { state: 'licking', weight: 10 },
    { state: 'playing', weight: 10 },
    { state: 'floating', weight: 8 },
    { state: 'attacking', weight: 7 },
  ],
  idle2: [
    { state: 'idle', weight: 20 },
    { state: 'walking', weight: 25 },
    { state: 'running', weight: 15 },
    { state: 'sleeping', weight: 5 },
    { state: 'licking', weight: 10 },
    { state: 'playing', weight: 10 },
    { state: 'floating', weight: 8 },
    { state: 'attacking', weight: 7 },
  ],
  walking: [
    { state: 'idle', weight: 30 },
    { state: 'idle2', weight: 30 },
    { state: 'licking', weight: 15 },
    { state: 'playing', weight: 10 },
    { state: 'floating', weight: 10 },
    { state: 'attacking', weight: 5 },
  ],
  running: [
    { state: 'idle', weight: 40 },
    { state: 'idle2', weight: 40 },
    { state: 'playing', weight: 10 },
    { state: 'attacking', weight: 10 },
  ],
  sleeping: [
    { state: 'idle', weight: 50 },
    { state: 'idle2', weight: 50 },
  ],
  licking: [
    { state: 'idle', weight: 35 },
    { state: 'idle2', weight: 35 },
    { state: 'sleeping', weight: 30 },
  ],
  playing: [
    { state: 'idle', weight: 40 },
    { state: 'idle2', weight: 40 },
    { state: 'walking', weight: 10 },
    { state: 'running', weight: 10 },
  ],
  floating: [
    { state: 'idle', weight: 40 },
    { state: 'idle2', weight: 40 },
    { state: 'walking', weight: 10 },
    { state: 'running', weight: 10 },
  ],
  attacking: [
    { state: 'idle', weight: 40 },
    { state: 'idle2', weight: 40 },
    { state: 'walking', weight: 10 },
    { state: 'running', weight: 10 },
  ],
  hurt: [
    { state: 'idle', weight: 100 },
  ],
  dead: [
    { state: 'idle', weight: 100 },
  ],
};

function pickNext(current: PetAnimationState, table: TransitionTable): PetAnimationState {
  const transitions = table[current];
  if (!transitions || transitions.length === 0) {
    return 'idle';
  }

  const totalWeight = transitions.reduce((sum, t) => sum + t.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const t of transitions) {
    rand -= t.weight;
    if (rand <= 0) return t.state;
  }

  return transitions[transitions.length - 1].state;
}

export function useCatBehavior() {
  const {
    animationState,
    position,
    personality,
    setPosition,
    setAnimationState,
    setFacingDirection,
    setPersonality,
  } = usePetStore();

  // 根据当前性格选择权重表
  const tableRef = useRef<TransitionTable>(
    personality === 'active' ? ACTIVE_TRANSITIONS : CALM_TRANSITIONS
  );
  const personalityRef = useRef<Personality>(personality);

  useEffect(() => {
    personalityRef.current = personality;
    tableRef.current = personality === 'active' ? ACTIVE_TRANSITIONS : CALM_TRANSITIONS;
  }, [personality]);

  const pick = (current: PetAnimationState) => pickNext(current, tableRef.current);

  const positionRef = useRef<PetPosition>(position);
  const moveRafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleVariantRef = useRef<'idle' | 'idle2'>('idle');
  const appWindow = useRef(getCurrentWindow());

  // 监听来自 Rust 托盘菜单的性格切换事件
  useEffect(() => {
    const unlisten = listen<string>('personality-changed', (event) => {
      const p = event.payload as Personality;
      setPersonality(p);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setPersonality]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // 监听窗口移动（用户拖动）
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    appWindow.current.onMoved(({ payload }) => {
      const pos = { x: payload.x, y: payload.y };
      setPosition(pos.x, pos.y);
      positionRef.current = pos;
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [setPosition]);

  // 获取窗口初始位置
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
        moveRafRef.current = null;
        transitionTo(pick(moveState));
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

  // 统一的状态切换入口：自动判断是否需要 startMoving
  const transitionTo = (next: PetAnimationState) => {
    if (next === 'idle' || next === 'idle2') {
      idleVariantRef.current = next;
    }
    if (next === 'walking' || next === 'running') {
      startMoving(generateTarget());
    } else {
      setAnimationState(next);
    }
  };

  const scheduleNext = () => {
    const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
    timerRef.current = setTimeout(() => {
      transitionTo(pick(idleVariantRef.current));
    }, delay);
  };

  // 状态机
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (animationState === 'idle' || animationState === 'idle2') {
      idleVariantRef.current = animationState as 'idle' | 'idle2';
      scheduleNext();
      return;
    }

    if (animationState === 'sleeping') {
      const delay = SLEEP_MIN_MS + Math.random() * (SLEEP_MAX_MS - SLEEP_MIN_MS);
      timerRef.current = setTimeout(() => {
        transitionTo(pick('sleeping'));
      }, delay);
      return;
    }

    const actionDuration = ACTION_DURATIONS[animationState];
    if (actionDuration) {
      timerRef.current = setTimeout(() => {
        transitionTo(pick(animationState));
      }, actionDuration);
      return;
    }

    if (MOVE_STATES.includes(animationState)) {
      return () => {
        if (moveRafRef.current) {
          cancelAnimationFrame(moveRafRef.current);
          moveRafRef.current = null;
        }
      };
    }
  }, [animationState]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
    };
  }, []);
}
