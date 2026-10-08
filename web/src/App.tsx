import * as React from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { api } from './lib/api';
import { ConfirmProvider } from './components/ui';
import { RecordDialogProvider } from './components/resource/RecordDialog';
import { QuickAddProvider } from './components/layout/QuickAdd';
import { SearchProvider } from './components/layout/Search';
import { FocusProvider } from './components/layout/Focus';
import { Shell } from './components/layout/Shell';
import { AuthScreen } from './pages/Auth';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 } } });

const P = (load: () => Promise<any>, name: string) => {
  const C = React.lazy(() => load().then((m) => ({ default: m[name] })));
  return (
    <React.Suspense fallback={<div className="p-10 text-center text-sm text-muted">Chargement…</div>}>
      <C />
    </React.Suspense>
  );
};

function Gate() {
  const { data, refetch, isLoading } = useQuery({ queryKey: ['auth'], queryFn: () => api<{ configured: boolean; authenticated: boolean }>('/auth/status'), staleTime: Infinity });
  React.useEffect(() => {
    const onLogout = () => refetch();
    window.addEventListener('jadou:logout', onLogout);
    return () => window.removeEventListener('jadou:logout', onLogout);
  }, [refetch]);
  if (isLoading || !data) return <div className="grid h-full place-items-center font-display text-2xl text-wine">Jadou Planner ♡</div>;
  if (!data.authenticated) return <AuthScreen configured={data.configured} onDone={() => (qc.clear(), refetch())} />;
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <RecordDialogProvider>
          <FocusProvider>
            <SearchProvider>
              <QuickAddProvider>
                <Routes>
                  <Route element={<Shell />}>
                    <Route index element={P(() => import('./pages/Dashboard'), 'Dashboard')} />
                    <Route path="calendar" element={P(() => import('./pages/Calendar'), 'CalendarPage')} />
                    <Route path="tasks" element={P(() => import('./pages/Tasks'), 'TasksPage')} />
                    <Route path="command" element={P(() => import('./pages/Command'), 'CommandCenter')} />
                    <Route path="fitness" element={P(() => import('./pages/Fitness'), 'FitnessPage')} />
                    <Route path="nutrition" element={P(() => import('./pages/Nutrition'), 'NutritionPage')} />
                    <Route path="water" element={P(() => import('./pages/Water'), 'WaterPage')} />
                    <Route path="body" element={P(() => import('./pages/Body'), 'BodyPage')} />
                    <Route path="wellness" element={P(() => import('./pages/Wellness'), 'WellnessPage')} />
                    <Route path="beauty" element={P(() => import('./pages/Beauty'), 'BeautyPage')} />
                    <Route path="studies" element={P(() => import('./pages/Studies'), 'StudiesPage')} />
                    <Route path="toeic" element={P(() => import('./pages/Toeic'), 'ToeicPage')} />
                    <Route path="thesis" element={P(() => import('./pages/Thesis'), 'ThesisPage')} />
                    <Route path="pharmacy" element={P(() => import('./pages/Pharmacy'), 'PharmacyPage')} />
                    <Route path="lash" element={P(() => import('./pages/Lash'), 'LashPage')} />
                    <Route path="instagram" element={P(() => import('./pages/Instagram'), 'InstagramPage')} />
                    <Route path="entrepreneurship" element={P(() => import('./pages/Business'), 'EntrepreneurshipPage')} />
                    <Route path="ideas" element={P(() => import('./pages/Business'), 'IdeasPage')} />
                    <Route path="banks" element={P(() => import('./pages/Banks'), 'BanksPage')} />
                    <Route path="budget" element={P(() => import('./pages/Budget'), 'BudgetPage')} />
                    <Route path="savings" element={P(() => import('./pages/Savings'), 'SavingsPage')} />
                    <Route path="investments" element={P(() => import('./pages/Investments'), 'InvestmentsPage')} />
                    <Route path="real-estate" element={P(() => import('./pages/RealEstate'), 'RealEstatePage')} />
                    <Route path="airbnb" element={P(() => import('./pages/Airbnb'), 'AirbnbPage')} />
                    <Route path="wishlist" element={P(() => import('./pages/Wishlist'), 'WishlistPage')} />
                    <Route path="travel" element={P(() => import('./pages/Travel'), 'TravelPage')} />
                    <Route path="habits" element={P(() => import('./pages/Habits'), 'HabitsPage')} />
                    <Route path="vision" element={P(() => import('./pages/Vision'), 'VisionPage')} />
                    <Route path="journal" element={P(() => import('./pages/Journal'), 'JournalPage')} />
                    <Route path="resources" element={P(() => import('./pages/Resources'), 'ResourcesPage')} />
                    <Route path="goals" element={P(() => import('./pages/Goals'), 'GoalsPage')} />
                    <Route path="review" element={P(() => import('./pages/Review'), 'ReviewPage')} />
                    <Route path="analytics" element={P(() => import('./pages/Analytics'), 'AnalyticsPage')} />
                    <Route path="ai" element={P(() => import('./pages/Ai'), 'AiPage')} />
                    <Route path="settings/:tab" element={P(() => import('./pages/Settings'), 'SettingsPage')} />
                    <Route path="settings" element={<Navigate to="/settings/profile" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </QuickAddProvider>
            </SearchProvider>
          </FocusProvider>
        </RecordDialogProvider>
      </ConfirmProvider>
    </BrowserRouter>
  );
}

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <Gate />
      <Toaster position="top-center" toastOptions={{ className: '!rounded-2xl !border-line !bg-surface !text-ink !shadow-lift !font-sans' }} />
    </QueryClientProvider>
  );
}
