import React from 'react';
import { useAuth } from '../context/AuthContext';
import { HardHat, Users, LogOut } from 'lucide-react';
import { UserRole } from '../types';

export const Header: React.FC = () => {
  const { userProfile, signOut, updateUserRole, isConfigured } = useAuth();

  const handleToggleRole = () => {
    if (!userProfile) return;
    const nextRole: UserRole = userProfile.role === 'Field Worker' ? 'Manager' : 'Field Worker';
    updateUserRole(nextRole);
  };

  return (
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
          {/* Quick Role Switcher for seamless field testing */}
          <button
            onClick={handleToggleRole}
            title={`Switch to ${userProfile?.role === 'Field Worker' ? 'Manager' : 'Field Worker'} View`}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-700/70 hover:bg-amber-700 active:bg-amber-800 text-white border border-amber-400/30 transition-colors shadow-sm"
          >
            {userProfile?.role === 'Field Worker' ? (
              <>
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">View as Manager</span>
              </>
            ) : (
              <>
                <HardHat className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">View as Worker</span>
              </>
            )}
          </button>

          {/* Sign Out */}
          <button
            onClick={() => signOut()}
            title="Sign Out"
            className="p-2 rounded-lg bg-amber-700/50 hover:bg-amber-700 active:bg-amber-800 text-amber-100 hover:text-white border border-amber-400/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cloud Sync Status Indicator */}
      <div className="bg-amber-700/90 px-4 py-1 text-xs flex items-center justify-between text-amber-100 border-t border-amber-500/40">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-medium text-[11px]">
              {isConfigured ? 'Cloud Sync: Active (Firestore)' : 'Demo Cloud Mode: Active'}
            </span>
          </span>
          <span className="text-[11px] opacity-80">Real-Time Team Sync</span>
        </div>
      </div>
    </header>
  );
};
