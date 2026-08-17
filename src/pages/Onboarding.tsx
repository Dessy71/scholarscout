import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../lib/appState';
import { QUESTIONS } from '../lib/onboardingQuestions';
import type { UserProfile } from '../core/types';

/**
 * First-run onboarding wizard — a scholarship matching assessment.
 * Defaults are pre-selected from the specification profile; every value is
 * editable here and later in Settings.
 */
export function Onboarding(): React.ReactElement {
  const { profile, saveProfile, rescore } = useAppState();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);            // 0 = intro, 1..N = questions, N+1 = academic confirm
  const [draft, setDraft] = useState<UserProfile>(profile);
  const total = QUESTIONS.length;

  const progress = useMemo(() => Math.round((Math.max(0, step - 1) / (total + 1)) * 100), [step, total]);

  const finish = () => {
    saveProfile({ ...draft, onboardingComplete: true });
    rescore();
    navigate('/');
  };

  if (step === 0) {
    return (
      <Shell progress={0}>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-700 text-3xl">🎓</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Your Scholarship Matching Assessment</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            ScholarScout will personalize its discovery engine around your goals. This takes about
            <strong> 3 minutes</strong> — {total} questions plus a quick confirmation of your academic profile.
            Sensible defaults are pre-selected for a Ghanaian Computer Science graduate; change anything you like.
          </p>
          <ul className="mx-auto mt-6 grid max-w-md gap-2 text-left text-[13px] text-ink-600 dark:text-ink-300">
            <li className="flex gap-2"><span>✓</span> Every answer can be changed later in Settings</li>
            <li className="flex gap-2"><span>✓</span> Your academic result is never converted into a foreign GPA</li>
            <li className="flex gap-2"><span>✓</span> Eligibility is only claimed when a source establishes it</li>
          </ul>
          <button className="btn-primary mt-8 !px-8 !py-3 text-base" onClick={() => setStep(1)} data-testid="start-onboarding">
            Begin Assessment →
          </button>
        </div>
      </Shell>
    );
  }

  if (step === total + 1) {
    return (
      <Shell progress={100}>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-600 dark:text-brand-300">Final step · Academic profile</p>
        <h2 className="mt-2 font-display text-2xl font-extrabold">Confirm your academic profile</h2>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          This is used to interpret each programme's stated requirement — the original wording is always shown alongside.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nationality" value={draft.nationality} onChange={(v) => setDraft({ ...draft, nationality: v })} />
          <Field label="Degree" value={draft.degree} onChange={(v) => setDraft({ ...draft, degree: v })} />
          <Field label="Institution" value={draft.institution} onChange={(v) => setDraft({ ...draft, institution: v })} />
          <Field label="CWA (%)" value={String(draft.cwa)} onChange={(v) => setDraft({ ...draft, cwa: Number(v) || draft.cwa })} type="number" />
          <div className="sm:col-span-2">
            <Field label="Classification" value={draft.classification} onChange={(v) => setDraft({ ...draft, classification: v })} />
          </div>
        </div>
        <div className="mt-8 flex justify-between">
          <button className="btn-secondary" onClick={() => setStep(total)}>← Back</button>
          <button className="btn-primary !px-8" onClick={finish} data-testid="finish-onboarding">Complete Assessment ✓</button>
        </div>
      </Shell>
    );
  }

  const q = QUESTIONS[step - 1];
  const current = q.getValue(draft);
  const selected = Array.isArray(current) ? current : [current];

  const toggleOption = (value: string) => {
    if (q.multi) {
      const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
      setDraft(q.setValue(draft, next));
    } else {
      setDraft(q.setValue(draft, [value]));
    }
  };

  return (
    <Shell progress={progress}>
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-600 dark:text-brand-300">{q.eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl font-extrabold">{q.title}</h2>
      {q.help && <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{q.help}</p>}
      <p className="mt-1 text-[12px] text-ink-400">{q.multi ? 'Select all that apply.' : 'Select one.'}</p>

      <div className={`mt-5 grid gap-2 ${q.options.length > 6 ? 'sm:grid-cols-2' : ''}`} role={q.multi ? 'group' : 'radiogroup'} aria-label={q.title}>
        {q.options.map((opt) => {
          const isSel = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              role={q.multi ? 'checkbox' : 'radio'}
              aria-checked={isSel}
              onClick={() => toggleOption(opt.value)}
              className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                isSel
                  ? 'border-brand-600 bg-brand-50 dark:border-brand-500 dark:bg-brand-950/50'
                  : 'border-ink-100 bg-white hover:border-brand-300 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brand-700'
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-${q.multi ? 'md' : 'full'} border-2 text-[11px] font-bold text-white ${
                  isSel ? 'border-brand-600 bg-brand-600' : 'border-ink-300 dark:border-ink-600'
                }`}
              >
                {isSel ? '✓' : ''}
              </span>
              <span>
                <span className="block text-[14px] font-semibold">{opt.label}</span>
                {opt.description && <span className="mt-0.5 block text-[12px] text-ink-400 dark:text-ink-500">{opt.description}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button className="btn-secondary" onClick={() => setStep(step - 1)}>← Back</button>
        <span className="text-[12px] font-semibold text-ink-400">{step} / {total}</span>
        <button
          className="btn-primary"
          onClick={() => setStep(step + 1)}
          disabled={q.multi && selected.length === 0}
          data-testid="next-question"
        >
          {step === total ? 'Almost done →' : 'Next →'}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children, progress }: { children: React.ReactNode; progress: number }): React.ReactElement {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="card p-8 animate-fade-up">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }): React.ReactElement {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-400">{label}</span>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
