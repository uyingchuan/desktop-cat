const DEEPSEEK_BASE = 'https://api.deepseek.com';

export async function extractMemories(
  userMessage: string,
  assistantReply: string,
  existingMemories: string[],
  apiKey: string,
): Promise<string[]> {
  const existingJson = JSON.stringify(existingMemories);

  const systemPrompt = `You are a precise memory extraction system. Your only job: maintain a list of facts about the user.

Given the EXISTING memories (JSON array) and the latest conversation exchange, output a COMPLETE updated JSON array of facts. Rules:
- Add new facts discovered in this exchange
- Merge/update facts that contradict older ones
- Remove facts that the user explicitly denies
- Keep each fact short (under 30 words)
- Maximum 50 facts total
- Output ONLY the JSON array, nothing else. No markdown, no explanation.

Example output: ["User's name is Bob","User likes coffee","User works as a designer"]`;

  try {
    const res = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Existing memories:\n${existingJson}\n\nLatest exchange:\nUser: ${userMessage}\nAssistant: ${assistantReply}\n\nOutput the complete updated memory array:` },
        ],
      }),
    });

    if (!res.ok) return existingMemories;

    const data = await res.json();
    const content: string = data.choices[0].message.content;

    const match = content.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 50);
      }
    }

    return existingMemories;
  } catch {
    return existingMemories;
  }
}

export function formatMemoriesForPrompt(memories: string[]): string {
  if (!memories || memories.length === 0) return '';
  const lines = memories.map((m) => `- ${m}`).join('\n');
  return `\n\n=== Things you remember about the user ===\n${lines}`;
}
