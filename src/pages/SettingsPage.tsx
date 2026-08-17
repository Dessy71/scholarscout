import React, { useRef, useState } from 'react';
import { useAppState } from '../lib/appState';
import { QUESTIONS } from '../lib/onboardingQuestions';
import type { UserProfile } from '../core/types';

export function SettingsPage(): React.ReactElement {
  const { profile, saveProfile, rescore } = useAppState();
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    saveProfile(draft);
    rescore();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  const exportProfile = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scholarscout-profile.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importProfile = (file: File) => {
    void file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as UserProfile;
        setDraft(parsed);
      } catch {
        alert('Invalid profile file.');
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Settings & Profile</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportProfile}>Export profile</button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Import</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importProfile(e.target.files[0])} />
          <button className="btn-primary" onClick={save} data-testid="save-settings">
            {savedFlash ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      <p className="text-sm text-ink-500 dark:text-ink-400">
        Preferences live in your browser and are seeded from <code className="rounded bg-ink-100 px-1 text-[12px] dark:bg-ink-800">data/profile.json</code> in
        the repository. To sync across devices, export your profile and commit it as <code className="rounded bg-ink-100 px-1 text-[12px] dark:bg-ink-800">data/profile.json</code>.
      </p>

      {/* Academic profile */}
      <section className="card p-5">
        <h2 className="section-title mb-4">Academic Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nationality" value={draft.nationality} onChange={(v) => setDraft({ ...draft, nationality: v })} />
          <Field label="Degree" value={draft.degree} onChange={(v) => setDraft({ ...draft, degree: v })} />
          <Field label="Institution" value={draft.institution} onChange={(v) => setDraft({ ...draft, institution: v })} />
          <Field label="CWA (%)" value={String(draft.cwa)} type="number" onChange={(v) => setDraft({ ...draft, cwa: Number(v) || draft.cwa })} />
          <div className="sm:col-span-2">
            <Field label="Classification" value={draft.classification} onChange={(v) => setDraft({ ...draft, classification: v })} />
          </div>
        </div>
      </section>

      {/* All onboarding questions, editable */}
      {QUESTIONS.map((q) => {
        const current = q.getValue(draft);
        const selected = Array.isArray(current) ? current : [current];
        const toggle = (value: string) => {
          if (q.multi) {
            const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
            setDraft(q.setValue(draft, next));
          } else {
            setDraft(q.setValue(draft, [value]));
          }
        };
        return (
          <section key={q.id} className="card p-5">
            <h2 className="section-title mb-1">{q.title}</h2>
            {q.help && <p className="mb-3 text-[12px] text-ink-400">{q.help}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={selected.includes(opt.value)}
                  onClick={() => toggle(opt.value)}
                  title={opt.description}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    selected.includes(opt.value)
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-ink-200 text-ink-500 hover:border-brand-400 dark:border-ink-700 dark:text-ink-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <section className="card p-5">
        <h2 className="section-title mb-3">Career interest keywords</h2>
        <p className="mb-2 text-[12px] text-ink-400">Comma-separated keywords boosting career/interest fit in the match score.</p>
        <input
          className="input"
          value={draft.careerInterests.join(', ')}
          onChange={(e) => setDraft({ ...draft, careerInterests: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
        />
      </section>

      <div className="flex justify-end">
        <button className="btn-primary !px-8" onClick={save}>{savedFlash ? '✓ Saved' : 'Save changes'}</button>
      </div>
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
