import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppState } from './lib/appState';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { OpportunityDetail } from './pages/OpportunityDetail';
import { SavedPage } from './pages/SavedPage';
import { SourcesPage } from './pages/SourcesPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { SettingsPage } from './pages/SettingsPage';
import { Onboarding } from './pages/Onboarding';

export default function App(): React.ReactElement {
  const { profile, loading } = useAppState();
  const location = useLocation();

  // First-run: route everything to onboarding until completed.
  if (!loading && !profile.onboardingComplete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (location.pathname === '/onboarding') {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/opportunity/:id" element={<OpportunityDetail />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/updates" element={<UpdatesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
