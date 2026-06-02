export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  created_at: number;   // Unix 时间戳（秒）
  remind_at: number | null;  // 提醒时间 Unix 时间戳（秒），null 表示未设置
}
