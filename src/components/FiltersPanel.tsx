import React from 'react';
import type { Opportunity } from '../core/types';
import type { FilterState } from '../lib/filters';
import { EMPTY_FILTERS, countActiveFilters } from '../lib/filters';
import { FUNDING_LABELS, TYPE_LABELS, LEVEL_LABELS, GHANA_ELIGIBILITY_LABELS, ACADEMIC_FIT_LABELS, DEADLINE_BUCKET_LABELS } from '../lib/format';
import { FIELD_DEFS } from '../core/classify/fields';

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  opportunities: Opportunity[];
}

function MultiSelect({ label, options, selected, onToggle }: {
  label: string;
  options: [string, string][];
  selected: string[];
  onToggle: (key: string) => void;
}): React.ReactElement {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([key, lbl]) => (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-pressed={selected.includes(key)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              selected.includes(key)
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-ink-200 text-ink-500 hover:border-brand-400 hover:text-brand-600 dark:border-ink-700 dark:text-ink-400'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function FiltersPanel({ filters, onChange, opportunities }: Props): React.ReactElement {
  const active = countActiveFilters(filters);

  const countries = [...new Set(opportunities.map((o) => o.country).filter((c): c is string => !!c))].sort();
  const orgs = [...new Set(opportunities.map((o) => o.organization))].sort();

  const toggle = (key: keyof FilterState, value: string) => {
    const list = filters[key] as string[];
    onChange({ ...filters, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };

  return (
    <div className="card space-y-5 p-4" data-testid="filters-panel">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Filters {active > 0 && <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">{active}</span>}</h2>
        {active > 0 && (
          <button className="text-[12px] font-semibold text-brand-600 hover:underline dark:text-brand-300" onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}>
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-400">Country</span>
          <select className="input" value={filters.country ?? ''} onChange={(e) => onChange({ ...filters, country: e.target.value || null })}>
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-400">Organization</span>
          <select className="input" value={filters.organization ?? ''} onChange={(e) => onChange({ ...filters, organization: e.target.value || null })}>
            <option value="">All organizations</option>
            {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>

      <MultiSelect
        label="Funding"
        options={Object.entries(FUNDING_LABELS) as [string, string][]}
        selected={filters.funding}
        onToggle={(k) => toggle('funding', k)}
      />
      <MultiSelect
        label="Opportunity type"
        options={Object.entries(TYPE_LABELS) as [string, string][]}
        selected={filters.type}
        onToggle={(k) => toggle('type', k)}
      />
      <MultiSelect
        label="Study level"
        options={Object.entries(LEVEL_LABELS) as [string, string][]}
        selected={filters.level}
        onToggle={(k) => toggle('level', k)}
      />
      <MultiSelect
        label="Ghana eligibility"
        options={Object.entries(GHANA_ELIGIBILITY_LABELS) as [string, string][]}
        selected={filters.ghana}
        onToggle={(k) => toggle('ghana', k)}
      />
      <MultiSelect
        label="Academic fit"
        options={Object.entries(ACADEMIC_FIT_LABELS) as [string, string][]}
        selected={filters.academic}
        onToggle={(k) => toggle('academic', k)}
      />
      <MultiSelect
        label="Deadline"
        options={(Object.entries(DEADLINE_BUCKET_LABELS) as [string, string][]).filter(([k]) => k !== 'expired')}
        selected={filters.deadline}
        onToggle={(k) => toggle('deadline', k)}
      />

      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-400">Field</span>
        <select className="input" value={filters.field ?? ''} onChange={(e) => onChange({ ...filters, field: e.target.value || null })}>
          <option value="">All fields</option>
          {FIELD_DEFS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-wider text-ink-400">
          <span>Minimum match score</span><span className="font-mono">{filters.minScore}</span>
        </span>
        <input
          type="range" min={0} max={100} step={5} value={filters.minScore}
          className="w-full accent-brand-600"
          onChange={(e) => onChange({ ...filters, minScore: Number(e.target.value) })}
          aria-label="Minimum match score"
        />
      </label>

      <div className="space-y-2">
        {([
          ['environmental', 'Environmental / clean-air relevance'],
          ['newOnly', 'New (last 48 hours)'],
          ['updatedOnly', 'Recently updated'],
          ['savedOnly', 'Saved only'],
          ['appliedOnly', 'Applied only'],
          ['showArchive', 'Show expired archive'],
          ['showHidden', 'Show hidden'],
        ] as [keyof FilterState, string][]).map(([key, lbl]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={filters[key] as boolean}
              onChange={(e) => onChange({ ...filters, [key]: e.target.checked })}
            />
            {lbl}
          </label>
        ))}
      </div>
    </div>
  );
}
