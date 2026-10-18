import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkData } from '../context/WorkDataContext';
import { HardHat, Users, LogOut, Database, RefreshCw, Flame, Cloud } from 'lucide-react';
import { UserRole } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { isFirebaseConfigured } from '../lib/firebase';
import { SupabaseConfigModal } from './SupabaseConfigModal';

export const Header: React.FC = () => {
  const { userProfile, signOut, updateUserRole } = useAuth();
  const { refreshData } = useWorkData();
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const isSupabase = isSupabaseConfigured();
  const isFirebase = isFirebaseConfigured();

  const handleToggleRole = () => {
    if (!userProfile) return;
    const nextRole: UserRole = userProfile.role === 'Field Worker' ? 'Manager' : 'Field Worker';
    updateUserRole(nextRole);
  };

  const dbStatusLabel = isFirebase
    ? 'Cloud Sync: Firebase Firestore (Active)'
    : isSupabase
    ? 'Cloud Sync: Supabase PostgreSQL'
    : 'Local & Cloud Sync Ready';

  return (
    <>
      <header className="sticky top-0 z-40 bg-amber-600 text-white shadow-md border-b border-amber-700/40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          {/* App Branding */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/90 border border-amber-300/40 flex items-center justify-center shadow-inner flex-shrink-0">
              <HardHat className="w-5 h-5 sm:w-6 sm:h-6 text-amber-100" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg lg:text-xl font-black tracking-tight text-white leading-tight truncate">
                Civil Site Logger
              </h1>
              <div className="flex items-center space-x-1.5 sm:space-x-2 text-[11px] sm:text-xs text-amber-100 font-medium">
                <span className="truncate max-w-[90px] xs:max-w-[130px] sm:max-w-[200px] font-semibold">
                  {userProfile?.name || 'Field Team'}
                </span>
                <span>•</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-700/70 text-[10px] sm:text-[11px] font-bold tracking-wide border border-amber-400/30 flex-shrink-0">
                  {userProfile?.role === 'Manager' ? '👔 Manager' : '👷 Worker'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
            {/* Database Settings Button */}
            <button
              onClick={() => setShowSupabaseModal(true)}
              title="Database / Cloud Storage Configuration"
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-xs active:scale-95 ${
                isFirebase || isSupabase
                  ? 'bg-emerald-700/90 hover:bg-emerald-700 text-emerald-100 border-emerald-400/40'
                  : 'bg-amber-700/70 hover:bg-amber-700 text-amber-100 border-amber-400/30'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {isFirebase ? 'Firestore Connected' : isSupabase ? 'Supabase Connected' : 'DB Setup'}
              </span>
            </button>

            {/* Quick Role Switcher */}
            <button
              onClick={handleToggleRole}
              title={`Switch to ${userProfile?.role === 'Field Worker' ? 'Manager' : 'Field Worker'} View`}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-700/75 hover:bg-amber-700 active:bg-amber-800 text-white border border-amber-400/35 transition-all shadow-xs active:scale-95"
            >
              {userProfile?.role === 'Field Worker' ? (
                <>
                  <Users className="w-3.5 h-3.5 text-amber-200" />
                  <span className="hidden sm:inline">Manager View</span>
                </>
              ) : (
                <>
                  <HardHat className="w-3.5 h-3.5 text-amber-200" />
                  <span className="hidden sm:inline">Worker View</span>
                </>
              )}
            </button>

            {/* Sign Out */}
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-1.5 sm:p-2 rounded-xl bg-amber-700/50 hover:bg-amber-700 active:bg-amber-800 text-amber-100 hover:text-white border border-amber-400/30 transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cloud Sync Status Indicator */}
        <div className="bg-amber-700/95 px-3 sm:px-6 lg:px-8 py-1 text-xs text-amber-100 border-t border-amber-500/40">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2">
            <button
              onClick={() => setShowSupabaseModal(true)}
              className="flex items-center space-x-1.5 hover:underline cursor-pointer text-left truncate min-w-0"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isFirebase || isSupabase ? 'bg-emerald-400' : 'bg-amber-300'
                } animate-pulse flex-shrink-0`}
              />
              <span className="font-semibold text-[11px] truncate">
                {dbStatusLabel}
              </span>
            </button>
            <button
              onClick={() => refreshData()}
              className="flex items-center space-x-1 text-[11px] font-bold opacity-90 hover:opacity-100 transition-opacity flex-shrink-0 bg-amber-800/40 hover:bg-amber-800/70 px-2 py-0.5 rounded border border-amber-400/25"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </header>

      <SupabaseConfigModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
        onConfigChanged={() => refreshData()}
      />
    </>
  );
};
