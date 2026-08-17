import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAppState } from '../lib/appState';
import { UpdateNowButton } from './UpdateNow';
import { nextScheduledUpdate, formatDateTime, relativeTime } from '../lib/format';

function Logo(): React.ReactElement {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="ScholarScout home">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#116853" />
        <path d="M16 7l9 4.5-9 4.5-9-4.5L16 7z" fill="#eccb5e" />
        <path d="M11 15v4.5c0 1.5 2.2 3 5 3s5-1.5 5-3V15l-5 2.5L11 15z" fill="#f6f7f9" />
      </svg>
      <span className="font-display text-lg font-extrabold tracking-tight">
        Scholar<span className="text-brand-600 dark:text-brand-300">Scout</span>
      </span>
    </Link>
  );
}

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/saved', label: 'Saved & Applied' },
  { to: '/sources', label: 'Sources' },
  { to: '/updates', label: 'Update History' },
  { to: '/settings', label: 'Settings' },
];

export function Layout({ children }: { children: React.ReactNode }): React.ReactElement {
  const { theme, setTheme, dataset, runs } = useAppState();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const lastRun = runs.find((r) => r.status !== 'running') ?? null;
  const next = nextScheduledUpdate();

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-brand-700 focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Logo />

          {/* Global search */}
          <form
            className="ml-2 hidden flex-1 md:block"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/?q=${encodeURIComponent(query)}`);
            }}
          >
            <input
              type="search"
              className="input max-w-md"
              placeholder="Search opportunities, universities, countries…"
              aria-label="Search opportunities"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <UpdateNowButton />
            <button
              className="btn-ghost !px-2.5"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              className="btn-ghost !px-2.5 lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Toggle navigation menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* nav + status strip */}
        <div className={`border-t border-ink-100 dark:border-ink-800 ${menuOpen ? 'block' : 'hidden'} lg:block`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 lg:flex-row lg:items-center">
            <nav className="flex flex-col gap-1 lg:flex-row lg:gap-1" aria-label="Primary">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                      isActive
                        ? 'bg-brand-700 text-white dark:bg-brand-600'
                        : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-400 dark:text-ink-500 lg:ml-auto">
              <span title={lastRun?.completedAt ?? undefined}>
                Last update: <strong className="text-ink-600 dark:text-ink-300">{lastRun ? relativeTime(lastRun.completedAt ?? lastRun.startedAt) : relativeTime(dataset.generatedAt === new Date(0).toISOString() ? null : dataset.generatedAt)}</strong>
              </span>
              <span>
                Next scheduled: <strong className="text-ink-600 dark:text-ink-300">{formatDateTime(next.toISOString())} GMT</strong>
              </span>
              {lastRun && (
                <span className={lastRun.status === 'failed' ? 'text-red-500' : 'text-brand-600 dark:text-brand-400'}>
                  {lastRun.status === 'failed' ? '● last run failed' : '● healthy'}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 py-6">{children}</main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 text-center text-[11px] text-ink-400 dark:text-ink-600">
        ScholarScout · personal opportunity intelligence · always verify details on the official source before applying
      </footer>
    </div>
  );
}
