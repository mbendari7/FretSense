import { createContext, useContext, useSyncExternalStore } from 'react';
import type { FretSenseApp } from '../application/app';

export const AppContext = createContext<FretSenseApp | null>(null);

export function useApp(): FretSenseApp {
  const app = useContext(AppContext);
  if (!app) throw new Error('AppContext missing');
  return app;
}

export function useAppState() {
  const app = useApp();
  return useSyncExternalStore(app.subscribe, app.getState);
}
