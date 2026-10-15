import { useState } from 'react';
import { emptyPreferences, parsePreferences, preferencesKey } from '../lib/preferences';
import type { Preferences } from '../lib/preferences';

function readPreferences() {
  try {
    return { preferences: parsePreferences(localStorage.getItem(preferencesKey)), storageError: false };
  } catch {
    return { preferences: emptyPreferences, storageError: true };
  }
}

export function usePreferences() {
  const [state, setState] = useState(readPreferences);

  function save(preferences: Preferences) {
    let storageError = false;
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(preferences));
    } catch {
      storageError = true;
    }
    setState({ preferences, storageError });
  }

  return { ...state, save };
}
