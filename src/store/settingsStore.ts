import { create } from 'zustand';
import type { Viewport } from '@xyflow/react';

interface SettingsState {
  viewports: Record<string, Viewport>;
  isReadOnly: boolean;
  saveViewport: (mapId: string, viewport: Viewport) => void;
  getViewport: (mapId: string) => Viewport | undefined;
  toggleReadOnly: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  viewports: {},
  isReadOnly: false,
  saveViewport: (mapId, viewport) => {
    set(state => ({
      viewports: { ...state.viewports, [mapId]: viewport }
    }));
  },
  getViewport: (mapId) => get().viewports[mapId],
  toggleReadOnly: () => set(state => ({ isReadOnly: !state.isReadOnly }))
}));
