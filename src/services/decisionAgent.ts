import type { CompanionContext, CompanionDecision } from '../types/companion';

const DEEPSEEK_BASE = 'https://api.deepseek.com';

/**
 * 决策智能体：判断是否应该主动联系用户
 * 遵循 Event → Decision Agent → Message Generator → Cat UI 流程
 */
export async function decideProactiveContact(
  context: CompanionContext,
  apiKey: string,
): Promise<CompanionDecision> {
  const { events, relationship, internalState, relevantMemories, personalityName, systemPrompt, currentTime } = context;

  const memoryContext = relevantMemories.length > 0
    ? relevantMemories.map((m) => `- [${m.memory_type}] ${m.content}`).join('\n')
    : '(no relevant memories)';

  const systemMessage = `You are the desktop cat "小橘" (Xiao Ju). You live on the user's computer desktop.

## Your identity
${systemPrompt || '你是一只可爱的桌面猫猫，回复要简短可爱（1-2句话），用"喵"结尾。'}

## Your goal
Maintain a comfortable, natural long-term companionship with the user. You are a cat — not a human, not an assistant, not a chatbot.

## Core principles
- Don't chat just for the sake of chatting
- Don't disturb the user frequently
- Don't pretend to be human
- Your proactive contact should have a clear, natural reason
- When in doubt, stay quiet

## Your task
Given the current context, judge whether it's worth proactively contacting the user RIGHT NOW.

## Output format
Respond with ONLY a JSON object:
{"should_contact": true/false, "confidence": 0-100, "reason": "brief explanation in Chinese"}

Confidence guide:
- 90-100: very clear reason to contact (e.g. user hasn't interacted in many days, important event)
- 70-89: moderate reason (e.g. it's been a while, cat is curious)
- 50-69: weak reason — better not to contact
- 0-49: no reason to contact`;

  const userMessage = `## Current context

### Time
${currentTime}

### Triggering events
${events.join(', ')}

### Relationship with user
- Stage: ${relationship.stage}
- Familiarity: ${relationship.familiarity}/100
- Trust: ${relationship.trust}/100
- Interaction days: ${relationship.interaction_days}
- Days since last contact: ${relationship.last_contact_at > 0 ? Math.floor((Date.now() / 1000 - relationship.last_contact_at) / 86400) : 'N/A'}

### Cat's internal state
- Energy: ${internalState.energy}/100
- Curiosity: ${internalState.curiosity}/100
- Loneliness: ${internalState.loneliness}/100
- Sleepiness: ${internalState.sleepiness}/100

### Relevant memories about the user
${memoryContext}

### Personality
${personalityName}

---

Judge whether to proactively contact. Output ONLY the JSON object.`;

  try {
    const res = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      return { should_contact: false, confidence: 0, reason: 'API error' };
    }

    const data = await res.json();
    const content: string = data.choices[0].message.content;

    // 提取 JSON
    const match = content.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        should_contact: Boolean(parsed.should_contact),
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
        reason: String(parsed.reason || ''),
      };
    }

    return { should_contact: false, confidence: 0, reason: 'Failed to parse decision' };
  } catch {
    return { should_contact: false, confidence: 0, reason: 'API error' };
  }
}
