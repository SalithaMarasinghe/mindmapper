import { create } from 'zustand';
import type { Viewport } from '@xyflow/react';

interface SettingsState {
  viewports: Record<string, Viewport>;
  saveViewport: (mapId: string, viewport: Viewport) => void;
  getViewport: (mapId: string) => Viewport | undefined;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  viewports: {},
  saveViewport: (mapId, viewport) => {
    set(state => ({
      viewports: { ...state.viewports, [mapId]: viewport }
    }));
  },
  getViewport: (mapId) => get().viewports[mapId]
}));
