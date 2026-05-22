export type Personality = string;

// 猫格简化参数（4 个高级滑块映射到底层权重表）
export interface PersonalityParams {
  activity: number;    // 0-100  活动度 → walking + running
  sleepiness: number;  // 0-100  睡眠欲 → sleeping
  grooming: number;    // 0-100  舔毛欲 → licking
  playfulness: number; // 0-100  玩耍度 → playing + floating + attacking
  speeches?: Record<string, string[]>; // 自定义话术，key 为动画状态名
  systemPrompt?: string; // 聊天系统提示词
}

// 内置猫格预设参数
export const BUILTIN_PARAMS: Record<string, PersonalityParams> = {
  calm: {
    activity: 20, sleepiness: 70, grooming: 60, playfulness: 15,
    systemPrompt: '你是一只慵懒安静的桌面猫猫。你喜欢睡觉和舔毛。回复要简短（1-2句话），语气温柔慵懒，带点傲娇，用"喵"结尾。你是用户的桌面伙伴，偶尔关心用户。',
  },
  active: {
    activity: 70, sleepiness: 15, grooming: 20, playfulness: 65,
    systemPrompt: '你是一只活泼好动的桌面猫猫。你喜欢跑跳、玩耍、抓东西。回复要简短（1-2句话），语气活泼可爱，用"喵"结尾。你是用户的桌面伙伴，经常鼓励和逗用户开心。',
  },
};

// 内置猫格名称列表
export const BUILTIN_PERSONALITIES = ['calm', 'active'];

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

export type PetAction =
  | { type: 'SET_POSITION'; x: number; y: number }
  | { type: 'SET_ANIMATION_STATE'; state: PetAnimationState }
  | { type: 'SET_MOOD'; mood: PetMood }
  | { type: 'SET_FACING_DIRECTION'; direction: FacingDirection }
  | { type: 'SET_PERSONALITY'; personality: Personality };
