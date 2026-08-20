import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { getSupabaseClient, isSupabaseConfigured, supabaseDb } from '../lib/supabase';

interface AuthContextType {
  user: any | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  backendProvider: 'supabase' | 'local';
  signIn: (email: string, pass: string, autoRegister?: boolean, role?: UserRole) => Promise<void>;
  signInWithGoogle: (preferredRole?: UserRole) => Promise<void>;
  signUp: (name: string, email: string, pass: string, role: UserRole) => Promise<void>;
  instantLogin: (role: UserRole, customName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER_KEY = 'civil_site_active_user';
const LOCAL_USERS_DB_KEY = 'civil_site_users_db';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabaseClient = getSupabaseClient();
  const isSupabase = isSupabaseConfigured() && Boolean(supabaseClient);

  const backendProvider: 'supabase' | 'local' = isSupabase ? 'supabase' : 'local';

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // 1. Check Supabase Auth session
      if (isSupabase && supabaseClient) {
        try {
          const { data } = await supabaseClient.auth.getSession();
          if (data.session?.user && isMounted) {
            const sbUser = data.session.user;
            const profile = await supabaseDb.getProfile(sbUser.id);
            const resolvedProfile: UserProfile = profile || {
              uid: sbUser.id,
              name: sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'User',
              email: sbUser.email || '',
              role: (sbUser.user_metadata?.role as UserRole) || 'Field Worker',
            };
            setUser(sbUser);
            setUserProfile(resolvedProfile);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Supabase session check error:', err);
        }
      }

      // 2. Check Saved Local Session
      const savedUser = localStorage.getItem(LOCAL_USER_KEY);
      if (savedUser && isMounted) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser({ uid: parsed.uid, email: parsed.email, displayName: parsed.name });
          setUserProfile(parsed);
          setLoading(false);
          return;
        } catch {
          localStorage.removeItem(LOCAL_USER_KEY);
        }
      }

