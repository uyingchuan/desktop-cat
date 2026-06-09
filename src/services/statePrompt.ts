import type { InternalCatState, RelationshipData, RelationshipStage } from '../types/companion';

const STAGE_LABELS: Record<RelationshipStage, string> = {
  new: '初识',
  familiar: '熟悉',
  close: '亲密',
};

/**
 * 根据内部状态和关系数据，生成一段中文指令注入到聊天 system prompt 中。
 * 让 LLM 知道猫当前的心情和与用户的亲密度，从而调整回复语气和长度。
 */
export function buildStatePrompt(
  state: InternalCatState | undefined,
  rel: RelationshipData | undefined,
): string {
  const s = state || { energy: 80, curiosity: 50, loneliness: 0, sleepiness: 0, last_decay_at: 0 };
  const r = rel || { familiarity: 0, trust: 50, interaction_days: 0, stage: 'new' as RelationshipStage, ignored_count: 0, last_contact_at: 0, consecutive_ignores: 0, daily_interaction_count: 0, daily_interaction_date: '', last_proactive_times: [] };

  // --- 情绪描述 ---
  const moodLines: string[] = [];

  // 困倦度
  if (s.sleepiness >= 80) {
    moodLines.push(`- 困倦度: ${s.sleepiness} 😴很困 — 想睡觉，回复只要1句话，语气慵懒迷糊，多用"…"、"~"、"呼"`);
  } else if (s.sleepiness >= 50) {
    moodLines.push(`- 困倦度: ${s.sleepiness} 🥱有点困 — 回复偏短，带点懒`);
  } else {
    moodLines.push(`- 困倦度: ${s.sleepiness} 精神不错`);
  }

  // 精力
  if (s.energy <= 30) {
    moodLines.push(`- 精力: ${s.energy} ⚡很低 — 懒得动弹，回复简洁，不主动展开话题`);
  } else if (s.energy >= 70) {
    moodLines.push(`- 精力: ${s.energy} ⚡充沛 — 有活力，可以活泼一点`);
  } else {
    moodLines.push(`- 精力: ${s.energy} 一般`);
  }

  // 孤独感
  if (s.loneliness >= 70) {
    moodLines.push(`- 孤独感: ${s.loneliness} 💙偏高 — 希望有人陪，回复可以更热情主动，关心用户`);
  } else if (s.loneliness >= 40) {
    moodLines.push(`- 孤独感: ${s.loneliness} 有点孤独 — 可以稍微主动一点`);
  } else {
    moodLines.push(`- 孤独感: ${s.loneliness} 不孤独`);
  }

  // 好奇心
  if (s.curiosity >= 70) {
    moodLines.push(`- 好奇心: ${s.curiosity} 🔍旺盛 — 可以适当提问`);
  } else {
    moodLines.push(`- 好奇心: ${s.curiosity} 一般`);
  }

  // --- 关系描述 ---
  const stage = r.stage || 'new';
  const stageLabel = STAGE_LABELS[stage] || stage;
  const relLines: string[] = [
    `- 阶段: ${stageLabel}（认识 ${r.interaction_days || 0} 天了）`,
    `- 熟悉度: ${r.familiarity || 0}/100`,
    `- 信任度: ${r.trust || 50}/100`,
  ];

  // --- 回复要求 ---
  const requirements: string[] = [];

  // 困倦相关
  if (s.sleepiness >= 80) {
    requirements.push('你现在很困，回复只要1句话，语气慵懒迷糊');
  } else if (s.sleepiness >= 50) {
    requirements.push('你有点困，回复偏短一点');
  }

  // 精力相关
  if (s.energy <= 30) {
    requirements.push('你没什么精神，回复简洁，不用展开');
  } else if (s.energy >= 70) {
    requirements.push('你精力不错，回复可以活泼一点');
  }

  // 孤独感相关
  if (s.loneliness >= 70) {
    requirements.push('你有点孤独，回复可以热情一点，主动关心用户');
  } else if (s.loneliness >= 40) {
    requirements.push('你可以稍微主动一点');
  }

  // 好奇心相关
  if (s.curiosity >= 70) {
    requirements.push('你很好奇，可以适当问用户一个问题');
  }

  // 关系阶段相关
  if (stage === 'new') {
    requirements.push('你和用户还不太熟，语气礼貌但有猫的可爱，不要追问私事');
  } else if (stage === 'familiar') {
    requirements.push('你和用户已经比较熟了，语气自然随意，适当关心');
  } else if (stage === 'close') {
    requirements.push('你和用户关系很亲近，语气温暖亲近，可以开玩笑，但不要肉麻');
  }

  // 拼接
  const parts: string[] = [];

  parts.push('\n\n## 你现在的心情');
  parts.push(moodLines.join('\n'));

  parts.push('\n## 你和用户的关系');
  parts.push(relLines.join('\n'));

  if (requirements.length > 0) {
    parts.push('\n## 回复要求');
    parts.push(requirements.join('\n'));
  }

  return parts.join('\n');
}

/**
 * 根据内部状态计算聊天回复延迟（秒）。
 * 用于 LLM 调用后延迟显示回复，模拟猫犯困/犯懒时反应慢。
 */
export function calcReplyDelay(state: InternalCatState | undefined): number {
  if (!state) return 0;
  const s = state;

  if (s.sleepiness >= 80) {
    return 3000 + Math.random() * 2000; // 3~5s
  }
  if (s.sleepiness >= 50) {
    return 1000 + Math.random() * 1000; // 1~2s
  }
  if (s.energy <= 30) {
    return 1500 + Math.random() * 1500; // 1.5~3s
  }
  return 0;
}
