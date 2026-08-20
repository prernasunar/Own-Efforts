import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, isFirebaseConfigured } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
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
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured] = useState(isFirebaseConfigured());

  // Initialize Auth state
  useEffect(() => {
    let unsubscribe = () => {};

    if (isConfigured && auth) {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              setUserProfile(userDoc.data() as UserProfile);
            } else {
              // Fallback profile if doc was not created yet
              const defaultProf: UserProfile = {
                uid: currentUser.uid,
                name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Worker',
                email: currentUser.email || '',
                role: 'Field Worker',
              };
              setUserProfile(defaultProf);
            }
          } catch (e) {
            console.error('Error fetching user profile:', e);
          }
        } else {
          setUserProfile(null);
        }
        setLoading(false);
      });
    } else {
      // Local demo mode for unconfigured Firebase instances
      const savedUser = localStorage.getItem(LOCAL_USER_KEY);
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser({
            uid: parsed.uid,
            email: parsed.email,
            displayName: parsed.name,
          } as unknown as User);
          setUserProfile(parsed);
        } catch {
          localStorage.removeItem(LOCAL_USER_KEY);
        }
      }
      setLoading(false);
    }

    return () => unsubscribe();
  }, [isConfigured]);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      if (isConfigured && auth) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, pass);
          const userDocRef = doc(db, 'users', userCredential.user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            const roleFallback: UserRole = email.toLowerCase().includes('manager') ? 'Manager' : 'Field Worker';
            const profile: UserProfile = {
              uid: userCredential.user.uid,
              name: userCredential.user.displayName || email.split('@')[0],
              email: userCredential.user.email || email,
              role: roleFallback,
            };
            setUserProfile(profile);
          }
          return;
        } catch (firebaseErr: any) {
          if (firebaseErr?.code === 'auth/operation-not-allowed') {
            console.warn('Firebase Email/Password provider not enabled. Falling back to local authenticated session.');
            // Fall through to local session creation
          } else {
            throw firebaseErr;
          }
        }
      }

      // Local / Offline session fallback
      const existingUsers = JSON.parse(localStorage.getItem(LOCAL_USERS_DB_KEY) || '{}');
      const found = Object.values(existingUsers).find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      ) as UserProfile | undefined;

      if (found) {
        setUser({
          uid: found.uid,
          email: found.email,
          displayName: found.name,
        } as unknown as User);
        setUserProfile(found);
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(found));
      } else {
        // Create instant session profile
        const demoUid = 'user_' + Math.random().toString(36).substring(2, 9);
        const newProfile: UserProfile = {
          uid: demoUid,
          name: email.split('@')[0],
          email,
          role: email.toLowerCase().includes('manager') ? 'Manager' : 'Field Worker',
        };
        existingUsers[demoUid] = newProfile;
        localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(existingUsers));
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(newProfile));
        setUser({
          uid: demoUid,
          email,
          displayName: newProfile.name,
        } as unknown as User);
        setUserProfile(newProfile);
      }
    } catch (error) {
      console.error('Sign In Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (preferredRole?: UserRole) => {
    setLoading(true);
    try {
      if (isConfigured && auth) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const userCredential = await signInWithPopup(auth, provider);
        const firebaseUser = userCredential.user;

        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            const roleToAssign = preferredRole || 'Field Worker';
            const profile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Field Worker',
              email: firebaseUser.email || '',
              role: roleToAssign,
            };
            await setDoc(userDocRef, {
              name: profile.name,
              email: profile.email,
              role: roleToAssign,
              createdAt: serverTimestamp(),
            });
            setUserProfile(profile);
          }
        } catch (err) {
          console.warn('Google sign in profile fetch/set note:', err);
          setUserProfile({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Field Worker',
            email: firebaseUser.email || '',
            role: preferredRole || 'Field Worker',
          });
        }
        setUser(firebaseUser);
      } else {
        // Local mode fallback
        const demoUid = 'google_' + Date.now().toString(36);
        const profile: UserProfile = {
          uid: demoUid,
          name: 'Demo Google User',
          email: 'google.user@civilsite.com',
          role: preferredRole || 'Field Worker',
        };
        setUser({
          uid: demoUid,
          displayName: profile.name,
          email: profile.email,
        } as unknown as User);
        setUserProfile(profile);
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
      }
    } catch (error: any) {
      const isCancellation =
        error?.code === 'auth/user-cancelled' ||
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request' ||
        (typeof error?.message === 'string' &&
          (error.message.includes('auth/user-cancelled') ||
            error.message.includes('auth/popup-closed-by-user') ||
            error.message.includes('auth/cancelled-popup-request') ||
            error.message.includes('user-cancelled')));

      if (isCancellation) {
        console.debug('Google sign in was cancelled by user:', error?.code || error?.message);
        return;
      }

      console.warn('Google Sign In Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (name: string, email: string, pass: string, role: UserRole) => {
    setLoading(true);
    try {
      if (isConfigured && auth) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
          const firebaseUser = userCredential.user;
          await updateProfile(firebaseUser, { displayName: name });

          const profile: UserProfile = {
            uid: firebaseUser.uid,
            name,
            email,
            role,
          };

          const path = `users/${firebaseUser.uid}`;
          try {
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              name,
              email,
              role,
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, path);
          }

          setUser(firebaseUser);
          setUserProfile(profile);
          return;
        } catch (firebaseErr: any) {
          if (firebaseErr?.code === 'auth/operation-not-allowed') {
            console.warn('Firebase Email/Password provider not enabled. Creating local authenticated profile.');
            // Fall through to local profile creation
          } else {
            throw firebaseErr;
          }
        }
      }

      // Local session creation
      const uid = 'user_' + Date.now().toString(36);
      const profile: UserProfile = {
        uid,
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
      };

      const existingUsers = JSON.parse(localStorage.getItem(LOCAL_USERS_DB_KEY) || '{}');
      existingUsers[uid] = profile;
      localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(existingUsers));
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));

      setUser({
        uid,
        email,
        displayName: name,
      } as unknown as User);
      setUserProfile(profile);
    } catch (error) {
      console.error('Sign Up Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const instantLogin = async (role: UserRole, customName?: string) => {
    setLoading(true);
    try {
      const isManagerRole = role === 'Manager';
      const displayName = customName || (isManagerRole ? 'Vikram Singh (Manager)' : 'Rajesh Kumar (Field Worker)');
      const email = isManagerRole ? 'manager@civilsite.com' : 'worker@civilsite.com';

      // 1. Try Firebase Anonymous Auth if available
      if (isConfigured && auth) {
        try {
          const anonCredential = await signInAnonymously(auth);
          const firebaseUser = anonCredential.user;
          await updateProfile(firebaseUser, { displayName });

          const profile: UserProfile = {
            uid: firebaseUser.uid,
            name: displayName,
            email,
            role,
            createdAt: new Date().toISOString(),
          };

          // Save user role in Firestore
          try {
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              name: profile.name,
              email: profile.email,
              role: profile.role,
              createdAt: serverTimestamp(),
            });
          } catch (docErr) {
            console.debug('User profile save note:', docErr);
          }

          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
          setUser(firebaseUser);
          setUserProfile(profile);
          return;
        } catch (anonErr) {
          console.debug('Firebase anonymous sign-in not active; using local session fallback:', anonErr);
        }
      }

      // 2. Local session fallback
      const uid = isManagerRole ? 'mgr_' + Date.now().toString(36) : 'wrk_' + Date.now().toString(36);
      const profile: UserProfile = {
        uid,
        name: displayName,
        email,
        role,
        createdAt: new Date().toISOString(),
      };

      const existingUsers = JSON.parse(localStorage.getItem(LOCAL_USERS_DB_KEY) || '{}');
      existingUsers[uid] = profile;
      localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(existingUsers));
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));

      setUser({
        uid,
        email,
        displayName,
      } as unknown as User);
      setUserProfile(profile);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      if (isConfigured && auth) {
        await firebaseSignOut(auth);
      }
      localStorage.removeItem(LOCAL_USER_KEY);
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Sign Out Error:', error);
    }
  };

  const updateUserRole = async (newRole: UserRole) => {
    if (!userProfile) return;
    const updated = { ...userProfile, role: newRole };
    setUserProfile(updated);

    if (isConfigured && db && user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { role: newRole }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    } else {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updated));
      const existingUsers = JSON.parse(localStorage.getItem(LOCAL_USERS_DB_KEY) || '{}');
      if (existingUsers[userProfile.uid]) {
        existingUsers[userProfile.uid].role = newRole;
        localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(existingUsers));
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isConfigured,
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
