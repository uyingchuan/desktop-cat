import type { MemoryItemV2 } from '../types/companion';

const DEEPSEEK_BASE = 'https://api.deepseek.com';

/**
 * 从对话中提取结构化记忆 V2
 * 完全替换旧版 extractMemories
 */
export async function extractMemories(
  userMessage: string,
  assistantReply: string,
  existingMemories: MemoryItemV2[],
  personality: string,
  apiKey: string,
): Promise<MemoryItemV2[]> {
  const existingList = existingMemories.map((m) => ({
    id: m.id,
    content: m.content,
    type: m.memory_type,
    importance: m.importance,
    trigger_at: m.trigger_at,
  }));

  const nowUnix = Math.floor(Date.now() / 1000);
  const nowStr = new Date(nowUnix * 1000).toLocaleString('zh-CN', { hour12: false });

  const systemPrompt = `You are a precise memory extraction system for a desktop cat companion app. Your job: maintain a structured list of facts about the user that the cat should remember.

Given the EXISTING memories (JSON array) and the latest conversation exchange, output a COMPLETE updated JSON array. Each memory object:
- id: keep existing ID if the fact is unchanged
- content: short fact, under 30 Chinese characters (or under 30 words for English)
- type: one of "fact" | "event" | "preference" | "relationship"
- importance: 1-10 (10 = very important to remember)

=== TYPE CLASSIFICATION GUIDE ===

## "fact" — 中性事实
The user states something about themselves that is objectively true, with NO time urgency and NO like/dislike sentiment.
Examples:
  用户说"我是程序员" → {"type":"fact","content":"用户是程序员","importance":7}
  用户说"我养了一只狗" → {"type":"fact","content":"用户养了一只狗","importance":6}
  用户说"我在北京工作" → {"type":"fact","content":"用户在北京工作","importance":7}
  用户说"今天天气不错" → Do NOT store (trivial, not about the user)

## "event" — 时间相关事件
The user mentions something that is tied to a specific time: upcoming plans, things that happened, deadlines.
If the user explicitly asks to be REMINDED at a specific future time, include trigger_at as a Unix timestamp (seconds).

CURRENT TIME for your calculations: ${nowStr}, Unix timestamp = ${nowUnix}

HOW TO COMPUTE trigger_at from the CURRENT TIME:
- "X分钟后" → trigger_at = ${nowUnix} + (X * 60). Example: "两分钟后提醒我" → trigger_at = ${nowUnix} + 120 = ${nowUnix + 120}
- "X小时后" → trigger_at = ${nowUnix} + (X * 3600). Example: "半小时后提醒我" → trigger_at = ${nowUnix} + 1800 = ${nowUnix + 1800}
- "明天早上8点" → compute the Unix timestamp for tomorrow 08:00 CST
- "下午3点" → compute the Unix timestamp for today/tomorrow 15:00 CST

Examples (based on CURRENT TIME ${nowStr}, unix=${nowUnix}):
  "明天有个面试" → {"type":"event","content":"用户明天有面试","importance":9}
  "明天早上8点提醒我开会" → {"type":"event","content":"用户明天早上8点要开会","importance":9,"trigger_at":${nowUnix + 36000}}
  "两分钟后提醒我喝水" → {"type":"event","content":"用户两分钟后要喝水","importance":7,"trigger_at":${nowUnix + 120}}
  "半小时后提醒我开会" → {"type":"event","content":"用户半小时后要开会","importance":8,"trigger_at":${nowUnix + 1800}}

IMPORTANT: only set trigger_at when user EXPLICITLY asks for a reminder ("提醒我"/"remember"/"remind me").
Do NOT set trigger_at for plain event mentions without a reminder request.

## "preference" — 用户喜好/习惯
The user expresses what they LIKE, DISLIKE, PREFER, or HABITUALLY do. Must have clear sentiment or habitual pattern.
Examples:
  用户说"我喜欢晚上工作" → {"type":"preference","content":"用户喜欢晚上工作","importance":7}
  用户说"不太喜欢长篇大论" → {"type":"preference","content":"用户不喜欢长篇回复","importance":8}
  用户说"我一般早上喝咖啡" → {"type":"preference","content":"用户习惯早上喝咖啡","importance":6}
  用户说"我觉得猫很可爱" → {"type":"preference","content":"用户喜欢猫","importance":5}

## "relationship" — 用户与猫的互动方式
The user directly or indirectly expresses how they want the cat to interact with them.
Examples:
  用户说"你不用老是回复我" → {"type":"relationship","content":"用户不希望太频繁的互动","importance":8}
  用户说"多说点话吧" → {"type":"relationship","content":"用户希望猫更主动说话","importance":7}
  用户说"安静陪着我就好" → {"type":"relationship","content":"用户喜欢安静陪伴","importance":8}
  用户说"别老问我问题" → {"type":"relationship","content":"用户不喜欢被连续提问","importance":8}

=== IMPORTANCE SCORING GUIDE ===
9-10: 关键信息，必须记住（重要事件如面试、用户明确表达的互动偏好）
7-8: 重要信息（职业、地点、强烈偏好）
5-6: 一般信息（日常习惯、一般喜好）
3-4: 次要信息（临时状态、一次性事件）
1-2: 不应存储（琐碎信息）

=== RULES ===
- Add new facts discovered in this exchange
- Merge/update facts that contradict older ones (keep the SAME id, update content)
- Remove facts that the user explicitly denies
- Do NOT store trivial small talk (greetings, weather comments, "嗯", "好的")
- Maximum 50 facts total. If over limit, drop the least important ones.
- Output ONLY the JSON array, nothing else. No markdown, no explanation.`;

  console.log(systemPrompt, nowUnix);
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
          {
            role: 'user',
            content: `Current time: ${nowStr} (Unix: ${nowUnix})\n\nExisting memories:\n${JSON.stringify(existingList)}\n\nLatest exchange:\nUser: ${userMessage}\nAssistant: ${assistantReply}\n\nOutput the complete updated memory array:`,
          },
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
        console.log(parsed);
        return parsed.slice(0, 50).map((item: Record<string, unknown>) => ({
          id: (item.id as string) || crypto.randomUUID(),
          personality,
          content: item.content as string || '',
          memory_type: (item.type as MemoryItemV2['memory_type']) || 'fact',
          importance: Math.min(10, Math.max(1, (item.importance as number) || 5)),
          created_at: (item.created_at as number) || nowUnix,
          last_referenced_at: nowUnix,
          trigger_at: (item.trigger_at as number) || undefined,
        }));
      }
    }

    return existingMemories;
  } catch {
    return existingMemories;
  }
}

