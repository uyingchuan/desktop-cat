export type Personality = string;

// 猫格简化参数（4 个高级滑块映射到底层权重表）
export interface PersonalityParams {
  id: string;          // 不可变唯一标识
  name: string;        // 内部名称
  activity: number;    // 0-100  活动度 → walking + running
  sleepiness: number;  // 0-100  睡眠欲 → sleeping
  grooming: number;    // 0-100  舔毛欲 → licking
  playfulness: number; // 0-100  玩耍度 → playing + floating + attacking
  speeches?: Record<string, string[]>; // 自定义话术，key 为动画状态名
  systemPrompt?: string; // 聊天系统提示词
  displayName?: string; // 猫猫展示名称
  lastChatTime?: number; // 最后聊天时间戳（秒）
}

// 默认话术
export const DEFAULT_SPEECHES: Record<string, string[]> = {
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

export const SPEECH_STATES = [
  { key: 'idle', label: '待机' },
  { key: 'walking', label: '走路' },
  { key: 'running', label: '跑步' },
  { key: 'sleeping', label: '睡醒' },
  { key: 'licking', label: '舔毛' },
  { key: 'playing', label: '跳跃' },
  { key: 'floating', label: '漂浮' },
  { key: 'attacking', label: '攻击' },
];

export function speechesToRaw(custom?: Record<string, string[]>): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const { key } of SPEECH_STATES) {
    const src = custom?.[key]?.length ? custom[key] : (DEFAULT_SPEECHES[key] || []);
    raw[key] = src.join('\n');
  }
  return raw;
}

export type PetAnimationState =
  | 'idle' | 'idle2'
  | 'walking' | 'running'
  | 'sleeping'
  | 'playing'
  | 'floating'
  | 'licking'
  | 'attacking'
  | 'hurt'
  | 'dead';

export type PetMood = 'happy' | 'neutral' | 'sleepy';

export type FacingDirection = 'left' | 'right';

export interface PetPosition {
  x: number;
  y: number;
}

export interface PetState {
  position: PetPosition;
  animationState: PetAnimationState;
  mood: PetMood;
  facingDirection: FacingDirection;
  personality: Personality;
  personalityParams: PersonalityParams;
  speech: string | null;
  showText: boolean;
  reminding: boolean;
  reminderEnabled: boolean;
  chatting: boolean;
}
