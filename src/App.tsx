import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { testSupabaseConnection } from './utils/testConnection';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

import { DashboardPage } from './pages/DashboardPage';
import { MindmapPage } from './pages/MindmapPage';
import { NodePage } from './pages/NodePage';
import { SharedMapPage } from './pages/SharedMapPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  useEffect(() => {
    testSupabaseConnection().then(result => {
      console.log('Supabase connection test result:', result);
    });
  }, []);

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/share/:token" element={<SharedMapPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/map/:mapId" element={<MindmapPage />} />
        <Route path="/map/:mapId/node/:nodeId" element={<NodePage />} />
      </Route>
      </Routes>
    </>
  );
}
