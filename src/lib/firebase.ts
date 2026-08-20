import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
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
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigType = {
  apiKey: firebaseAppletConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: firebaseAppletConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: firebaseAppletConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: firebaseAppletConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: firebaseAppletConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: firebaseAppletConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || '',
  firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId || undefined,
};

const STORAGE_KEY = 'civil_site_firebase_config';

export function getSavedFirebaseConfig(): FirebaseConfigType {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && !parsed.apiKey.includes('YOUR_FIREBASE_API_KEY')) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading saved firebase config', e);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(config: FirebaseConfigType): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.location.reload();
}

export function isFirebaseConfigured(): boolean {
  const config = getSavedFirebaseConfig();
  return Boolean(config.apiKey && config.projectId);
}

let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(getSavedFirebaseConfig());
} else {
  app = getApp();
}

const config = getSavedFirebaseConfig();
// Initialize Firestore with specific database ID if provided in config
export const db: Firestore = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);
export const auth: Auth = getAuth(app);
export const appInstance = app;

// Test connection on boot as mandated by Firestore guidelines
async function testConnection() {
  try {
    if (db) {
      await getDocFromServer(doc(db, 'test', 'connection'));
    }
  } catch (error) {
    // Gracefully handle initial offline / unavailable handshake states
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || error.message.includes('unavailable')) {
        // Expected when connection is still initializing or offline
      } else {
        console.debug('Firestore connection initial probe:', error.message);
      }
    }
  }
}
testConnection();

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
