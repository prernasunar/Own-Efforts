import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkData } from '../context/WorkDataContext';
import { useTheme } from '../context/ThemeContext';
import { HardHat, Users, LogOut, RefreshCw, Sun, Moon } from 'lucide-react';
import { UserRole } from '../types';

export const Header: React.FC = () => {
  const { userProfile, signOut, updateUserRole } = useAuth();
  const { refreshData } = useWorkData();
  const { theme, toggleTheme } = useTheme();
  const [syncing, setSyncing] = React.useState(false);

  const handleToggleRole = () => {
    if (!userProfile) return;
    const nextRole: UserRole = userProfile.role === 'Manager' ? 'Field Executive' : 'Manager';
    updateUserRole(nextRole);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await refreshData();
    } finally {
      setTimeout(() => setSyncing(false), 600);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-amber-600 dark:bg-stone-900 text-white shadow-sm border-b border-amber-700/40 dark:border-stone-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Zone 1: Brand & Active User */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/90 dark:bg-amber-600 border border-amber-300/40 flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 text-amber-100" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base lg:text-lg font-extrabold tracking-tight text-white leading-tight truncate">
              Civil Site Logger
            </h1>
            <div className="flex items-center space-x-1.5 text-[11px] sm:text-xs text-amber-100 truncate">
              <span className="truncate max-w-[100px] sm:max-w-[200px] font-medium">
                {userProfile?.name || 'Field Team'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold shrink-0">
                {userProfile?.role === 'Manager' ? 'Manager' : 'Field Executive'}
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2: Touch-Friendly Responsive Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Sync Button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            title="Sync Cloud Data"
            aria-label="Sync Cloud Data"
            className="min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:px-3 py-1.5 rounded-xl bg-amber-700/75 dark:bg-stone-800 hover:bg-amber-700 dark:hover:bg-stone-700 text-white border border-amber-400/35 dark:border-stone-700 flex items-center justify-center space-x-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-amber-200' : ''}`} />
            <span className="hidden md:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Light / Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="min-h-[38px] min-w-[38px] sm:min-h-[40px] px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-700/75 dark:bg-stone-800 hover:bg-amber-700 dark:hover:bg-stone-700 text-white border border-amber-400/35 dark:border-stone-700 flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-300" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-amber-100" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* Quick Role Switcher */}
          <button
            type="button"
            onClick={handleToggleRole}
            title={`Switch to ${userProfile?.role === 'Manager' ? 'Field Executive' : 'Manager'} View`}
            className="min-h-[38px] sm:min-h-[40px] flex items-center justify-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-700/75 dark:bg-stone-800 hover:bg-amber-700 dark:hover:bg-stone-700 text-white border border-amber-400/35 dark:border-stone-700 transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            {userProfile?.role === 'Manager' ? (
              <>
                <HardHat className="w-4 h-4 text-amber-200" />
                <span className="hidden sm:inline">Executive View</span>
              </>
            ) : (
              <>
                <Users className="w-4 h-4 text-amber-200" />
                <span className="hidden sm:inline">Manager View</span>
              </>
            )}
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={() => signOut()}
            title="Sign Out"
            aria-label="Sign Out"
            className="min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] p-2 rounded-xl bg-amber-700/50 dark:bg-stone-800 hover:bg-amber-700 dark:hover:bg-stone-700 text-amber-100 hover:text-white border border-amber-400/30 dark:border-stone-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
