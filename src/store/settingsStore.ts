import { create } from 'zustand';
import type { Viewport } from '@xyflow/react';
import type { LayoutPattern } from '../types';

interface SettingsState {
  viewports: Record<string, Viewport>;
  layoutPatterns: Record<string, LayoutPattern>;
  isReadOnly: boolean;
  saveViewport: (mapId: string, viewport: Viewport) => void;
  getViewport: (mapId: string) => Viewport | undefined;
  getLayoutPattern: (mapId: string) => LayoutPattern;
  setLayoutPattern: (mapId: string, pattern: LayoutPattern) => void;
  toggleReadOnly: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  viewports: {},
  layoutPatterns: {},
  isReadOnly: false,
  saveViewport: (mapId, viewport) => {
    set(state => ({
      viewports: { ...state.viewports, [mapId]: viewport }
    }));
  },
  getViewport: (mapId) => get().viewports[mapId],
  getLayoutPattern: (mapId) => {
    const memory = get().layoutPatterns[mapId];
    if (memory) return memory;
    try {
      const saved = localStorage.getItem(`mindmap_layout_${mapId}`) as LayoutPattern | null;
      if (saved && (saved === 'radial' || saved === 'balanced' || saved === 'right')) {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'radial';
  },
  setLayoutPattern: (mapId, pattern) => {
    try {
      localStorage.setItem(`mindmap_layout_${mapId}`, pattern);
    } catch {
      // storage unavailable
    }
    set(state => ({
      layoutPatterns: { ...state.layoutPatterns, [mapId]: pattern }
    }));
  },
  toggleReadOnly: () => set(state => ({ isReadOnly: !state.isReadOnly }))
}));
