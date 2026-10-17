import { create } from 'zustand';
import { readPreferences, preferencesKey } from '../lib/preferences';
import type { Preferences } from '../lib/preferences';

interface PreferencesState {
  preferences: Preferences;
  storageError: boolean;
  save: (preferences: Preferences) => void;
}

export const usePreferences = create<PreferencesState>()((set) => ({
  ...readPreferences(),
  save(preferences) {
    let storageError = false;
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(preferences));
    } catch {
      storageError = true;
    }
    set({ preferences, storageError });
  },
}));
