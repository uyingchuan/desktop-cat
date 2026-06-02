export type RepeatType = 'once' | 'daily' | 'interval';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  created_at: number;          // Unix 时间戳（秒）
  remind_at: number | null;    // 下次提醒 Unix 时间戳，null 表示未设置
  repeat_type: RepeatType;     // 重复模式
  repeat_interval: number | null; // 间隔秒数（仅 interval 模式）
}
