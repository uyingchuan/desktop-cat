import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePetStore } from '../stores/usePetStore';
import { useChatStore } from '../stores/useChatStore';
import { chatCompletion } from '../services/llm';
import type { PersonalityParams } from '../types/pet';
import { BUILTIN_PARAMS } from '../types/pet';
import './FloatingChatInput.css';

function FloatingChatInput() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [personality, setPersonality] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { setSpeech, setChatting } = usePetStore();
  const { conversations, addMessage } = useChatStore();

  useEffect(() => {
    inputRef.current?.focus();
    invoke<{
      active_personality: string;
      deepseek_api_key?: string;
      custom_personalities: Record<string, PersonalityParams>;
    }>('get_config')
      .then((config) => {
        setApiKey(config.deepseek_api_key || null);
        setPersonality(config.active_personality);

        let params: PersonalityParams | undefined;
        if (config.active_personality in BUILTIN_PARAMS) {
          params = BUILTIN_PARAMS[config.active_personality];
        } else if (config.custom_personalities[config.active_personality]) {
          params = config.custom_personalities[config.active_personality];
        }
        setSystemPrompt(params?.systemPrompt || '你是一只可爱的桌面猫猫，回复要简短可爱（1-2句话），用"喵"结尾。');
      })
      .catch(() => {});
  }, []);

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

    const history = conversations[personality] || [];
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: text },
    ];

    try {
      const reply = await chatCompletion(messages, apiKey);
      addMessage(personality, { role: 'assistant', content: reply });
      setSpeech(reply);
    } catch {
      setSpeech('呜...网络出问题了喵，等会儿再试吧~');
    } finally {
      setLoading(false);
    }
  }, [input, loading, apiKey, personality, systemPrompt, conversations, addMessage, setSpeech]);

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
    <div className="floating-chat">
      <input
        ref={inputRef}
        className="floating-chat-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={loading ? '猫猫思考中...' : '说点什么...'}
        disabled={loading}
      />
    </div>
  );
}

export default FloatingChatInput;
