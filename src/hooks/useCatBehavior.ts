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

// 每个动作的持续时间（ms）
const ACTION_DURATIONS: Record<string, number> = {
  playing: 800,
  floating: 1500,
  licking: 2000,
  attacking: 800,
};

// 需要 RAF 移动窗口的动作
const MOVE_STATES: PetAnimationState[] = ['walking', 'running'];

interface Transition {
  state: PetAnimationState;
  weight: number;
}

// 状态转移表：每个动作只能转移到特定的后续动作，权重决定概率
const TRANSITIONS: Record<PetAnimationState, Transition[]> = {
  idle: [
    { state: 'idle2', weight: 30 },
    { state: 'walking', weight: 18 },
    { state: 'running', weight: 7 },
    { state: 'sleeping', weight: 15 },
    { state: 'licking', weight: 15 },
    { state: 'playing', weight: 5 },
    { state: 'floating', weight: 5 },
    { state: 'attacking', weight: 5 },
  ],
  idle2: [
    { state: 'idle', weight: 30 },
    { state: 'walking', weight: 18 },
    { state: 'running', weight: 7 },
    { state: 'sleeping', weight: 15 },
    { state: 'licking', weight: 15 },
    { state: 'playing', weight: 5 },
    { state: 'floating', weight: 5 },
    { state: 'attacking', weight: 5 },
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
    { state: 'idle', weight: 35 },
    { state: 'idle2', weight: 35 },
    { state: 'sleeping', weight: 30 },
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

/**
 * 根据当前状态，从转移表中按权重随机选择下一个状态
 */
function pickNext(current: PetAnimationState): PetAnimationState {
  const transitions = TRANSITIONS[current];
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

  // 监听窗口移动（用户拖动），同步位置到 store
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

  // 根据目标距离自动选择 walking 或 running
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
        // 到达目标，按转移规则选择下一个状态
        const next = pickNext(moveState);
        if (next === 'idle' || next === 'idle2') {
          idleVariantRef.current = next;
        }
        setAnimationState(next);
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

  // 从转移表安排下一个行为
  const scheduleNext = () => {
    const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
    timerRef.current = setTimeout(() => {
      const current = idleVariantRef.current;
      const next = pickNext(current);
      if (next === 'idle' || next === 'idle2') {
        idleVariantRef.current = next;
      }
      if (next === 'walking' || next === 'running') {
        startMoving(generateTarget());
      } else {
        setAnimationState(next);
      }
    }, delay);
  };

  // 状态机
  useEffect(() => {
    // 清除上一状态的定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 待机变体：等待后按转移表选择下一个动作
    if (animationState === 'idle' || animationState === 'idle2') {
      idleVariantRef.current = animationState as 'idle' | 'idle2';
      scheduleNext();
      return;
    }

    // 睡眠：到时后按转移表选择
    if (animationState === 'sleeping') {
      const delay = SLEEP_MIN_MS + Math.random() * (SLEEP_MAX_MS - SLEEP_MIN_MS);
      timerRef.current = setTimeout(() => {
        const next = pickNext('sleeping');
        idleVariantRef.current = next as 'idle' | 'idle2';
        setAnimationState(next);
      }, delay);
      return;
    }

    // 有持续时间限制的动作：到时后按转移表选择
    const actionDuration = ACTION_DURATIONS[animationState];
    if (actionDuration) {
      timerRef.current = setTimeout(() => {
        const next = pickNext(animationState);
        if (next === 'idle' || next === 'idle2') {
          idleVariantRef.current = next;
        }
        setAnimationState(next);
      }, actionDuration);
      return;
    }

    // 行走/奔跑：退出时取消 RAF
    if (MOVE_STATES.includes(animationState)) {
      return () => {
        if (moveRafRef.current) {
          cancelAnimationFrame(moveRafRef.current);
          moveRafRef.current = null;
        }
      };
    }
  }, [animationState]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
    };
  }, []);
}
