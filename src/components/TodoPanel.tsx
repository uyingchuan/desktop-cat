import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTodoStore } from '../stores/useTodoStore';
import type { TodoItem } from '../types/todo';
import type { RepeatType } from '../types/todo';
import './TodoPanel.css';

/** 将 Date 格式化为 datetime-local 输入所需的本地时间字符串 YYYY-MM-DDTHH:MM */
function toDatetimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function TodoPanel() {
  const [input, setInput] = useState('');
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { items, loadItems, addItem, toggleItem, deleteItem, setReminder, clearReminder } = useTodoStore();

  useEffect(() => {
    invoke<{ items: TodoItem[] }>('get_todo_data')
      .then((data) => loadItems(data.items || []))
      .catch(() => {});
  }, [loadItems]);

  // 监听后端提醒触发事件，重新加载数据
  useEffect(() => {
    const unlisten = listen('todo-reminder-fired', () => {
      invoke<{ items: TodoItem[] }>('get_todo_data')
        .then((data) => loadItems(data.items || []))
        .catch(() => {});
    });
    return () => { unlisten.then((fn) => fn()); };
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

  const handleSetReminder = useCallback((id: string, remindAt: number, repeatType: RepeatType, repeatInterval: number | null) => {
    setReminder(id, remindAt, repeatType, repeatInterval);
    setEditingReminderId(null);
  }, [setReminder]);

  const handleClearReminder = useCallback((id: string) => {
    clearReminder(id);
  }, [clearReminder]);

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
            editingReminder={editingReminderId === item.id}
            onToggle={toggleItem}
            onDelete={deleteItem}
            onSetReminder={handleSetReminder}
            onClearReminder={handleClearReminder}
            onStartEditReminder={() => setEditingReminderId(item.id)}
            onCancelEditReminder={() => setEditingReminderId(null)}
          />
        ))}

        {completedItems.length > 0 && (
          <>
            <div className="todo-section-label">已完成</div>
            {completedItems.map((item) => (
              <TodoItemRow
                key={item.id}
                item={item}
                editingReminder={editingReminderId === item.id}
                onToggle={toggleItem}
                onDelete={deleteItem}
                onSetReminder={handleSetReminder}
                onClearReminder={handleClearReminder}
                onStartEditReminder={() => setEditingReminderId(item.id)}
                onCancelEditReminder={() => setEditingReminderId(null)}
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
  editingReminder: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSetReminder: (id: string, remindAt: number, repeatType: RepeatType, repeatInterval: number | null) => void;
  onClearReminder: (id: string) => void;
  onStartEditReminder: () => void;
  onCancelEditReminder: () => void;
}

function TodoItemRow({
  item,
  editingReminder,
  onToggle,
  onDelete,
  onSetReminder,
  onClearReminder,
  onStartEditReminder,
  onCancelEditReminder,
}: TodoItemRowProps) {
  const date = new Date(item.created_at * 1000);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const hasReminder = item.remind_at != null;
  const reminderDate = hasReminder ? new Date(item.remind_at! * 1000) : null;
  const reminderTimeStr = reminderDate
    ? `${reminderDate.getMonth() + 1}/${reminderDate.getDate()} ${String(reminderDate.getHours()).padStart(2, '0')}:${String(reminderDate.getMinutes()).padStart(2, '0')}`
    : '';

  const repeatLabel = item.repeat_type === 'daily' ? ' 📅每天' : item.repeat_type === 'interval' ? ' 🔄间隔' : '';

  const handleReminderConfirm = () => {
    const repeatSelect = document.getElementById(`repeat-select-${item.id}`) as HTMLSelectElement;
    const repeatType: RepeatType = (repeatSelect?.value as RepeatType) || 'once';

    let remindAt = 0;
    let repeatInterval: number | null = null;

    if (repeatType === 'daily') {
      const timeInput = document.getElementById(`reminder-time-${item.id}`) as HTMLInputElement;
      if (!timeInput?.value) return;
      const [h, m] = timeInput.value.split(':').map(Number);
      const now = new Date();
      remindAt = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0).getTime() / 1000);
      if (remindAt <= Date.now() / 1000) remindAt += 86400;
    } else if (repeatType === 'interval') {
      const intervalInput = document.getElementById(`reminder-interval-${item.id}`) as HTMLInputElement;
      const unitSelect = document.getElementById(`interval-unit-${item.id}`) as HTMLSelectElement;
      if (!intervalInput?.value) return;
      const val = Number(intervalInput.value);
      const unit = unitSelect?.value || 'min';
      repeatInterval = unit === 'hour' ? val * 3600 : val * 60;
      remindAt = Math.floor(Date.now() / 1000) + repeatInterval;
    } else {
      const dtInput = document.getElementById(`reminder-dt-${item.id}`) as HTMLInputElement;
      if (!dtInput?.value) return;
      remindAt = Math.floor(new Date(dtInput.value).getTime() / 1000);
    }

    onSetReminder(item.id, remindAt, repeatType, repeatInterval);
  };

  return (
    <>
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
          <div className="todo-meta">
            <span className="todo-time">{timeStr}</span>
            {hasReminder && (
              <span
                className="todo-reminder-time"
                onClick={() => onClearReminder(item.id)}
                title="点击取消提醒"
              >
                🔔 {reminderTimeStr}{repeatLabel}
              </span>
            )}
          </div>
        </div>
        <button
          className={`todo-reminder-btn ${hasReminder ? 'todo-reminder-active' : ''}`}
          onClick={hasReminder ? () => onClearReminder(item.id) : onStartEditReminder}
          title={hasReminder ? '取消提醒' : '设置提醒'}
        >
          {hasReminder ? '🔔' : '🔕'}
        </button>
        <button
          className="todo-delete-btn"
          onClick={() => onDelete(item.id)}
          title="删除"
        >
          ×
        </button>
      </div>

      {editingReminder && <ReminderPopover item={item} onConfirm={handleReminderConfirm} onCancel={onCancelEditReminder} />}
    </>
  );
}

interface ReminderPopoverProps {
  item: TodoItem;
  onConfirm: () => void;
  onCancel: () => void;
}

function ReminderPopover({ item, onConfirm, onCancel }: ReminderPopoverProps) {
  const hasReminder = item.remind_at != null;
  const [repeatType, setRepeatType] = useState<RepeatType>(item.repeat_type || 'once');

  const getDefaultDatetime = () => {
    if (hasReminder && item.repeat_type === 'once') {
      return toDatetimeLocal(new Date(item.remind_at! * 1000));
    }
    return toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000));
  };

  const getDefaultTime = () => {
    if (hasReminder) {
      const d = new Date(item.remind_at! * 1000);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getDefaultInterval = () => {
    if (hasReminder && item.repeat_interval != null) {
      return item.repeat_interval >= 3600 && item.repeat_interval % 3600 === 0
        ? String(item.repeat_interval / 3600)
        : String(item.repeat_interval / 60);
    }
    return '30';
  };

  const getDefaultIntervalUnit = () => {
    if (hasReminder && item.repeat_interval != null) {
      return item.repeat_interval >= 3600 && item.repeat_interval % 3600 === 0 ? 'hour' : 'min';
    }
    return 'min';
  };

  return (
    <div className="todo-reminder-popover">
      <select
        id={`repeat-select-${item.id}`}
        className="todo-repeat-select"
        value={repeatType}
        onChange={(e) => setRepeatType(e.target.value as RepeatType)}
      >
        <option value="once">仅一次</option>
        <option value="daily">每天</option>
        <option value="interval">间隔</option>
      </select>

      {repeatType === 'once' && (
        <input
          id={`reminder-dt-${item.id}`}
          className="todo-datetime-input"
          type="datetime-local"
          defaultValue={getDefaultDatetime()}
        />
      )}
      {repeatType === 'daily' && (
        <input
          id={`reminder-time-${item.id}`}
          className="todo-datetime-input"
          type="time"
          defaultValue={getDefaultTime()}
        />
      )}
      {repeatType === 'interval' && (
        <div className="todo-interval-row">
          <input
            id={`reminder-interval-${item.id}`}
            className="todo-interval-input"
            type="number"
            min="1"
            defaultValue={getDefaultInterval()}
          />
          <select
            id={`interval-unit-${item.id}`}
            className="todo-interval-unit"
            defaultValue={getDefaultIntervalUnit()}
          >
            <option value="min">分钟</option>
            <option value="hour">小时</option>
          </select>
        </div>
      )}

      <div className="todo-reminder-popover-actions">
        <button className="todo-reminder-confirm-btn" onClick={onConfirm}>
          设置提醒
        </button>
        <button className="todo-reminder-cancel-btn" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}

export default TodoPanel;
