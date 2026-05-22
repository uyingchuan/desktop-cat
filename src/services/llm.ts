export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const DEEPSEEK_BASE = 'https://api.deepseek.com';

export async function chatCompletion(
  messages: ChatMessage[],
  apiKey: string,
): Promise<string> {
  const res = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new Error(err);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
