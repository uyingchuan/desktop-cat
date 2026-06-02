import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTodoStore } from '../stores/useTodoStore';
import type { TodoItem } from '../types/todo';
import './TodoPanel.css';

function TodoPanel() {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { items, loadItems, addItem, toggleItem, deleteItem } = useTodoStore();

  useEffect(() => {
    invoke<{ items: TodoItem[] }>('get_todo_data')
      .then((data) => loadItems(data.items || []))
      .catch(() => {});
  }, [loadItems]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAdd = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    addItem(text);
    setInput('');
  }, [input, addItem]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd],
  );

  const pendingItems = items.filter((item) => !item.completed);
  const completedItems = items.filter((item) => item.completed);

  return (
    <div className="todo-panel">
      <div className="todo-header">
        <h2>备忘录</h2>
        <span className="todo-count">{pendingItems.length} 项待办</span>
      </div>

      <div className="todo-input-bar">
        <input
          ref={inputRef}
          className="todo-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="添加新的待办事项..."
        />
        <button
          className="todo-add-btn"
          onClick={handleAdd}
          disabled={!input.trim()}
        >
          添加
        </button>
      </div>

      <div className="todo-list">
        {items.length === 0 && (
          <div className="todo-empty">还没有待办事项~ 添加一条吧</div>
        )}

        {pendingItems.map((item) => (
          <TodoItemRow
            key={item.id}
            item={item}
            onToggle={toggleItem}
            onDelete={deleteItem}
          />
        ))}

        {completedItems.length > 0 && (
          <>
            <div className="todo-section-label">已完成</div>
            {completedItems.map((item) => (
              <TodoItemRow
                key={item.id}
                item={item}
                onToggle={toggleItem}
                onDelete={deleteItem}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

interface TodoItemRowProps {
  item: TodoItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function TodoItemRow({ item, onToggle, onDelete }: TodoItemRowProps) {
  const date = new Date(item.created_at * 1000);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <div className={`todo-row ${item.completed ? 'todo-completed' : ''}`}>
      <label className="todo-checkbox-label">
        <input
          type="checkbox"
          checked={item.completed}
          onChange={() => onToggle(item.id)}
        />
        <span className="todo-checkbox-custom" />
      </label>
      <div className="todo-content">
        <span className="todo-text">{item.text}</span>
        <span className="todo-time">{timeStr}</span>
      </div>
      <button
        className="todo-delete-btn"
        onClick={() => onDelete(item.id)}
        title="删除"
      >
        ×
      </button>
    </div>
  );
}

export default TodoPanel;
