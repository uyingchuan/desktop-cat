import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { usePetStore } from '../stores/usePetStore';
import { useChatStore, type ChatMessage } from '../stores/useChatStore';
import { useCompanionStore } from '../stores/useCompanionStore';
import { decideProactiveContact } from '../services/decisionAgent';
import { generateProactiveMessage } from '../services/proactiveMessage';
import type { CompanionData, CompanionEvent } from '../types/companion';

interface CompanionEventPayload {
  events: CompanionEvent[];
  active_personality: string;
}

interface Config {
  active_personality: string;
  personalities: { name: string; id: string; systemPrompt?: string }[];
  deepseek_api_key?: string;
}

/**
 * 陪伴引擎钩子 — 编排完整的主动消息周期
 *
 * Rust Scheduler (60min)
 *        ↓
 *   companion-event (app.emit)
 *        ↓
 *   反骚扰检查（本地，无 LLM）
 *        ↓
 *   决策智能体（LLM 调用 1）
 *        ↓
 *   消息生成器（LLM 调用 2）
 *        ↓
 *   Cat UI
 *
 * 在 Cat.tsx 中使用，与 useCatBehavior() 并列
 */
export function useCompanionEngine() {
  const apiKeyRef = useRef<string | undefined>(undefined);
  const processingRef = useRef(false);

  useEffect(() => {
    const unlisten = listen<CompanionEventPayload>('companion-event', async (event) => {
      // 防止并发处理
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const { events, active_personality } = event.payload;

        // 1. 加载最新数据
        const [companionData, config] = await Promise.all([
          invoke<CompanionData>('get_companion_data'),
          invoke<Config>('get_config'),
        ]);

        const store = useCompanionStore.getState();
        store.loadCompanionData(companionData);

        // 2. 检查是否启用
        if (!store.contact_policy.companion_enabled) return;

        // 3. 反骚扰检查（纯本地，不调用 LLM）
        const check = store.checkContactAllowed(active_personality);
        if (!check.allowed) {
          console.log('[Companion] Skipped:', check.reason);
          return;
        }

        // 4. 获取 API key
        const apiKey = config.deepseek_api_key;
        if (!apiKey) {
          console.log('[Companion] No API key configured');
          return;
        }
        apiKeyRef.current = apiKey;

        // 5. 构建决策上下文
        const rel = store.relationships[active_personality];
        const state = store.internal_states[active_personality];
        if (!rel || !state) {
          // 首次：状态尚不完整，跳过
          return;
        }

        const allMemories = store.getPersonalityMemoriesV2(active_personality);

        // 获取猫格参数
        const params = config.personalities.find((p) => p.name === active_personality);
        const systemPrompt = params?.systemPrompt || '你是一只可爱的桌面猫猫，回复要简短可爱（1-2句话），用"喵"结尾。';

        const now = new Date();
        const currentTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const decision = await decideProactiveContact(
          {
            events,
            relationship: rel,
            internalState: state,
            relevantMemories: allMemories.slice(0, 10),
            personalityName: active_personality,
            systemPrompt,
            currentTime,
          },
          apiKey,
        );

        console.log('[Companion] Decision:', decision);

        // 6. 执行门控：confidence >= 70
        if (!decision.should_contact || decision.confidence < 70) {
          console.log('[Companion] Decision negative — skipping');
          return;
        }

        // 7. 生成消息
        const message = await generateProactiveMessage(
          {
            reason: decision.reason,
            stage: rel.stage,
            relevantMemories: allMemories.slice(0, 5),
            personalityName: active_personality,
            systemPrompt,
            familiarity: rel.familiarity,
            loneliness: state.loneliness,
          },
          apiKey,
        );

        console.log('[Companion] Generated message:', message);

        // 8. 执行：更新状态、显示气泡、广播、托盘
        store.recordProactiveContact(active_personality);

        // 加入聊天历史
        const chatStore = useChatStore.getState();
        // 先从磁盘同步，避免覆盖
        try {
          const chatData = await invoke<{ conversations: Record<string, { role: string; content: string; timestamp: number }[]> }>('get_chat_data');
          chatStore.loadConversations(chatData.conversations as Record<string, ChatMessage[]> || {});
        } catch { /* ok */ }
        chatStore.addMessage(active_personality, { role: 'assistant', content: message });

        // 显示对话气泡
        usePetStore.getState().setSpeech(message);

        // 广播到所有窗口
        invoke('broadcast_chat_message', { personality: active_personality, content: message }).catch(() => {});

        // 托盘闪烁
        invoke('set_tray_alert', { message }).catch(() => {});

        // 降低孤独感（联系人已建立）
        store.updateInternalState(active_personality, {
          loneliness: Math.max(0, state.loneliness - 10),
        });
      } catch (err) {
        console.error('[Companion] Engine error:', err);
      } finally {
        processingRef.current = false;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
