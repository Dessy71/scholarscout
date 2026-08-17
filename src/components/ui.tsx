import React from 'react';

export function Chip({ className = '', children, title }: { className?: string; children: React.ReactNode; title?: string }): React.ReactElement {
  return <span title={title} className={`chip ${className}`}>{children}</span>;
}

export function ScoreRing({ score, size = 44 }: { score: number; size?: number }): React.ReactElement {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = score >= 85 ? '#23a27d' : score >= 70 ? '#10b981' : score >= 55 ? '#dd9a21' : '#8694ab';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Match score ${score} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="4" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" fontSize={size * 0.32} fontWeight="700" fill="currentColor">
        {score}
      </text>
    </svg>
  );
}

export function EmptyState({ icon, title, message, action }: {
  icon?: React.ReactNode; title: string; message: string; action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center animate-fade-in">
      <div className="text-4xl" aria-hidden>{icon ?? '🔍'}</div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="max-w-md text-sm text-ink-500 dark:text-ink-400">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }): React.ReactElement {
  return (
    <div className="card border-red-200 dark:border-red-900/60 flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
      <div className="text-3xl" aria-hidden>⚠️</div>
      <h3 className="font-display text-lg font-bold text-red-700 dark:text-red-400">{title}</h3>
      <p className="max-w-md text-sm text-ink-500 dark:text-ink-400">{message}</p>
      {onRetry && <button className="btn-secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function SkeletonCard(): React.ReactElement {
  return (
    <div className="card p-5" aria-hidden>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
          <div className="flex gap-2">
            <div className="skeleton h-5 w-24 rounded-full" />
            <div className="skeleton h-5 w-20 rounded-full" />
            <div className="skeleton h-5 w-28 rounded-full" />
          </div>
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-5/6" />
        </div>
        <div className="skeleton h-11 w-11 rounded-full" />
      </div>
    </div>
  );
}

export function StatCard({ label, value, tone = 'default', hint }: {
  label: string; value: React.ReactNode; tone?: 'default' | 'brand' | 'gold' | 'red'; hint?: string;
}): React.ReactElement {
  const tones = {
    default: 'text-ink-900 dark:text-ink-100',
    brand: 'text-brand-600 dark:text-brand-300',
    gold: 'text-gold-600 dark:text-gold-400',
    red: 'text-red-600 dark:text-red-400',
  };
  return (
    <div className="card px-4 py-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-400 dark:text-ink-500">{hint}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }): React.ReactElement {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}