/**
 * 搜索相关记忆（按记忆类型过滤 + 重要性排序）
 */
export function searchMemories(
  memories: MemoryItemV2[],
  personality: string,
  options?: { type?: string; limit?: number; minImportance?: number },
): MemoryItemV2[] {
  let results = memories.filter((m) => m.personality === personality);

  if (options?.type) {
    results = results.filter((m) => m.memory_type === options.type);
  }
  if (options?.minImportance) {
    results = results.filter((m) => m.importance >= options.minImportance!);
  }

  // 按重要性降序，然后按最近引用时间降序
  results.sort((a, b) => {
    const impDiff = b.importance - a.importance;
    if (impDiff !== 0) return impDiff;
    return b.last_referenced_at - a.last_referenced_at;
  });

  if (options?.limit && options.limit > 0) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * 将记忆格式化为 LLM 上下文
 */
export function formatMemoriesForPrompt(memories: MemoryItemV2[]): string {
  if (!memories || memories.length === 0) return '';

  const typeEmoji: Record<string, string> = {
    fact: '📋',
    event: '📅',
    preference: '💜',
    relationship: '🤝',
  };

  const lines = memories.map((m) => {
    const emoji = typeEmoji[m.memory_type] || '📋';
    return `- ${emoji} [${m.memory_type}] ${m.content}`;
  }).join('\n');

  return `\n\n=== Things you remember about the user ===\n${lines}`;
}
