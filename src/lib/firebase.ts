import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  Firestore,
  doc,
  getDoc,
} from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

export interface FirebaseConfigType {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

// Active Firebase Configuration from provisioned cloud applet config
export const FIREBASE_CONFIG: FirebaseConfigType = {
  apiKey: firebaseAppletConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: firebaseAppletConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: firebaseAppletConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: firebaseAppletConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: firebaseAppletConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: firebaseAppletConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || '',
  firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId || undefined,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}

let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(FIREBASE_CONFIG);
} else {
  app = getApp();
}

function createFirestoreInstance(firebaseApp: FirebaseApp, databaseId?: string): Firestore {
  try {
    return databaseId
      ? initializeFirestore(
          firebaseApp,
          { experimentalAutoDetectLongPolling: true },
          databaseId
        )
      : initializeFirestore(firebaseApp, {
          experimentalAutoDetectLongPolling: true,
        });
  } catch {
    return databaseId ? getFirestore(firebaseApp, databaseId) : getFirestore(firebaseApp);
  }
}

// Initialize Firestore with specific database ID and long-polling auto-detection for reliable connectivity
export const db: Firestore = createFirestoreInstance(app, FIREBASE_CONFIG.firestoreDatabaseId);
export const auth: Auth = getAuth(app);
export const appInstance = app;

export async function testConnection() {
  if (!db || !auth?.currentUser) return;
  try {
    await getDoc(doc(db, 'test', 'connection'));
  } catch {
    // Ignore transient offline or permission checks during startup
  }
}

export async function checkFirestoreConnection() {
  if (!db) return false;
  try {
    await getDoc(doc(db, 'test', 'connection'));
    return true;
  } catch {
    return false;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
