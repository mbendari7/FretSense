import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAppState } from './hooks';

const NAV = [
  { to: '/', label: 'Home', icon: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z', end: true },
  { to: '/explore', label: 'Explore', icon: 'M3 7h18M3 12h18M3 17h18M8 4v16M16 4v16' },
  { to: '/library', label: 'Lessons', icon: 'M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z M9 4v16' },
  { to: '/drills', label: 'Drills', icon: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8' },
  { to: '/keys', label: 'Keys', icon: 'M12 3l2.5 6H21l-5 4 2 7-6-4-6 4 2-7-5-4h6.5z' },
  { to: '/progress', label: 'Progress', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
];

export function Layout() {
  const s = useAppState();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  // Move focus to the new page on navigation so keyboard and screen-reader users aren't left on <body>.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const h1 = mainRef.current?.querySelector('h1') as HTMLElement | null;
    if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); } else mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);
  const size = s.settings?.display.textSize ?? 2;
  const theme = s.settings?.display.theme ?? 'system';
  return (
    <div className="shell" data-text-size={size} data-theme={theme === 'system' ? undefined : theme}>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="FretSense home">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect width="32" height="32" rx="8" className="brand-wood" /><path d="M4 10h24M4 16h24M4 22h24" className="brand-str" /><path d="M12 6v20M21 6v20" className="brand-fret" /><circle cx="16.5" cy="16" r="4" className="brand-dot" /></svg>
          <span>FretSense</span>
        </NavLink>
        <nav className="topnav" aria-label="Secondary">
          <NavLink to="/gear/instruments">My Gear</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <nav className="rail" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={n.icon} /></svg>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main id="main" tabIndex={-1} ref={mainRef}>
        {!s.durable && s.status === 'ready' && (
          <p className="notice" role="status">This browser isn’t letting FretSense save data, so progress won’t be kept after you close the page.</p>
        )}
        {s.error && <p className="notice error" role="alert">{s.error}</p>}
        <Outlet />
      </main>
    </div>
  );
}
