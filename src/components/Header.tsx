import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkData } from '../context/WorkDataContext';
import { HardHat, Users, LogOut, Database, RefreshCw } from 'lucide-react';
import { UserRole } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { SupabaseConfigModal } from './SupabaseConfigModal';

export const Header: React.FC = () => {
  const { userProfile, signOut, updateUserRole, backendProvider } = useAuth();
  const { refreshData } = useWorkData();
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const isSupabase = isSupabaseConfigured();

  const handleToggleRole = () => {
    if (!userProfile) return;
    const nextRole: UserRole = userProfile.role === 'Field Worker' ? 'Manager' : 'Field Worker';
    updateUserRole(nextRole);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-amber-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* App Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/80 border border-amber-300/40 flex items-center justify-center shadow-inner">
              <HardHat className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">
                Civil Site Logger
              </h1>
              <div className="flex items-center space-x-2 text-xs text-amber-100 font-medium">
                <span>{userProfile?.name || 'Field Team'}</span>
                <span>•</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-700/60 text-[11px] font-semibold tracking-wide border border-amber-400/30">
                  {userProfile?.role === 'Manager' ? '👔 Manager' : '👷 Field Worker'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-2">
            {/* Supabase DB Settings Button */}
            <button
              onClick={() => setShowSupabaseModal(true)}
              title="Supabase Database Configuration"
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-xs ${
                isSupabase
                  ? 'bg-emerald-700/80 hover:bg-emerald-700 text-emerald-100 border-emerald-400/40'
                  : 'bg-amber-700/70 hover:bg-amber-700 text-amber-100 border-amber-400/30'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isSupabase ? 'Supabase Connected' : 'Supabase Setup'}
              </span>
            </button>

            {/* Quick Role Switcher */}
            <button
              onClick={handleToggleRole}
              title={`Switch to ${userProfile?.role === 'Field Worker' ? 'Manager' : 'Field Worker'} View`}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-700/70 hover:bg-amber-700 active:bg-amber-800 text-white border border-amber-400/30 transition-colors shadow-xs"
            >
              {userProfile?.role === 'Field Worker' ? (
                <>
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Manager View</span>
                </>
              ) : (
                <>
                  <HardHat className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Worker View</span>
                </>
              )}
            </button>

            {/* Sign Out */}
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-1.5 rounded-lg bg-amber-700/50 hover:bg-amber-700 active:bg-amber-800 text-amber-100 hover:text-white border border-amber-400/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cloud Sync Status Indicator */}
        <div className="bg-amber-700/90 px-4 py-1 text-xs flex items-center justify-between text-amber-100 border-t border-amber-500/40">
          <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
            <button
              onClick={() => setShowSupabaseModal(true)}
              className="flex items-center space-x-1.5 hover:underline cursor-pointer"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabase ? 'bg-emerald-400' : 'bg-amber-300'
                } animate-pulse`}
              ></span>
              <span className="font-medium text-[11px]">
                {isSupabase
                  ? 'Database: Supabase (PostgreSQL)'
                  : 'Database: Ready for Supabase / Local Mode'}
              </span>
            </button>
            <button
              onClick={() => refreshData()}
              className="flex items-center space-x-1 text-[11px] opacity-90 hover:opacity-100 transition-opacity"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sync Now</span>
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
