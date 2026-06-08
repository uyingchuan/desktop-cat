import { chatCompletion } from './llm';
import type { PersonalityParams } from '../types/pet';

/**
 * 使用 AI 根据当前猫格生成个性化提醒消息
 * @param reminderText - 原始提醒文本（如"该休息一下了"或待办事项内容）
 * @param personality - 当前猫格名称
 * @param params - 当前猫格参数（含 systemPrompt）
 * @param apiKey - DeepSeek API key
 * @returns 猫格化后的提醒消息，失败时返回固定模板
 */
export async function generateReminderMessage(
  reminderText: string,
  _personality: string,
  params: PersonalityParams,
  apiKey: string,
): Promise<string> {
  const systemPrompt =
    params.systemPrompt ||
    '你是一只可爱的桌面猫猫，回复要简短可爱（1-2句话），用"喵"结尾。';

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请用你的语气提醒我：${reminderText}` },
  ];

  try {
    return await chatCompletion(messages, apiKey);
  } catch {
    return `喵~ ${reminderText}`;
  }
}
