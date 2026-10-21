import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { getSupabaseClient, isSupabaseConfigured, supabaseDb } from '../lib/supabase';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: any | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  backendProvider: 'firebase' | 'supabase' | 'local';
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
  const isFirebase = isFirebaseConfigured() && Boolean(auth);

  const backendProvider: 'firebase' | 'supabase' | 'local' = isFirebase
    ? 'firebase'
    : isSupabase
    ? 'supabase'
    : 'local';

  useEffect(() => {
    let isMounted = true;

    // 1. Firebase Auth listener (Primary cloud backend)
    if (isFirebase && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (!isMounted) return;

        if (fbUser) {
          try {
            const savedUser = localStorage.getItem(LOCAL_USER_KEY);
            const parsed = savedUser ? JSON.parse(savedUser) : null;
            const isBridgeAccount =
              fbUser.email === 'worker@civilsite.com' || fbUser.email === 'manager@civilsite.com';

            let profile: UserProfile | null = null;

            // If using a shared bridge account and local storage has a specific user identity, preserve it
            if (
              isBridgeAccount &&
              parsed &&
              parsed.name &&
              parsed.name !== 'Field Supervisor' &&
              parsed.name !== 'Field Worker' &&
              parsed.name !== 'Site Manager'
            ) {
              profile = {
                uid: fbUser.uid,
                name: parsed.name,
                email: parsed.email || fbUser.email || '',
                role: (parsed.role as UserRole) || 'Field Executive',
              };
            }

            if (!profile && db) {
              try {
                const userDocSnap = await getDoc(doc(db, 'users', fbUser.uid));
                if (userDocSnap.exists()) {
                  const data = userDocSnap.data();
                  profile = {
                    uid: fbUser.uid,
                    name: data.name || fbUser.displayName || parsed?.name || 'Field Executive',
                    email: data.email || fbUser.email || '',
                    role: (data.role as UserRole) || 'Field Executive',
                  };
                }
              } catch (readErr) {
                console.warn('Could not read user profile from Firestore:', readErr);
              }
            }

            if (!profile) {
              const isManagerEmail =
                fbUser.email?.toLowerCase() === 'prernasunar@gmail.com' ||
                fbUser.email?.toLowerCase() === 'prashantgamre00@gmail.com';
              profile = {
                uid: fbUser.uid,
                name:
                  fbUser.displayName ||
                  parsed?.name ||
                  fbUser.email?.split('@')[0] ||
                  (fbUser.isAnonymous ? 'Field Executive (Guest)' : 'Field Executive'),
                email: fbUser.email || parsed?.email || (fbUser.isAnonymous ? 'guest@site.work' : ''),
                role: isManagerEmail ? 'Manager' : (parsed?.role as UserRole) || 'Field Executive',
              };

              if (db && !isBridgeAccount) {
                try {
                  await setDoc(doc(db, 'users', fbUser.uid), {
                    name: profile.name,
                    role: profile.role,
                    email: profile.email,
                    createdAt: serverTimestamp(),
                  });
                } catch (writeErr) {
                  console.warn('Could not save user profile to Firestore:', writeErr);
                }
              }
            }

            if (isMounted) {
              setUser(fbUser);
              setUserProfile(profile);
              localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
              setLoading(false);
            }
          } catch (err) {
            console.error('Error handling Firebase auth state change:', err);
            if (isMounted) setLoading(false);
          }
        } else {
          // If no Firebase user, check local session and auto-connect Firebase Auth bridge so Firestore always works
          const savedUser = localStorage.getItem(LOCAL_USER_KEY);
          if (savedUser && isMounted) {
            try {
              const parsed = JSON.parse(savedUser);
              setUser({ uid: parsed.uid, email: parsed.email, displayName: parsed.name });
              setUserProfile(parsed);
              const bridgeEmail = parsed.role === 'Manager' ? 'manager@civilsite.com' : 'worker@civilsite.com';
              const bridgePass = parsed.role === 'Manager' ? 'Manager123456!' : 'Worker123456!';
              signInWithEmailAndPassword(auth, bridgeEmail, bridgePass).catch(() => {});
            } catch {
              localStorage.removeItem(LOCAL_USER_KEY);
            }
          }
          if (isMounted) setLoading(false);
        }
      });

      return () => {
        isMounted = false;
        unsubscribe();
      };
    }

    // 2. Fallback Supabase / Local
    const initFallbackAuth = async () => {
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

    initFallbackAuth();

    return () => {
      isMounted = false;
    };
  }, [isFirebase, isSupabase]);

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

      // If Firebase is active, sign in with real Firebase Auth Email/Password
      if (isFirebase && auth) {
        const firebasePass = pass.length < 6 ? pass.padEnd(6, '0') : pass;
        try {
          let fbUser: any = null;
          try {
            const cred = await signInWithEmailAndPassword(auth, cleanEmail, firebasePass);
            fbUser = cred.user;
          } catch (signInErr: any) {
            if (
              (signInErr.code === 'auth/invalid-credential' ||
                signInErr.code === 'auth/user-not-found' ||
                signInErr.code === 'auth/wrong-password') &&
              autoRegister
            ) {
              try {
                const cred = await createUserWithEmailAndPassword(auth, cleanEmail, firebasePass);
                fbUser = cred.user;
              } catch {
                const bridgeEmail = defaultRole === 'Manager' ? 'manager@civilsite.com' : 'worker@civilsite.com';
                const bridgePass = defaultRole === 'Manager' ? 'Manager123456!' : 'Worker123456!';
                const cred = await signInWithEmailAndPassword(auth, bridgeEmail, bridgePass);
                fbUser = cred.user;
              }
            } else {
              throw signInErr;
            }
          }

          const isBridgeAccount =
            fbUser.email === 'worker@civilsite.com' || fbUser.email === 'manager@civilsite.com';
          const isManagerEmail =
            cleanEmail.toLowerCase() === 'prernasunar@gmail.com' ||
            cleanEmail.toLowerCase() === 'prashantgamre00@gmail.com' ||
            defaultRole === 'Manager';

          let resolvedName = fbUser.displayName || cleanEmail.split('@')[0];
          let resolvedRole: UserRole = isManagerEmail ? 'Manager' : defaultRole;

          if (db && !isBridgeAccount) {
            try {
              const existingSnap = await getDoc(doc(db, 'users', fbUser.uid));
              if (existingSnap.exists()) {
                const existingData = existingSnap.data();
                if (existingData.name) resolvedName = existingData.name;
                if (existingData.role) resolvedRole = existingData.role as UserRole;
              } else {
                await setDoc(
                  doc(db, 'users', fbUser.uid),
                  {
                    name: resolvedName,
                    role: resolvedRole,
                    email: cleanEmail,
                    createdAt: serverTimestamp(),
                  },
                  { merge: true }
                );
              }
            } catch (writeErr) {
              console.warn('Could not sync user profile to Firestore:', writeErr);
            }
          }

          const profile: UserProfile = {
            uid: fbUser.uid,
            name: resolvedName,
            email: cleanEmail,
            role: resolvedRole,
          };
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
          setUser(fbUser);
          setUserProfile(profile);
          return;
        } catch (fbAuthErr: any) {
          console.warn('Firebase email sign-in fallback to local:', fbAuthErr);
        }
      }

      // Local session
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

      if (isFirebase && auth) {
        const firebasePass = pass.length < 6 ? pass.padEnd(6, '0') : pass;
        try {
          let fbUser: any = null;
          try {
            const cred = await createUserWithEmailAndPassword(auth, cleanEmail, firebasePass);
            fbUser = cred.user;
          } catch (signUpErr: any) {
            if (signUpErr.code === 'auth/email-already-in-use') {
              try {
                const cred = await signInWithEmailAndPassword(auth, cleanEmail, firebasePass);
                fbUser = cred.user;
              } catch {
                const bridgeEmail = role === 'Manager' ? 'manager@civilsite.com' : 'worker@civilsite.com';
                const bridgePass = role === 'Manager' ? 'Manager123456!' : 'Worker123456!';
                const cred = await signInWithEmailAndPassword(auth, bridgeEmail, bridgePass);
                fbUser = cred.user;
              }
            } else {
              throw signUpErr;
            }
          }

          const isBridgeAccount =
            fbUser.email === 'worker@civilsite.com' || fbUser.email === 'manager@civilsite.com';
          const profile: UserProfile = { uid: fbUser.uid, name: cleanName, email: cleanEmail, role };
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));

          if (db) {
            try {
              const targetDocId = isBridgeAccount
                ? 'worker_' + cleanName.toLowerCase().replace(/\s+/g, '_')
                : fbUser.uid;
              await setDoc(
                doc(db, 'users', targetDocId),
                {
                  name: cleanName,
                  role,
                  email: cleanEmail,
                  createdAt: serverTimestamp(),
                },
                { merge: true }
              );
            } catch (writeErr) {
              console.warn('Could not save user profile to Firestore:', writeErr);
            }
          }
          setUser(fbUser);
          setUserProfile(profile);
          return;
        } catch (anonErr) {
          console.warn('Firebase signup fallback to local:', anonErr);
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

    // 1. Firebase Google Auth
    if (isFirebase && auth) {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const fbUser = cred.user;

      const isManagerEmail = fbUser.email?.toLowerCase() === 'prernasunar@gmail.com';
      let profile: UserProfile = {
        uid: fbUser.uid,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Field Worker',
        email: fbUser.email || '',
        role: isManagerEmail ? 'Manager' : roleToAssign,
      };

      if (db) {
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            profile = {
              uid: fbUser.uid,
              name: data.name || profile.name,
              email: data.email || profile.email,
              role: (data.role as UserRole) || profile.role,
            };
          } else {
            await setDoc(doc(db, 'users', fbUser.uid), {
              name: profile.name,
              role: profile.role,
              email: profile.email,
              createdAt: serverTimestamp(),
            });
          }
        } catch (e) {
          console.warn('Firestore profile sync error on Google sign in:', e);
        }
      }

      setUser(fbUser);
      setUserProfile(profile);
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
      return;
    }

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
    // 1. Connect with dedicated real Firebase account so Firestore has a valid auth session
    if (isFirebase && auth) {
      try {
        const demoEmail = role === 'Manager' ? 'manager@civilsite.com' : 'worker@civilsite.com';
        const demoPass = role === 'Manager' ? 'Manager123456!' : 'Worker123456!';
        let fbUser: any = null;

        try {
          const cred = await signInWithEmailAndPassword(auth, demoEmail, demoPass);
          fbUser = cred.user;
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/user-not-found') {
            const cred = await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
            fbUser = cred.user;
          } else {
            throw signInErr;
          }
        }

        const profile: UserProfile = {
          uid: fbUser.uid,
          name: customName || (role === 'Manager' ? 'Site Manager' : 'Field Executive'),
          email: demoEmail,
          role,
        };

        if (db) {
          try {
            await setDoc(
              doc(db, 'users', fbUser.uid),
              {
                name: profile.name,
                role: profile.role,
                email: profile.email,
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (e) {
            console.warn('Could not store instant user profile in Firestore:', e);
          }
        }

        setUser(fbUser);
        setUserProfile(profile);
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
        return;
      } catch (authErr: any) {
        console.warn('Firebase instant sign in notice (falling back to local demo session):', authErr.message);
      }
    }

    // Fallback: Local demo session
    const uid = 'demo_' + role.toLowerCase().replace(' ', '_') + '_' + Math.random().toString(36).substring(2, 6);
    const profile: UserProfile = {
      uid,
      name: customName || (role === 'Manager' ? 'Site Manager' : 'Field Executive'),
      email: `${role.toLowerCase().replace(' ', '.')}@site.work`,
      role,
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
    setUser({ uid: profile.uid, email: profile.email, displayName: profile.name });
    setUserProfile(profile);
  };

  const signOut = async () => {
    if (isFirebase && auth) {
      await firebaseSignOut(auth).catch(() => {});
    }
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

    if (isFirebase && db && auth?.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), { role }, { merge: true });
      } catch (e) {
        console.warn('Could not update role in Firestore:', e);
      }
    }

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
        isConfigured: isFirebase || isSupabase,
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
