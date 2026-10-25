import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkDataProvider } from './context/WorkDataContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { AuthView } from './components/AuthView';
import { FieldWorkerDashboard } from './components/FieldWorkerDashboard';
import { ManagerDashboard } from './components/ManagerDashboard';
import { Loader2 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center font-sans transition-colors duration-200">
        <div className="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center text-white mb-4 shadow-md">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-stone-700 font-bold text-base">Loading Civil Site Work Logger...</p>
        <p className="text-stone-500 text-xs mt-1">Connecting to team cloud sync</p>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans flex flex-col transition-colors duration-200">
      <Header />

      <main className="flex-1 pb-16">
        {userProfile.role === 'Manager' ? (
          <ManagerDashboard />
        ) : (
          <FieldWorkerDashboard />
        )}
      </main>

      {/* Persistent Bottom Navigation Indicator / Info */}
      <footer className="bg-stone-200/90 border-t border-stone-300/80 py-3 px-4 text-center text-xs text-stone-600 transition-colors duration-200" style={{ paddingBottom: 'calc(0.75rem + var(--sab))' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px]">
          <span>
            Logged in as <strong>{userProfile.name}</strong> ({userProfile.role === 'Field Worker' ? 'Field Executive' : userProfile.role})
          </span>
          <span className="text-stone-500">Civil Engineering Site Ops PWA • Responsive on All Devices</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WorkDataProvider>
          <MainApp />
        </WorkDataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