      if (isMounted) setLoading(false);
    };

    initAuth();
  }, [isSupabase]);

  const signIn = async (email: string, pass: string, autoRegister: boolean = true, defaultRole: UserRole = 'Field Worker') => {
    setLoading(true);
    const cleanEmail = email.trim();
    try {
      if (isSupabase && supabaseClient) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: cleanEmail,
          password: pass,
        });

        if (error) {
          // If login credentials invalid, seamlessly try to auto-sign-up if autoRegister is true
          if (error.message.includes('Invalid login credentials') && autoRegister) {
            try {
              const guessedName = cleanEmail.split('@')[0];
              const formattedName = guessedName.charAt(0).toUpperCase() + guessedName.slice(1);
              const signUpResult = await supabaseClient.auth.signUp({
                email: cleanEmail,
                password: pass,
                options: { data: { name: formattedName, role: defaultRole } },
              });

              if (signUpResult.data.user) {
                const profile: UserProfile = {
                  uid: signUpResult.data.user.id,
                  name: formattedName,
                  email: cleanEmail,
                  role: defaultRole,
                };
                await supabaseDb.upsertProfile(profile);
                setUser(signUpResult.data.user);
                setUserProfile(profile);
                localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
                return;
              }
            } catch (autoErr) {
              console.warn('Auto registration attempt during sign-in failed:', autoErr);
            }
            throw new Error(
              'Invalid password or account not found. If this is your first time signing in, click "Create Account" or use 1-Click Instant Access below.'
            );
          } else if (error.message.includes('Email not confirmed')) {
            // If email is not confirmed, grant seamless entry with local profile while Supabase confirmation is pending
            const profile: UserProfile = {
              uid: 'sb_pending_' + Math.random().toString(36).substring(2, 9),
              name: cleanEmail.split('@')[0],
              email: cleanEmail,
              role: defaultRole,
            };
            setUser({ uid: profile.uid, email: cleanEmail, displayName: profile.name });
            setUserProfile(profile);
            localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
            return;
          }
          throw new Error(error.message);
        }

        if (data.user) {
          let profile = await supabaseDb.getProfile(data.user.id);
          if (!profile) {
            profile = {
              uid: data.user.id,
              name: data.user.user_metadata?.name || cleanEmail.split('@')[0],
              email: data.user.email || cleanEmail,
              role: (data.user.user_metadata?.role as UserRole) || defaultRole,
            };
            await supabaseDb.upsertProfile(profile);
          }
          setUser(data.user);
          setUserProfile(profile);
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
          return;
        }
      }

      // Fallback local session (works seamlessly without backend required)
      const existingUsers = JSON.parse(localStorage.getItem(LOCAL_USERS_DB_KEY) || '{}');
      const found = Object.values(existingUsers).find(
        (u: any) => u.email?.toLowerCase() === cleanEmail.toLowerCase()
      ) as UserProfile | undefined;

      const profile: UserProfile = found || {
        uid: 'user_' + Math.random().toString(36).substring(2, 9),
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        role: defaultRole,
      };

      existingUsers[profile.uid] = profile;
      localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(existingUsers));
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
      setUser({ uid: profile.uid, email: cleanEmail, displayName: profile.name });
      setUserProfile(profile);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (name: string, email: string, pass: string, role: UserRole) => {
    setLoading(true);
    const cleanEmail = email.trim();
    const cleanName = name.trim();
    try {
      if (isSupabase && supabaseClient) {
        const { data, error } = await supabaseClient.auth.signUp({
          email: cleanEmail,
          password: pass,
          options: { data: { name: cleanName, role } },
        });

        if (error) {
          if (error.message.includes('User already registered')) {
            // If already registered, try signing in with those credentials
            return await signIn(cleanEmail, pass, false, role);
          }
          throw new Error(error.message);
        }

        if (data.user) {
          const profile: UserProfile = { uid: data.user.id, name: cleanName, email: cleanEmail, role };
          await supabaseDb.upsertProfile(profile);
          setUser(data.user);
          setUserProfile(profile);
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
          return;
        }
      }

      // Local Registration
      const uid = 'user_' + Math.random().toString(36).substring(2, 9);
      const profile: UserProfile = { uid, name: cleanName, email: cleanEmail, role };
      const existingUsers = JSON.parse(localStorage.getItem(LOCAL_USERS_DB_KEY) || '{}');
      existingUsers[uid] = profile;
      localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(existingUsers));
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
      setUser({ uid, email: cleanEmail, displayName: cleanName });
      setUserProfile(profile);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (preferredRole?: UserRole) => {
    const roleToAssign = preferredRole || 'Field Worker';
    if (isSupabase && supabaseClient) {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) throw new Error(error.message);
      return;
    }
    // Instant fallback
    await instantLogin(roleToAssign);
  };

  const instantLogin = async (role: UserRole, customName?: string) => {
    const uid = 'demo_' + role.toLowerCase().replace(' ', '_') + '_' + Math.random().toString(36).substring(2, 6);
    const profile: UserProfile = {
      uid,
      name: customName || (role === 'Manager' ? 'Site Manager' : 'Field Supervisor'),
      email: `${role.toLowerCase().replace(' ', '.')}@site.work`,
      role,
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
    setUser({ uid: profile.uid, email: profile.email, displayName: profile.name });
    setUserProfile(profile);
  };

  const signOut = async () => {
    if (isSupabase && supabaseClient) {
      await supabaseClient.auth.signOut().catch(() => {});
    }
    localStorage.removeItem(LOCAL_USER_KEY);
    setUser(null);
    setUserProfile(null);
  };

  const updateUserRole = async (role: UserRole) => {
    if (!userProfile) return;
    const updated = { ...userProfile, role };
    setUserProfile(updated);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updated));
    if (isSupabase) {
      await supabaseDb.upsertProfile(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isConfigured: isSupabase,
        backendProvider,
        signIn,
        signInWithGoogle,
        signUp,
        instantLogin,
        signOut,
        updateUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
