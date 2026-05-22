import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useChatStore } from '../stores/useChatStore';
import { chatCompletion } from '../services/llm';
import type { PersonalityParams } from '../types/pet';
import { BUILTIN_PARAMS, BUILTIN_PERSONALITIES } from '../types/pet';
import './ChatRoom.css';

interface Config {
  active_personality: string;
  custom_personalities: Record<string, PersonalityParams>;
  deepseek_api_key?: string;
}

function ChatRoom() {
  const [config, setConfig] = useState<Config | null>(null);
  const [activePersonality, setActivePersonality] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { conversations, addMessage, clearConversation } = useChatStore();

  const loadConfig = useCallback(() => {
    invoke<Config>('get_config')
      .then((c) => {
        setConfig(c);
        setActivePersonality(c.active_personality);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(() => {
    const unlisten = listen<string>('personality-changed', (event) => {
      setActivePersonality(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activePersonality]);

  const allPersonalities = config
    ? [...BUILTIN_PERSONALITIES, ...Object.keys(config.custom_personalities)]
    : [];

  const getSystemPrompt = (name: string): string => {
    if (name in BUILTIN_PARAMS) {
      return BUILTIN_PARAMS[name].systemPrompt || '你是一只可爱的桌面猫猫，回复要简短可爱（1-2句话），用"喵"结尾。';
    }
    const custom = config?.custom_personalities[name];
    return custom?.systemPrompt || '你是一只可爱的桌面猫猫，回复要简短可爱（1-2句话），用"喵"结尾。';
  };

  const doSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !config) return;

    if (!config.deepseek_api_key) {
      return;
    }

    setInput('');
    setLoading(true);
    addMessage(activePersonality, { role: 'user', content: text });

    const history = conversations[activePersonality] || [];
    const messages = [
      { role: 'system' as const, content: getSystemPrompt(activePersonality) },
      ...history,
      { role: 'user' as const, content: text },
    ];

    try {
      const reply = await chatCompletion(messages, config.deepseek_api_key);
      addMessage(activePersonality, { role: 'assistant', content: reply });
    } catch {
      addMessage(activePersonality, { role: 'assistant', content: '呜...网络出问题了喵，等会再试吧~' });
    } finally {
      setLoading(false);
    }
  }, [input, loading, config, activePersonality, conversations, addMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    },
    [doSend],
  );

  const currentMessages = conversations[activePersonality] || [];

  return (
    <div className="chat-room">
      <div className="chat-header">
        <select
          className="personality-select"
          value={activePersonality}
          onChange={(e) => setActivePersonality(e.target.value)}
        >
          {allPersonalities.map((name) => (
            <option key={name} value={name}>
              {name === 'calm' ? '慵懒 (内置)' : name === 'active' ? '活泼 (内置)' : name}
            </option>
          ))}
        </select>
        <button
          className="clear-btn"
          onClick={() => clearConversation(activePersonality)}
        >
          清空对话
        </button>
      </div>

      <div className="chat-messages">
        {!config?.deepseek_api_key && (
          <div className="chat-notice">
            请先在个性管理中配置 DeepSeek API Key
          </div>
        )}
        {currentMessages.length === 0 && config?.deepseek_api_key && (
          <div className="chat-notice">
            和猫猫打个招呼吧~
          </div>
        )}
        {currentMessages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            <div className="chat-bubble">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <div className="chat-bubble loading">猫猫思考中...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-bar">
        <input
          ref={inputRef}
          className="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? '猫猫思考中...' : '输入消息...'}
          disabled={loading || !config?.deepseek_api_key}
        />
        <button
          className="send-btn"
          onClick={doSend}
          disabled={loading || !input.trim() || !config?.deepseek_api_key}
        >
          发送
        </button>
      </div>
    </div>
  );
}

export default ChatRoom;
