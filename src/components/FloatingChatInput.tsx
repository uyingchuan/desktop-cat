import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePetStore } from '../stores/usePetStore';
import { useChatStore } from '../stores/useChatStore';
import { useCompanionStore } from '../stores/useCompanionStore';
import { chatCompletion } from '../services/llm';
import { extractMemories, formatMemoriesForPrompt } from '../services/memory';
import type { PersonalityParams } from '../types/pet';
import type { ChatMessage } from '../stores/useChatStore';
import type { MemoryItemV2 } from '../types/companion';
import './FloatingChatInput.css';

interface Config {
  active_personality: string;
  personalities: PersonalityParams[];
  deepseek_api_key?: string;
}

interface ChatData {
  memories: Record<string, string[]>;
  conversations: Record<string, ChatMessage[]>;
}

function FloatingChatInput() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [personality, setPersonality] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { setSpeech, setChatting } = usePetStore();
  const { conversations, addMessage, loadConversations } = useChatStore();
  const { getPersonalityMemoriesV2, loadCompanionData } = useCompanionStore();

  useEffect(() => {
    inputRef.current?.focus();
    Promise.all([
      invoke<Config>('get_config'),
      invoke<ChatData>('get_chat_data'),
    ])
      .then(([config, chatData]) => {
        setApiKey(config.deepseek_api_key || null);
        setPersonality(config.active_personality);
        loadConversations(chatData.conversations || {});
        // 加载陪伴数据（含记忆 V2）
        invoke<import('../types/companion').CompanionData>('get_companion_data')
          .then((cd) => loadCompanionData(cd))
          .catch(() => {});

        let params: PersonalityParams | undefined;
        const found = config.personalities.find(p => p.name === config.active_personality);
        if (found) { params = found; }
        setSystemPrompt(params?.systemPrompt || '你是一只可爱的桌面猫猫，回复要简短可爱（1-2句话），用"喵"结尾。');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const doSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (!apiKey) {
      setSpeech('请先在设置中配置 DeepSeek API Key 喵~');
      return;
    }

    setInput('');
    setLoading(true);
    addMessage(personality, { role: 'user', content: text });

    // 记录互动（关系系统）
    useCompanionStore.getState().recordInteraction(personality);

    const myMemories = getPersonalityMemoriesV2(personality);
    const history = conversations[personality] || [];
    const messages = [
      { role: 'system' as const, content: systemPrompt + formatMemoriesForPrompt(myMemories) },
      ...history,
      { role: 'user' as const, content: text },
    ];

    try {
      const reply = await chatCompletion(messages, apiKey);
      addMessage(personality, { role: 'assistant', content: reply });
      setSpeech(reply);

      extractMemories(text, reply, myMemories, personality, apiKey).then((newMemories) => {
        if (JSON.stringify(newMemories) !== JSON.stringify(myMemories)) {
          // 替换该人格的所有记忆：先删后加
          const store = useCompanionStore.getState();
          const oldIds = new Set(myMemories.map((m: MemoryItemV2) => m.id));
          oldIds.forEach((id: string) => store.removeMemoryV2(id));
          newMemories.forEach((m: MemoryItemV2) => store.addMemoryV2({
            personality: m.personality,
            content: m.content,
            memory_type: m.memory_type,
            importance: m.importance,
          }));
        }
      });
    } catch {
      setSpeech('呜...网络出问题了喵，等会儿再试吧~');
    } finally {
      setLoading(false);
    }
  }, [input, loading, apiKey, personality, systemPrompt, conversations, addMessage, getPersonalityMemoriesV2, setSpeech]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSend();
      } else if (e.key === 'Escape') {
        setChatting(false);
        setSpeech(null);
      }
    },
    [doSend, setChatting, setSpeech],
  );

  return (
    <div className="floating-chat" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="floating-chat-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={loading ? '猫猫思考中...' : '说点什么...'}
      />
    </div>
  );
}

export default FloatingChatInput;
