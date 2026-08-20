import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HardHat, Users, Lock, Mail, User as UserIcon, ArrowRight, AlertCircle, Sparkles, CheckCircle2, Database } from 'lucide-react';
import { UserRole } from '../types';
import { SupabaseConfigModal } from './SupabaseConfigModal';

export const AuthView: React.FC = () => {
  const { signIn, signUp, signInWithGoogle, instantLogin } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Field Worker');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authTip, setAuthTip] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setAuthTip(null);
    setLoading(true);

    try {
      await signInWithGoogle(role);
    } catch (err: any) {
      const isCancellation =
        err?.code === 'auth/user-cancelled' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        (typeof err?.message === 'string' &&
          (err.message.includes('auth/user-cancelled') ||
            err.message.includes('auth/popup-closed-by-user') ||
            err.message.includes('auth/cancelled-popup-request') ||
            err.message.includes('user-cancelled')));

      if (isCancellation) {
        return;
      }

      console.warn('Google auth warning:', err);
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        setAuthTip(
          'Google popup closed because this preview URL is not in Firebase Auth Authorized Domains. You can use 1-Click Instant Access below to sign in immediately without restrictions.'
        );
      } else if (err?.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your mobile browser. Please allow popups or use 1-Click Instant Access below.');
      } else if (err?.code === 'auth/network-request-failed') {
        setError('Network connection error. Please check your internet connection.');
      } else if (err?.message?.includes('disallowed_useragent') || err?.message?.includes('webview')) {
        setError('Google blocks sign-in inside in-app browsers. Please tap 1-Click Instant Access below or open in Chrome/Safari.');
      } else {
        setError(err.message || 'Google sign-in could not complete. Please use Instant 1-Click Access below.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInstantAccess = async (targetRole: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      await instantLogin(targetRole);
    } catch (err: any) {
      console.error('Instant access error:', err);
      setError('Could not start instant session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          throw new Error('Please enter your full name');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        await signUp(name.trim(), email.trim(), password, role);
      } else {
        await signIn(email.trim(), password, true, role);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = err.message || 'Authentication failed. Please check credentials.';
      if (msg.includes('auth/operation-not-allowed')) {
        msg = 'Email/Password sign-in is disabled. You can use Instant 1-Click Access below.';
      } else if (msg.includes('auth/invalid-credential') || msg.includes('auth/user-not-found') || msg.includes('auth/wrong-password')) {
        msg = 'Invalid email or password. Please check your credentials or create an account.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'This email is already registered. Please sign in instead.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Autofills
  const handleQuickDemo = (demoRole: UserRole) => {
    if (demoRole === 'Field Worker') {
      setEmail('worker@civilsite.com');
      setPassword('worker123');
      setName('Rajesh Kumar');
      setRole('Field Worker');
    } else {
      setEmail('manager@civilsite.com');
      setPassword('manager123');
      setName('Vikram Singh');
      setRole('Manager');
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* App Icon & Branding */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-600 border-2 border-amber-500 shadow-md flex items-center justify-center text-white">
            <HardHat className="w-9 h-9" />
          </div>
        </div>

        <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
          Civil Site Work Logger
        </h2>
        <p className="mt-1 text-center text-sm font-medium text-stone-600">
          Mobile Daily Site Log & Real-Time Cloud Progress
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-5 sm:px-8 shadow-md rounded-2xl border border-stone-200">
          {/* Sign In vs Sign Up Tabs */}
          <div className="flex rounded-xl bg-stone-100 p-1 mb-6 border border-stone-200">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                !isSignUp
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                isSignUp
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-900">Sign In Issue</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
                <div className="mt-2.5 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleInstantAccess(role)}
                    className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-md shadow-xs"
                  >
                    Enter as {role} (Instant Access)
                  </button>
                </div>
              </div>
            </div>
          )}

          {authTip && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm flex items-start space-x-2.5">
              <Sparkles className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Domain Note</p>
                <p className="text-xs text-amber-800 mt-0.5">{authTip}</p>
                <button
                  type="button"
                  onClick={() => handleInstantAccess(role)}
                  className="mt-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg shadow-xs flex items-center space-x-1"
                >
                  <span>Continue with 1-Click Instant Access</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quick Role Selection for Google & Quick Access */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
              Sign In As:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('Field Worker')}
                className={`py-2 px-3 rounded-xl border-2 text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  role === 'Field Worker'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <HardHat className="w-4 h-4 text-amber-600" />
                <span>Field Worker</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('Manager')}
                className={`py-2 px-3 rounded-xl border-2 text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  role === 'Manager'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Users className="w-4 h-4 text-amber-600" />
                <span>Manager</span>
              </button>
            </div>
          </div>

          {/* One-Click Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full mb-4 flex items-center justify-center space-x-3 py-3 px-4 rounded-xl border-2 border-stone-300 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-800 font-bold text-sm shadow-xs transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-stone-200 w-full" />
            <span className="bg-white px-3 text-xs font-bold text-stone-400 uppercase tracking-wider absolute">
              or use email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-semibold text-stone-800 mb-1.5">
                  Full Name
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="block w-full pl-11 pr-3 py-3 rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 text-base focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-stone-800 mb-1.5">
                Work Email
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full pl-11 pr-3 py-3 rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 text-base focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-800 mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-3 py-3 rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 text-base focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Role Selection on Sign Up */}
            {isSignUp && (
              <div className="pt-1">
                <label className="block text-sm font-semibold text-stone-800 mb-2">
                  Select Your Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('Field Worker')}
                    className={`p-3.5 rounded-xl border-2 text-left flex flex-col items-start transition-all ${
                      role === 'Field Worker'
                        ? 'border-amber-600 bg-amber-50/70 shadow-sm'
                        : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <HardHat
                        className={`w-5 h-5 ${
                          role === 'Field Worker' ? 'text-amber-600' : 'text-stone-500'
                        }`}
                      />
                      <span
                        className={`w-3.5 h-3.5 rounded-full border-2 ${
                          role === 'Field Worker'
                            ? 'border-amber-600 bg-amber-600'
                            : 'border-stone-400'
                        }`}
                      />
                    </div>
                    <span className="font-bold text-sm text-stone-900">Field Worker</span>
                    <span className="text-[11px] text-stone-500 mt-0.5 leading-tight">
                      Log daily site work & GPS
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('Manager')}
                    className={`p-3.5 rounded-xl border-2 text-left flex flex-col items-start transition-all ${
                      role === 'Manager'
                        ? 'border-amber-600 bg-amber-50/70 shadow-sm'
                        : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Users
                        className={`w-5 h-5 ${
                          role === 'Manager' ? 'text-amber-600' : 'text-stone-500'
                        }`}
                      />
                      <span
                        className={`w-3.5 h-3.5 rounded-full border-2 ${
                          role === 'Manager'
                            ? 'border-amber-600 bg-amber-600'
                            : 'border-stone-400'
                        }`}
                      />
                    </div>
                    <span className="font-bold text-sm text-stone-900">Manager</span>
                    <span className="text-[11px] text-stone-500 mt-0.5 leading-tight">
                      Monitor team progress & reports
                    </span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl shadow-md text-base font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition-colors"
            >
              <span>{loading ? 'Processing...' : isSignUp ? 'Create Site Account' : 'Sign In'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          {/* Instant 1-Click Access for Evaluation & Offline Test */}
          <div className="mt-6 pt-5 border-t border-stone-200">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Instant 1-Click Access</span>
              </p>
              <button
                type="button"
                onClick={() => setShowSupabaseModal(true)}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center space-x-1"
              >
                <span>Supabase Setup</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => handleInstantAccess('Field Worker')}
                disabled={loading}
                className="p-2.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 rounded-xl border border-amber-300 text-center transition-all shadow-xs disabled:opacity-50"
              >
                👷 Instant Worker
              </button>
              <button
                type="button"
                onClick={() => handleInstantAccess('Manager')}
                disabled={loading}
                className="p-2.5 text-xs font-bold text-stone-900 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-xl border border-stone-300 text-center transition-all shadow-xs disabled:opacity-50"
              >
                👔 Instant Manager
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
              <span>Need form autofill?</span>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('Field Worker')}
                  className="underline hover:text-amber-800 font-semibold"
                >
                  Fill Worker
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('Manager')}
                  className="underline hover:text-amber-800 font-semibold"
                >
                  Fill Manager
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SupabaseConfigModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
      />
    </div>
  );
};
