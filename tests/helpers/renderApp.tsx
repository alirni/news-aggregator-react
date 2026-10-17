import { render } from '@testing-library/react';
import App from '../../src/App';
import { readPreferences } from '../../src/lib/preferences';
import { usePreferences } from '../../src/stores/preferences';

// Each render represents a fresh page load, including reading saved preferences.
export function renderApp() {
  usePreferences.setState(readPreferences());
  return render(<App />);
}
