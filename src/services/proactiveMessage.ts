import type { ProactiveMessageContext } from '../types/companion';

const DEEPSEEK_BASE = 'https://api.deepseek.com';

/**
 * 主动消息生成器
 * 根据决策原因、关系和记忆生成一句自然的主动消息
 */
export async function generateProactiveMessage(
  context: ProactiveMessageContext,
  apiKey: string,
): Promise<string> {
  const { reason, stage, relevantMemories, personalityName, systemPrompt, familiarity, loneliness } = context;

  const memoryContext = relevantMemories.length > 0
    ? relevantMemories.map((m) => m.content).join('；')
    : '';

  const stageGuide = {
    new: '你们还不太熟，语气礼貌但有猫的可爱，不要太亲密',
    familiar: '你们已经比较熟了，语气自然随意，可以适当关心',
    close: '你们关系很亲近，语气温暖亲近但不肉麻',
  };

  const systemMessage = `你是桌面猫「小橘」。你主动出现在用户的桌面上。

## 你的身份
${systemPrompt || '你是一只可爱的桌面猫猫，回复要简短可爱（1-2句话），用"喵"结尾。'}

## 当前关系阶段
${stageGuide[stage] || stageGuide.familiar}

## 你主动联系的原因
${reason}

## 消息要求
- 15～40字
- 自然，不做作
- 不要客服语气
- 不要连续提问（最多一个问题）
- 符合猫的说话风格
- 用"喵"结尾（可以灵活）
- 如果用户分享过相关的事，可以自然地提起

## 严格禁止
- 不要说"在吗"
- 不要说"为什么不理我"
- 不要说"我想你了"
- 不要伪装真人
- 不要过于热情

## 输出
只输出一句话，不要引号，不要前缀。`;

  const userMessage = [
    `猫格：${personalityName}`,
    `熟悉度：${familiarity}/100`,
    `孤独感：${loneliness}/100`,
    memoryContext ? `用户相关记忆：${memoryContext}` : '',
    '',
    '请生成一句主动消息：',
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.7,
        max_tokens: 100,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      return `喵~ ${reason}`;
    }

    const data = await res.json();
    const content: string = (data.choices[0].message.content || '').trim();

    // 去掉可能的引号
    const cleaned = content.replace(/^["'""“‘]|["'""”’]$/g, '').trim();

    return cleaned || `喵~ ${reason}`;
  } catch {
    return `喵~ ${reason}`;
  }
}
