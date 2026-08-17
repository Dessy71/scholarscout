import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateProvider } from '../src/lib/appState';
import App from '../src/App';
import { OpportunityCard } from '../src/components/OpportunityCard';
import type { Opportunity } from '../src/core/types';
import { DEFAULT_PROFILE } from '../src/core/profileDefaults';

const NOW = new Date('2026-08-17T10:00:00Z');

const sampleOpp: Opportunity = {
  id: 'opp_ui1', title: 'Fully Funded MSc in Cloud Computing', organization: 'Example University',
  university: 'Example University', country: 'United Kingdom', city: null, region: 'uk',
  fields: ['cloud', 'devops'], level: 'masters', type: 'masters_scholarship',
  fundingType: 'fully_funded_stipend', fundingDetails: 'tuition, flights and stipend',
  eligibilityText: 'Open to Ghanaian applicants', academicRequirement: 'A 2:2 honours degree is accepted',
  academicFit: 'clearly_eligible', nationalityRequirement: 'Open to Ghanaian applicants',
  ghanaEligibility: 'ghana_eligible', deadline: { date: '2026-12-01', rawText: 'Deadline: 1 December 2026', timezone: null },
  startDate: null, duration: '12 months', summary: 'A fully funded master\u2019s programme in cloud computing.',
  applicationUrl: 'https://uni.example/apply', sourceUrl: 'https://uni.example/scholarship',
  canonicalUrl: 'https://uni.example/scholarship', sourceId: 'uni', sourceName: 'Example University',
  discoveredAt: NOW.toISOString(), updatedAt: NOW.toISOString(), lastVerifiedAt: NOW.toISOString(),
  contentHash: 'h', verificationStatus: 'verified', environmental: false,
  match: {
    score: 92, tier: 'excellent',
    breakdown: [{ key: 'nationality', label: 'Nationality eligibility', weight: 20, earned: 20, reason: 'Ghanaian applicants explicitly eligible' }],
    reasons: ['Ghanaian applicants explicitly eligible', 'Fully funded with stipend'],
    concerns: ['2 years professional experience required'],
  },
};

function mockDataFetch(profileComplete: boolean) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('opportunities.json')) {
      return new Response(JSON.stringify({ generatedAt: NOW.toISOString(), opportunities: [sampleOpp], changes: [] }));
    }
    if (url.includes('sources.json')) return new Response(JSON.stringify({ sources: [] }));
    if (url.includes('runs.json')) return new Response(JSON.stringify({ runs: [] }));
    if (url.includes('profile.json')) {
      return new Response(JSON.stringify(profileComplete ? { ...JSON.parse(JSON.stringify(DEFAULT_PROFILE)), onboardingComplete: true } : null));
    }
    return new Response('{}', { status: 404 });
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('OpportunityCard', () => {
  it('renders all required card information', () => {
    const onStatus = vi.fn();
    render(
      <MemoryRouter>
        <OpportunityCard opportunity={sampleOpp} status="none" onStatus={onStatus} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Fully Funded MSc in Cloud Computing').length).toBeGreaterThan(0);
    expect(screen.getByText(/Example University · United Kingdom/)).toBeInTheDocument();
    expect(screen.getByText('FULLY FUNDED + STIPEND')).toBeInTheDocument();
    expect(screen.getByText(/Ghana Eligible/)).toBeInTheDocument();
    expect(screen.getByText(/Clearly Eligible/)).toBeInTheDocument();
    expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    expect(screen.getByLabelText('Match score 92 out of 100')).toBeInTheDocument();
    expect(screen.getByText(/2 years professional experience required/)).toBeInTheDocument();
    expect(screen.getByText('Read More')).toBeInTheDocument();
    expect(screen.getByText('Apply ↗')).toHaveAttribute('href', 'https://uni.example/apply');
  });

  it('save / applied / hide actions call onStatus', () => {
    const onStatus = vi.fn();
    render(
      <MemoryRouter>
        <OpportunityCard opportunity={sampleOpp} status="none" onStatus={onStatus} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('☆ Save'));
    expect(onStatus).toHaveBeenCalledWith('saved');
    fireEvent.click(screen.getByText('Mark Applied'));
    expect(onStatus).toHaveBeenCalledWith('applied');
    fireEvent.click(screen.getByText('Hide'));
    expect(onStatus).toHaveBeenCalledWith('hidden');
  });
});

describe('Onboarding flow', () => {
  it('shows onboarding on first run and completes to dashboard', async () => {
    mockDataFetch(false);
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppStateProvider><App /></AppStateProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('start-onboarding')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('start-onboarding'));

    // step through all 12 questions using pre-selected defaults
    for (let i = 0; i < 12; i++) {
      await waitFor(() => expect(screen.getByTestId('next-question')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('next-question'));
    }
    await waitFor(() => expect(screen.getByTestId('finish-onboarding')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('finish-onboarding'));

    await waitFor(() => expect(screen.getByText('Your best opportunities today')).toBeInTheDocument());
    // persisted
    const stored = JSON.parse(localStorage.getItem('scholarscout.profile')!);
    expect(stored.onboardingComplete).toBe(true);
  });
});

describe('Dashboard', () => {
  it('renders the feed for a completed profile', async () => {
    localStorage.setItem('scholarscout.profile', JSON.stringify({ ...DEFAULT_PROFILE, onboardingComplete: true }));
    mockDataFetch(true);
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppStateProvider><App /></AppStateProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('feed')).toBeInTheDocument());
    expect(screen.getAllByText('Fully Funded MSc in Cloud Computing').length).toBeGreaterThan(0);
    expect(screen.getByTestId('update-now')).toBeInTheDocument();
    expect(screen.getByTestId('filters-panel')).toBeInTheDocument();
  });
});

describe('dark mode', () => {
  it('theme toggle switches the dark class and persists', async () => {
    localStorage.setItem('scholarscout.profile', JSON.stringify({ ...DEFAULT_PROFILE, onboardingComplete: true }));
    mockDataFetch(true);
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppStateProvider><App /></AppStateProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText(/Switch to dark mode/)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/Switch to dark mode/));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('scholarscout.theme')).toBe('dark');
    fireEvent.click(screen.getByLabelText(/Switch to light mode/));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
