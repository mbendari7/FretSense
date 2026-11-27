import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import './ui/styles.css';
import { FretSenseApp } from './application/app';
import { isDbOpenError, memoryRepository, openIdbRepository } from './infrastructure/idb';
import { cryptoIds, requestPersistentStorage, subtleHasher, systemClock } from './infrastructure/platform';
import { AppContext } from './ui/hooks';
import { App } from './ui/App';

/** Composition root: the only module that imports every layer (research R11). */
async function start() {
  let repo;
  try {
    repo = await openIdbRepository('fretsense', { onBlocked: showNotice, onBlocking: (m) => showNotice(m, true) });
    // The upgrade went through: a "close other tabs" notice from a blocked open is stale now.
    document.getElementById('db-notice')?.remove();
  } catch (e) {
    // 016 R2: newer data than this code means reload; never fall back silently to memory.
    if (isDbOpenError(e) && e.kind === 'version') return showNotice(e.message, true);
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

/** A plain banner outside React: the app may not be running (upgrade blocked, or a newer version open). */
function showNotice(message: string, reload = false) {
  const id = 'db-notice';
  document.getElementById(id)?.remove();
  const box = document.createElement('div');
  box.id = id;
  box.className = 'db-notice';
  box.setAttribute('role', 'alert');
  const p = document.createElement('p');
  p.textContent = message;
  box.append(p);
  if (reload) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'primary';
    b.textContent = 'Reload';
    b.addEventListener('click', () => location.reload());
    box.append(b);
  }
  document.body.prepend(box);
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
