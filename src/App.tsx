import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { TenantsPage } from '@/pages/TenantsPage';
import { TenantDetailPage } from '@/pages/TenantDetailPage';
import { InfractionsPage } from '@/pages/InfractionsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { useTenantsStore } from '@/stores/tenantsStore';
import { useFinesStore } from '@/stores/finesStore';
import { useInfractionsStore } from '@/stores/infractionsStore';
import { useAuthStore } from '@/stores/authStore';
import { getSpreadsheetIdFromEnv, initializeSpreadsheet } from '@/services/googleSheets';
import { seedIfEmpty } from '@/utils/seedData';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

function App() {
  const loadTenants = useTenantsStore((s) => s.loadTenants);
  const loadFines = useFinesStore((s) => s.loadFines);
  const loadInfractions = useInfractionsStore((s) => s.loadInfractions);
  const initAuth = useAuthStore((s) => s.initAuth);
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    seedIfEmpty();
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (!isSignedIn || !accessToken) return;

    const spreadsheetId = getSpreadsheetIdFromEnv();
    if (spreadsheetId) {
      initializeSpreadsheet(accessToken, spreadsheetId)
        .then(() => Promise.all([loadTenants(), loadFines(), loadInfractions()]))
        .catch((err) => {
          console.error(err);
          toast.error(err.message || 'Sheets bağlantısı kurulamadı');
        });
    } else {
      loadTenants();
      loadFines();
      loadInfractions();
    }
  }, [isSignedIn, accessToken, loadTenants, loadFines, loadInfractions]);

  if (!isSignedIn) {
    return (
      <>
        <LoginPage />
        <Toaster />
      </>
    );
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="tenants/:id" element={<TenantDetailPage />} />
          <Route path="infractions" element={<InfractionsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
