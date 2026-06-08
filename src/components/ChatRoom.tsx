import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useChatStore } from '../stores/useChatStore';
import { useMemoryStore } from '../stores/useMemoryStore';
import { chatCompletion } from '../services/llm';
import { extractMemories, formatMemoriesForPrompt } from '../services/memory';
import type { PersonalityParams } from '../types/pet';
import type { ChatMessage } from '../stores/useChatStore';
import { BUILTIN_PARAMS } from '../types/pet';
import './ChatRoom.css';

interface Config {
  active_personality: string;
  custom_personalities: Record<string, PersonalityParams>;
  deepseek_api_key?: string;
}

interface ChatData {
  memories: Record<string, string[]>;
  conversations: Record<string, ChatMessage[]>;
}

function ChatRoom({ personality }: { personality: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { conversations, addMessage, clearConversation, loadConversations } = useChatStore();
  const { memories, loadMemories, updateMemories } = useMemoryStore();

  const loadConfig = useCallback(() => {
    Promise.all([
      invoke<Config>('get_config'),
      invoke<ChatData>('get_chat_data'),
    ])
      .then(([c, chatData]) => {
        setConfig(c);
        loadMemories(chatData.memories || {});
        loadConversations(chatData.conversations || {});
      })
      .catch(() => {});
  }, [loadMemories, loadConversations]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // 托盘闪烁时点击 → 重新加载对话
  useEffect(() => {
    const unlisten = listen('chat-reload', () => { loadConfig(); });
    return () => { unlisten.then((fn) => fn()); };
  }, [loadConfig]);

  // 提醒触发时 → 实时注入新消息，无需等磁盘 IO
  useEffect(() => {
    const unlisten = listen<{ personality: string; content: string }>('chat-new-message', (event) => {
      const { personality, content } = event.payload;
      useChatStore.getState().addMessage(personality, { role: 'assistant', content });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, personality]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

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
    addMessage(personality, { role: 'user', content: text });

    const myMemories = memories[personality] || [];
    const history = conversations[personality] || [];
    const messages = [
      { role: 'system' as const, content: getSystemPrompt(personality) + formatMemoriesForPrompt(myMemories) },
      ...history,
      { role: 'user' as const, content: text },
    ];

    try {
      const reply = await chatCompletion(messages, config.deepseek_api_key);
      addMessage(personality, { role: 'assistant', content: reply });

      extractMemories(text, reply, myMemories, config.deepseek_api_key).then((newMemories) => {
        if (JSON.stringify(newMemories) !== JSON.stringify(myMemories)) {
          updateMemories(personality, newMemories);
        }
      });
    } catch {
      addMessage(personality, { role: 'assistant', content: '呜...网络出问题了喵，等会儿再试吧~' });
    } finally {
      setLoading(false);
    }
  }, [input, loading, config, personality, memories, conversations, addMessage, updateMemories]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    },
    [doSend],
  );

  const currentMessages = conversations[personality] || [];

  return (
    <div className="chat-room">
      <div className="chat-header">
        <span className="chat-header-title">
          {personality === 'calm' ? '🐱 慵懒' : personality === 'active' ? '🐱 活泼' : `🐱 ${personality}`}
        </span>
        <button
          className="clear-btn"
          onClick={() => clearConversation(personality)}
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
            <div className="chat-bubble">
              {msg.content}
              {msg.timestamp > 0 && (
                <div className="chat-time">
                  {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
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
          disabled={!config?.deepseek_api_key}
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
