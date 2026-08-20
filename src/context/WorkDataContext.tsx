import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { WorkEntry, WorkTypeItem, PRESET_WORK_TYPES, EntryStatus, UOMType } from '../types';

interface WorkDataContextType {
  workTypes: WorkTypeItem[];
  entries: WorkEntry[];
  myEntries: WorkEntry[];
  loading: boolean;
  addWorkType: (name: string, uom: UOMType) => Promise<void>;
  createEntry: (entryData: {
    workType: string;
    uom: UOMType;
    quantity: number;
    status: EntryStatus;
    locationFrom: string;
    locationTo: string;
    remark?: string;
    photos?: string[];
  }) => Promise<string>;
  updateEntry: (id: string, entryData: Partial<WorkEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

const WorkDataContext = createContext<WorkDataContextType | undefined>(undefined);

const LOCAL_ENTRIES_KEY = 'civil_site_entries_data';
const LOCAL_CUSTOM_WORKTYPES_KEY = 'civil_site_custom_worktypes';

// Sample seed entries for instant preview richness
const INITIAL_DEMO_ENTRIES: WorkEntry[] = [
  {
    id: 'demo_entry_1',
    uid: 'demo_worker_1',
    userName: 'Rajesh Kumar',
    workType: 'Trenching',
    uom: 'meter',
    quantity: 145,
    status: 'Done',
    locationFrom: 'Sector 14 Junction, North Road',
    locationTo: 'Main Substation Gate #2',
    remark: 'Excavated 1.2m depth trench with safety barricades installed.',
    createdAt: { toDate: () => new Date(Date.now() - 3600000 * 2) },
  },
  {
    id: 'demo_entry_2',
    uid: 'demo_worker_2',
    userName: 'Amit Sharma',
    workType: 'Duct Laying',
    uom: 'meter',
    quantity: 90,
    status: 'Pending',
    locationFrom: 'Manhole MH-42 (Station Road)',
    locationTo: 'Optical Hub Node 7',
    remark: 'Waiting for HDPE coupler delivery to finish joining.',
    createdAt: { toDate: () => new Date(Date.now() - 3600000 * 4) },
  },
  {
    id: 'demo_entry_3',
    uid: 'demo_worker_1',
    userName: 'Rajesh Kumar',
    workType: 'New HH',
    uom: 'Number',
    quantity: 2,
    status: 'Done',
    locationFrom: 'Crossroad Sector 9',
    locationTo: 'Plot 104 Boundary Wall',
    remark: 'Reinforced concrete handholes placed and leveled.',
    createdAt: { toDate: () => new Date(Date.now() - 3600000 * 6) },
  },
  {
    id: 'demo_entry_4',
    uid: 'demo_worker_3',
    userName: 'Suresh Patel',
    workType: 'Cable Blowing',
    uom: 'meter',
    quantity: 320,
    status: 'Done',
    locationFrom: 'Feeder Point FP-03',
    locationTo: 'Distribution Box DB-12',
    remark: '48F OFC blown smoothly with air compressor.',
    createdAt: { toDate: () => new Date(Date.now() - 3600000 * 8) },
  },
];

export const WorkDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile } = useAuth();
  const [customWorkTypes, setCustomWorkTypes] = useState<WorkTypeItem[]>([]);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const isConfigured = isFirebaseConfigured();

  // Combine Preset work types with custom shared work types
  const workTypes: WorkTypeItem[] = [
    ...PRESET_WORK_TYPES.map((p) => ({ ...p, isCustom: false })),
    ...customWorkTypes,
  ];

