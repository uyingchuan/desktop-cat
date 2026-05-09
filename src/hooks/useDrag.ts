import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useDrag() {
  const handleMouseDown = useCallback(() => {
    getCurrentWindow().startDragging().catch((err) => {
      console.error('Failed to start window dragging:', err);
    });
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return { handleMouseDown, handleDragStart };
}
