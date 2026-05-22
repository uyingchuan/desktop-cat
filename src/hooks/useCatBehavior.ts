import { useEffect, useRef } from 'react';
import { getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { usePetStore } from '../stores/usePetStore';
import type { PetAnimationState, PetPosition,   PersonalityParams } from '../types/pet';
import { BUILTIN_PARAMS } from '../types/pet';

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

const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const REMINDER_SPEECHES = [
  '该休息一下了~',
  '起来活动活动吧',
  '工作这么久，喝点水吧',
  '眼睛要休息一下哦',
  '伸个懒腰吧~',
  '喵~休息一会儿吧',
  '别太累了哦',
  '站起来走走~',
];

const MOVE_STATES: PetAnimationState[] = ['walking', 'running'];

interface Transition {
  state: PetAnimationState;
  weight: number;
}

type TransitionTable = Record<PetAnimationState, Transition[]>;

/** 将 4 个高级人格参数映射为完整的转移表 */
function paramsToTransitionTable(p: PersonalityParams): TransitionTable {
  // idle/idle2 的转移权重直接由参数值决定
  const walk = Math.round(p.activity * 0.5);
  const run = Math.round(p.activity * 0.5);
  const sleep = p.sleepiness;
  const lick = p.grooming;
  const play = Math.round(p.playfulness * 0.34);
  const flt = Math.round(p.playfulness * 0.33);
  const atk = Math.round(p.playfulness * 0.33);

  const actionsSum = walk + run + sleep + lick + play + flt + atk;
  const idleSwap = Math.max(5, 100 - actionsSum);

  const idleActions: Transition[] = [
    { state: 'idle2', weight: idleSwap },
    { state: 'walking', weight: walk },
    { state: 'running', weight: run },
    { state: 'sleeping', weight: sleep },
    { state: 'licking', weight: lick },
    { state: 'playing', weight: play },
    { state: 'floating', weight: flt },
    { state: 'attacking', weight: atk },
  ];

  const idle2Actions: Transition[] = [
    { state: 'idle', weight: idleSwap },
    { state: 'walking', weight: walk },
    { state: 'running', weight: run },
    { state: 'sleeping', weight: sleep },
    { state: 'licking', weight: lick },
    { state: 'playing', weight: play },
    { state: 'floating', weight: flt },
    { state: 'attacking', weight: atk },
  ];
  console.log(idle2Actions, idleActions);

  // 活跃度高 → 走动后可能继续玩；否则走完就回 idle
  const walkConclusion: Transition[] = p.activity > 50
    ? [
        { state: 'idle', weight: 30 },
        { state: 'idle2', weight: 30 },
        { state: 'licking', weight: 15 },
        { state: 'playing', weight: 10 },
        { state: 'floating', weight: 10 },
        { state: 'attacking', weight: 5 },
      ]
    : [
        { state: 'idle', weight: 35 },
        { state: 'idle2', weight: 35 },
        { state: 'licking', weight: 30 },
      ];

  const runConclusion: Transition[] = p.activity > 50
    ? [
        { state: 'idle', weight: 40 },
        { state: 'idle2', weight: 40 },
        { state: 'playing', weight: 10 },
        { state: 'attacking', weight: 10 },
      ]
    : [
        { state: 'idle', weight: 50 },
        { state: 'idle2', weight: 50 },
      ];

  // 玩耍结束后，活跃度高则可能接着走
  const playConclusion: Transition[] = p.activity > 50
    ? [
        { state: 'idle', weight: 40 },
        { state: 'idle2', weight: 40 },
        { state: 'walking', weight: 10 },
        { state: 'running', weight: 10 },
      ]
    : [
        { state: 'idle', weight: 50 },
        { state: 'idle2', weight: 50 },
      ];

  return {
    idle: idleActions,
    idle2: idle2Actions,
    walking: walkConclusion,
    running: runConclusion,
    sleeping: [
      { state: 'idle', weight: 50 },
      { state: 'idle2', weight: 50 },
    ],
    licking: [
      { state: 'idle', weight: 30 },
      { state: 'idle2', weight: 30 },
      { state: 'sleeping', weight: 40 },
    ],
    playing: playConclusion,
    floating: playConclusion,
    attacking: playConclusion,
    hurt: [{ state: 'idle', weight: 100 }],
    dead: [{ state: 'idle', weight: 100 }],
  };
}

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
    personalityParams,
    reminding,
    reminderEnabled,
    setPosition,
    setAnimationState,
    setFacingDirection,
    setPersonality,
    setPersonalityParams,
    setSpeech,
    setShowText,
    setReminding,
    setReminderEnabled,
  } = usePetStore();

  // 从参数生成权重表
  const tableRef = useRef<TransitionTable>(paramsToTransitionTable(personalityParams));

  useEffect(() => {
    tableRef.current = paramsToTransitionTable(personalityParams);
  }, [personalityParams]);

  const pick = (current: PetAnimationState) => pickNext(current, tableRef.current);

  const positionRef = useRef<PetPosition>(position);
  const moveRafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleVariantRef = useRef<'idle' | 'idle2'>('idle');
  const prevStateRef = useRef<PetAnimationState>('idle');
  const appWindow = useRef(getCurrentWindow());
  const reminderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reminderLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 切换人格时同步更新 params
  const applyPersonality = (name: string) => {
    setPersonality(name);
    if (name in BUILTIN_PARAMS) {
      setPersonalityParams(BUILTIN_PARAMS[name]);
    } else {
      // 自定义人格：从 Rust 配置中获取参数
      invoke<{ custom_personalities: Record<string, PersonalityParams> }>('get_config')
        .then((config) => {
          if (config.custom_personalities[name]) {
            setPersonalityParams(config.custom_personalities[name]);
          }
        })
        .catch(() => {});
    }
  };

  // 监听来自 Rust 托盘菜单的性格切换事件（运行时切换）
  useEffect(() => {
    const unlisten = listen<string>('personality-changed', (event) => {
      applyPersonality(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setPersonality]);

  // 监听来自 Rust 托盘菜单的文本显示开关事件
  useEffect(() => {
    const unlisten = listen<boolean>('text-visibility-changed', (event) => {
      setShowText(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setShowText]);

  // 监听来自 Rust 托盘菜单的提醒开关事件
  useEffect(() => {
    const unlisten = listen<boolean>('reminder-toggled', (event) => {
      setReminderEnabled(event.payload);
      if (!event.payload) {
        setReminding(false);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setReminderEnabled, setReminding]);

  // 启动时从 Rust 命令拉取持久化的猫格
  useEffect(() => {
    invoke<{ active_personality: string; custom_personalities: Record<string, PersonalityParams>; show_text: boolean; reminder_enabled: boolean }>('get_config')
      .then((config) => {
        const name = config.active_personality;
        setPersonality(name);
        setShowText(config.show_text);
        setReminderEnabled(config.reminder_enabled);
        if (name in BUILTIN_PARAMS) {
          setPersonalityParams(BUILTIN_PARAMS[name]);
        } else if (config.custom_personalities[name]) {
          setPersonalityParams(config.custom_personalities[name]);
        }
      })
      .catch(() => {});
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

  // 内置默认话术
  const DEFAULT_SPEECHES: Record<string, string[]> = {
    idle:   ['喵?', '嗯?', '什么声音?'],
    idle2:  ['喵?', '嗯?', '什么声音?'],
    walking:['走一走~', '溜达溜达', '散个步', '逛逛'],
    running:['冲鸭!', '跑起来!', '追!'],
    sleeping:['睡醒了...', '喵~好舒服', '伸个懒腰~'],
    playing:['嘿!', '跳!', '喵!'],
    floating:['飞起来~', '飘呀飘', '好轻盈'],
    licking:['舔舔毛', '要干净', '美美的'],
    attacking:['嗷呜!', '看爪!', '抓到你了!'],
  };

  // 优先用自定义话术，为空则用内置默认
  const pickSpeech = (state: PetAnimationState): string | null => {
    const custom = personalityParams.speeches?.[state];
    const pool = (custom && custom.length > 0) ? custom : DEFAULT_SPEECHES[state];
    if (!pool) return null;
    return pool[Math.floor(Math.random() * pool.length)];
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
    // 30% 概率触发气泡；idle↔idle2 自身互换不说，但从其他动作切回来可以说
    const isIdle = next === 'idle' || next === 'idle2';
    const wasIdle = prevStateRef.current === 'idle' || prevStateRef.current === 'idle2';
    // eslint-disable-next-line react-hooks/purity
    if (!(isIdle && wasIdle) && Math.random() < 0.3 && usePetStore.getState().showText) {
      const msg = pickSpeech(next);
      if (msg) setSpeech(msg);
    }
  };

  const scheduleNext = () => {
    const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
    timerRef.current = setTimeout(() => {
      transitionTo(pick(idleVariantRef.current));
    }, delay);
  };

  // 状态机 — 提醒模式下完全旁路
  useEffect(() => {
    if (reminding) return;

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
  }, [animationState, reminding]);

  // 提醒模式循环：走动 → 待机 → 说话 → 延迟 → 走动 ...
  useEffect(() => {
    if (!reminding) {
      if (reminderLoopRef.current) {
        clearTimeout(reminderLoopRef.current);
        reminderLoopRef.current = null;
      }
      if (moveRafRef.current) {
        cancelAnimationFrame(moveRafRef.current);
        moveRafRef.current = null;
      }
      setAnimationState('idle');
      return;
    }

    const remindWalk = () => {
      const target = generateTarget();
      const dist = getDistance(positionRef.current, target);
      const moveState: PetAnimationState = dist >= RUN_DISTANCE_THRESHOLD ? 'running' : 'walking';
      setAnimationState(moveState);

      const speed = dist >= RUN_DISTANCE_THRESHOLD ? RUN_SPEED : WALK_SPEED;

      const animate = () => {
        const current = positionRef.current;
        const dx = target.x - current.x;
        const dy = target.y - current.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d < 3) {
          moveRafRef.current = null;
          // 到达 → 待机 + 说话
          setAnimationState('idle');
          const msg = REMINDER_SPEECHES[Math.floor(Math.random() * REMINDER_SPEECHES.length)];
          setSpeech(msg);
          // 说话显示 2.5s 后短暂延迟，然后继续走动
          reminderLoopRef.current = setTimeout(() => {
            remindWalk();
          }, 2500 + 1500);
          return;
        }

        setFacingDirection(dx >= 0 ? 'right' : 'left');

        const step = speed / 60;
        const vx = (dx / d) * step;
        const vy = (dy / d) * step;
        const newPos = { x: current.x + vx, y: current.y + vy };

        positionRef.current = newPos;
        appWindow.current.setPosition(
          new LogicalPosition(Math.round(newPos.x), Math.round(newPos.y))
        );

        moveRafRef.current = requestAnimationFrame(animate);
      };

      moveRafRef.current = requestAnimationFrame(animate);
    };

    // 清除当前动作，开始提醒循环
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (moveRafRef.current) { cancelAnimationFrame(moveRafRef.current); moveRafRef.current = null; }

    remindWalk();

    return () => {
      if (reminderLoopRef.current) {
        clearTimeout(reminderLoopRef.current);
        reminderLoopRef.current = null;
      }
    };
  }, [reminding]);

  // 30 分钟提醒计时器
  useEffect(() => {
    const startTimer = () => {
      reminderTimerRef.current = setTimeout(() => {
        setReminding(true);
      }, REMINDER_INTERVAL_MS);
    };

    if (reminding || !reminderEnabled) {
      if (reminderTimerRef.current) {
        clearTimeout(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }
      return;
    }

    startTimer();

    return () => {
      if (reminderTimerRef.current) {
        clearTimeout(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }
    };
  }, [reminding, reminderEnabled]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
      if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);
      if (reminderLoopRef.current) clearTimeout(reminderLoopRef.current);
    };
  }, []);
}