  // 1. Subscribe to Work Types
  useEffect(() => {
    if (isConfigured && db) {
      const q = query(collection(db, 'workTypes'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const types: WorkTypeItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name,
              uom: data.uom,
              isCustom: true,
              createdBy: data.createdBy,
              createdAt: data.createdAt,
            };
          });
          setCustomWorkTypes(types);
        },
        (error) => {
          console.debug('Firestore workTypes listener notice (using local storage):', error);
          const savedTypes = localStorage.getItem(LOCAL_CUSTOM_WORKTYPES_KEY);
          if (savedTypes) {
            try {
              setCustomWorkTypes(JSON.parse(savedTypes));
            } catch (e) {
              console.error(e);
            }
          }
        }
      );
      return () => unsubscribe();
    } else {
      const savedTypes = localStorage.getItem(LOCAL_CUSTOM_WORKTYPES_KEY);
      if (savedTypes) {
        try {
          setCustomWorkTypes(JSON.parse(savedTypes));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [isConfigured]);

  // 2. Subscribe to Entries
  useEffect(() => {
    const hasActiveFirebaseAuth = Boolean(isConfigured && db && auth?.currentUser);

    if (hasActiveFirebaseAuth) {
      setLoading(true);
      const entriesRef = collection(db, 'entries');
      const q = query(entriesRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: WorkEntry[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              uid: data.uid,
              userName: data.userName || 'Field Worker',
              workType: data.workType,
              uom: data.uom || 'meter',
              quantity: Number(data.quantity) || 0,
              status: data.status || 'Pending',
              locationFrom: data.locationFrom || '',
              locationTo: data.locationTo || '',
              remark: data.remark || '',
              photos: data.photos || [],
              createdAt: data.createdAt || { toDate: () => new Date() },
              updatedAt: data.updatedAt,
            };
          });
          setEntries(items);
          setLoading(false);
        },
        (error) => {
          console.debug('Firestore entries listener notice (using local storage):', error);
          loadLocalEntries();
        }
      );

      return () => unsubscribe();
    } else {
      loadLocalEntries();
    }

    function loadLocalEntries() {
      const saved = localStorage.getItem(LOCAL_ENTRIES_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const items = parsed.map((e: any) => ({
            ...e,
            createdAt: {
              toDate: () => (e.createdDate ? new Date(e.createdDate) : new Date()),
            },
          }));
          setEntries(items);
        } catch {
          setEntries(INITIAL_DEMO_ENTRIES);
        }
      } else {
        setEntries(INITIAL_DEMO_ENTRIES);
      }
      setLoading(false);
    }
  }, [isConfigured, user]);

  // Add new custom work type
  const addWorkType = async (name: string, uom: UOMType) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const hasActiveFirebaseAuth = Boolean(isConfigured && db && auth?.currentUser);

    if (hasActiveFirebaseAuth) {
      const path = 'workTypes';
      try {
        await addDoc(collection(db, path), {
          name: trimmedName,
          uom,
          createdBy: userProfile?.name || auth.currentUser?.displayName || 'Worker',
          creatorUid: auth.currentUser!.uid,
          createdAt: serverTimestamp(),
        });
        return;
      } catch (err) {
        console.debug('Firestore addWorkType note (saving to local):', err);
      }
    }

    const newType: WorkTypeItem = {
      id: 'wt_' + Date.now(),
      name: trimmedName,
      uom,
      isCustom: true,
      createdBy: userProfile?.name || 'Worker',
    };
    const updated = [newType, ...customWorkTypes];
    setCustomWorkTypes(updated);
    localStorage.setItem(LOCAL_CUSTOM_WORKTYPES_KEY, JSON.stringify(updated));
  };

  // Create work entry
  const createEntry = async (entryData: {
    workType: string;
    uom: UOMType;
    quantity: number;
    status: EntryStatus;
    locationFrom: string;
    locationTo: string;
    remark?: string;
    photos?: string[];
  }): Promise<string> => {
    const hasActiveFirebaseAuth = Boolean(isConfigured && db && auth?.currentUser);
    const workerUid = hasActiveFirebaseAuth
      ? auth.currentUser!.uid
      : user?.uid || userProfile?.uid || 'temp_worker';
    const workerName = userProfile?.name || user?.displayName || (hasActiveFirebaseAuth ? auth.currentUser?.displayName : null) || 'Field Worker';
    const photosList = (entryData.photos || []).slice(0, 4);

    if (hasActiveFirebaseAuth) {
      const path = 'entries';
      try {
        const docRef = await addDoc(collection(db, path), {
          uid: workerUid,
          userName: workerName,
          workType: entryData.workType,
          uom: entryData.uom,
          quantity: Number(entryData.quantity),
          status: entryData.status,
          locationFrom: entryData.locationFrom.trim(),
          locationTo: entryData.locationTo.trim(),
          remark: (entryData.remark || '').trim(),
          photos: photosList,
          createdAt: serverTimestamp(),
        });
        return docRef.id;
      } catch (err) {
        console.debug('Firestore createEntry note (saving to offline/local session):', err);
      }
    }

    // Local / Offline session store
    const newId = 'entry_' + Date.now().toString(36);
    const newEntry: WorkEntry = {
      id: newId,
      uid: workerUid,
      userName: workerName,
      workType: entryData.workType,
      uom: entryData.uom,
      quantity: Number(entryData.quantity),
      status: entryData.status,
      locationFrom: entryData.locationFrom.trim(),
      locationTo: entryData.locationTo.trim(),
      remark: (entryData.remark || '').trim(),
      photos: photosList,
      createdAt: { toDate: () => new Date() },
    };

    const updated = [newEntry, ...entries];
    setEntries(updated);

    const storable = updated.map((e) => ({
      ...e,
      createdDate: e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : new Date().toISOString(),
    }));
    localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(storable));
    return newId;
  };

  // Update entry
  const updateEntry = async (id: string, entryData: Partial<WorkEntry>) => {
    const hasActiveFirebaseAuth = Boolean(isConfigured && db && auth?.currentUser);

    if (hasActiveFirebaseAuth && !id.startsWith('entry_') && !id.startsWith('demo_')) {
      const path = `entries/${id}`;
      try {
        const updatePayload: any = {
          ...entryData,
          updatedAt: serverTimestamp(),
        };
        // Don't allow changing uid or userName
        delete updatePayload.uid;
        delete updatePayload.userName;
        delete updatePayload.id;

        await updateDoc(doc(db, 'entries', id), updatePayload);
      } catch (err) {
        console.debug('Firestore updateEntry note:', err);
      }
    }

    const updated = entries.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...entryData,
          updatedAt: { toDate: () => new Date() },
        };
      }
      return item;
    });
    setEntries(updated);
    const storable = updated.map((e) => ({
      ...e,
      createdDate: e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : new Date().toISOString(),
    }));
    localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(storable));
  };

  // Delete entry
  const deleteEntry = async (id: string) => {
    const hasActiveFirebaseAuth = Boolean(isConfigured && db && auth?.currentUser);

    if (hasActiveFirebaseAuth && !id.startsWith('entry_') && !id.startsWith('demo_')) {
      const path = `entries/${id}`;
      try {
        await deleteDoc(doc(db, 'entries', id));
      } catch (err) {
        console.debug('Firestore deleteEntry note:', err);
      }
    }

    const updated = entries.filter((item) => item.id !== id);
    setEntries(updated);
    const storable = updated.map((e) => ({
      ...e,
      createdDate: e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : new Date().toISOString(),
    }));
    localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(storable));
  };

  // Filter entries for the current user (Field Worker view)
  const currentUid = user?.uid || userProfile?.uid;
  const myEntries = entries.filter((e) => e.uid === currentUid);

  return (
    <WorkDataContext.Provider
      value={{
        workTypes,
        entries,
        myEntries,
        loading,
        addWorkType,
        createEntry,
        updateEntry,
        deleteEntry,
      }}
    >
      {children}
    </WorkDataContext.Provider>
  );
};

export const useWorkData = (): WorkDataContextType => {
  const context = useContext(WorkDataContext);
  if (!context) {
    throw new Error('useWorkData must be used within a WorkDataProvider');
  }
  return context;
};
