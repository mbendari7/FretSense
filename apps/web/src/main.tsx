import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import './ui/styles.css';
import { FretSenseApp } from './application/app';
import { memoryRepository, openIdbRepository } from './infrastructure/idb';
import { cryptoIds, requestPersistentStorage, subtleHasher, systemClock } from './infrastructure/platform';
import { AppContext } from './ui/hooks';
import { App } from './ui/App';

/** Composition root: the only module that imports every layer (research R11). */
async function start() {
  let repo;
  try {
    repo = await openIdbRepository();
  } catch {
    repo = memoryRepository();
  }
  const app = new FretSenseApp(repo, systemClock, cryptoIds, subtleHasher);
  try {
    await app.bootstrap();
  } catch {
    const fallback = new FretSenseApp(memoryRepository(), systemClock, cryptoIds, subtleHasher);
    await fallback.bootstrap();
    return render(fallback);
  }
  void requestPersistentStorage();
  render(app);
}

function render(app: FretSenseApp) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppContext.Provider value={app}>
        <App />
      </AppContext.Provider>
    </StrictMode>,
  );
}

void start();
