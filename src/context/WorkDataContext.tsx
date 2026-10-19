import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { WorkEntry, WorkTypeItem, PRESET_WORK_TYPES, EntryStatus, UOMType, UserProfile, UserRole } from '../types';
import { supabaseDb, isSupabaseConfigured, getSupabaseClient } from '../lib/supabase';
import { auth, db, isFirebaseConfigured, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

export function parseWorkEntryDate(raw: any, fallbackDateStr?: string): { toDate: () => Date; isoString: string } {
  let d: Date | null = null;
  if (raw) {
    if (typeof raw.toDate === 'function') {
      try {
        d = raw.toDate();
      } catch {}
    } else if (raw instanceof Date) {
      d = raw;
    } else if (typeof raw === 'string' || typeof raw === 'number') {
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
  }

  if (!d && fallbackDateStr) {
    const [y, m, day] = fallbackDateStr.split('-').map(Number);
    if (y && m && day) {
      d = new Date(y, m - 1, day);
    } else {
      const parsed = new Date(fallbackDateStr);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
  }

  if (!d || isNaN(d.getTime())) {
    d = new Date();
  }

  return {
    toDate: () => d!,
    isoString: d.toISOString(),
  };
}

interface WorkDataContextType {
  workTypes: WorkTypeItem[];
  entries: WorkEntry[];
  myEntries: WorkEntry[];
  teamWorkers: UserProfile[];
  loading: boolean;
  addWorkType: (name: string, uom: UOMType) => Promise<void>;
  addWorker: (worker: { name: string; email?: string; role?: UserRole }) => Promise<UserProfile>;
  createEntry: (entryData: {
    workType?: string;
    uom?: UOMType;
    quantity?: number;
    status: EntryStatus;
    route?: string;
    location?: string;
    latLong?: string;
    locationFrom?: string;
    locationTo?: string;
    remark?: string;
    photos?: string[];
    date?: string;
  }) => Promise<string>;
  updateEntry: (id: string, entryData: Partial<WorkEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const WorkDataContext = createContext<WorkDataContextType | undefined>(undefined);

const LOCAL_ENTRIES_KEY = 'civil_site_entries_data';
const LOCAL_CUSTOM_WORKTYPES_KEY = 'civil_site_custom_worktypes';
const LOCAL_USERS_DB_KEY = 'civil_site_users_db';

const INITIAL_DEMO_WORKERS: UserProfile[] = [
  { uid: 'demo_worker_1', name: 'Rajesh Kumar', email: 'rajesh.kumar@civilsite.work', role: 'Field Executive' },
  { uid: 'demo_worker_2', name: 'Amit Sharma', email: 'amit.sharma@civilsite.work', role: 'Field Executive' },
  { uid: 'demo_worker_3', name: 'Suresh Patel', email: 'suresh.patel@civilsite.work', role: 'Field Executive' },
  { uid: 'demo_worker_4', name: 'Vikram Singh', email: 'vikram.singh@civilsite.work', role: 'Field Executive' },
];

const INITIAL_DEMO_ENTRIES: WorkEntry[] = [
  {
    id: 'demo_entry_1',
    uid: 'demo_worker_1',
    userName: 'Rajesh Kumar',
    workType: 'Trenching',
    uom: 'meter',
    quantity: 145,
    status: 'Done',
    route: 'Sector 14 Junction Route',
    location: 'Sector 14 Junction, North Road',
    locationFrom: 'Sector 14 Junction, North Road',
    locationTo: 'Main Substation Gate #2',
    remark: 'Excavated 1.2m depth trench with safety barricades installed.',
    date: new Date().toLocaleDateString('en-CA'),
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
    route: 'Station Road OFC Backbone',
    location: 'Manhole MH-42 (Station Road)',
    locationFrom: 'Manhole MH-42 (Station Road)',
    locationTo: 'Optical Hub Node 7',
    remark: 'Waiting for HDPE coupler delivery to finish joining.',
    date: new Date().toLocaleDateString('en-CA'),
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
    route: 'Crossroad Sector 9 Route',
    location: 'Crossroad Sector 9',
    locationFrom: 'Crossroad Sector 9',
    locationTo: 'Plot 104 Boundary Wall',
    remark: 'Reinforced concrete handholes placed and leveled.',
    date: new Date().toLocaleDateString('en-CA'),
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
    route: 'Feeder Point FP-03 Line',
    location: 'Feeder Point FP-03',
    locationFrom: 'Feeder Point FP-03',
    locationTo: 'Distribution Box DB-12',
    remark: '48F OFC blown smoothly with air compressor.',
    date: new Date().toLocaleDateString('en-CA'),
    createdAt: { toDate: () => new Date(Date.now() - 3600000 * 8) },
  },
  {
    id: 'demo_entry_5',
    uid: 'demo_worker_4',
    userName: 'Vikram Singh',
    workType: 'Cable pulling',
    uom: 'meter',
    quantity: 210,
    status: 'Done',
    route: 'Node Alpha-1 Section',
    location: 'Node Alpha-1',
    locationFrom: 'Node Alpha-1',
    locationTo: 'Node Bravo-4',
    remark: 'Manual cable pull completed through 40mm duct.',
    date: new Date().toLocaleDateString('en-CA'),
    createdAt: { toDate: () => new Date(Date.now() - 3600000 * 12) },
  },
];

export const WorkDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, user } = useAuth();
  const [customWorkTypes, setCustomWorkTypes] = useState<WorkTypeItem[]>([]);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>(INITIAL_DEMO_WORKERS);
  const [loading, setLoading] = useState<boolean>(true);

  const isSupabase = isSupabaseConfigured();
  const isFirebase = isFirebaseConfigured() && Boolean(db);

  const workTypes: WorkTypeItem[] = useMemo(() => [
    ...PRESET_WORK_TYPES.map((p) => ({ ...p, isCustom: false })),
    ...customWorkTypes,
  ], [customWorkTypes]);

  // Aggregate all unique workers from registered users, submitted entries, and current user
  const teamWorkers = useMemo(() => {
    const map = new Map<string, UserProfile>();

    // 1. Check if we have real registered users from Firestore
    const realUsers = registeredUsers.filter((u) => !u.uid.startsWith('demo_'));
    const hasRealUsers = realUsers.length > 0;

    if (hasRealUsers) {
      // Prioritize real site team workers from database (e.g. Ganesh Kumbhar, Prashant Gamre)
      realUsers.forEach((u) => {
        if (u.name && u.name.trim()) {
          map.set(u.name.trim().toLowerCase(), u);
        }
      });
    } else {
      // Only seed with demo workers if database has zero real workers registered
      INITIAL_DEMO_WORKERS.forEach((w) => map.set(w.name.trim().toLowerCase(), w));
    }

    // 2. Add any worker who has submitted entries
    entries.forEach((e) => {
      if (e.userName && e.userName.trim()) {
        const cleanName = e.userName.trim();
        const key = cleanName.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            uid: e.uid || 'worker_' + key,
            name: cleanName,
            email: `${cleanName.toLowerCase().replace(/\s+/g, '.')}@site.work`,
            role: 'Field Worker',
          });
        }
      }
    });

    // 3. Ensure current logged-in user is in the list
    if (userProfile?.name && userProfile.name.trim()) {
      const cleanName = userProfile.name.trim();
      const key = cleanName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, userProfile);
      }
    }

    return Array.from(map.values());
  }, [registeredUsers, entries, userProfile]);

  // Real-time Firestore synchronization
  useEffect(() => {
    if (!isFirebase || !db) return;

    if (!auth?.currentUser) {
      const localSaved = localStorage.getItem(LOCAL_ENTRIES_KEY);
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved);
          setEntries(
            parsed.map((item: any) => {
              const dateHelper = parseWorkEntryDate(item.createdAt || item.createdAtDate, item.date);
              return {
                ...item,
                createdAt: { toDate: dateHelper.toDate },
              };
            })
          );
        } catch {
          setEntries(INITIAL_DEMO_ENTRIES);
        }
      } else {
        setEntries(INITIAL_DEMO_ENTRIES);
      }
      setLoading(false);
      return;
    }

    let unsubscribeEntries = () => {};
    let unsubscribeTypes = () => {};
    let unsubscribeUsers = () => {};

    try {
      // 1. Entries Collection Listener (Query all entries; sort in JS so missing/null createdAt is never omitted)
      const entriesQuery = query(collection(db, 'entries'));
      unsubscribeEntries = onSnapshot(
        entriesQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: WorkEntry[] = snapshot.docs.map((docSnap) => {
              const data = docSnap.data();
              const dateHelper = parseWorkEntryDate(data.createdAt || data.createdAtDate, data.date);
              return {
                id: docSnap.id,
                uid: data.uid || '',
                userName: data.userName || 'Field Worker',
                workType: data.workType || data.route || 'Site Work',
                uom: data.uom || 'meter',
                quantity: Number(data.quantity) || 1,
                status: (data.status as EntryStatus) || 'Done',
                route: data.route || '',
                location: data.location || data.locationFrom || '',
                latLong: data.latLong || '',
                locationFrom: data.locationFrom || data.location || '',
                locationTo: data.locationTo || '',
                remark: data.remark || '',
                photos: data.photos || [],
                date: data.date,
                createdAt: { toDate: dateHelper.toDate },
                updatedAt: data.updatedAt,
              };
            });

            // Sort newest first by date/createdAt
            list.sort((a, b) => {
              const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
              const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
              return timeB - timeA;
            });

            setEntries(list);
          } else {
            // Firestore is live and empty: no worker submissions yet
            setEntries([]);
          }
          setLoading(false);
        },
        (error) => {
          console.warn('Firestore entries snapshot notice, using local cache:', error.message);
          const saved = localStorage.getItem(LOCAL_ENTRIES_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              setEntries(
                parsed.map((item: any) => {
                  const dateHelper = parseWorkEntryDate(item.createdAt || item.createdAtDate, item.date);
                  return {
                    ...item,
                    createdAt: { toDate: dateHelper.toDate },
                  };
                })
              );
            } catch {
              setEntries(INITIAL_DEMO_ENTRIES);
            }
          } else {
            setEntries(INITIAL_DEMO_ENTRIES);
          }
          setLoading(false);
        }
      );

      // 2. Custom Work Types Listener
      const typesQuery = query(collection(db, 'workTypes'));
      unsubscribeTypes = onSnapshot(
        typesQuery,
        (snapshot) => {
          const list: WorkTypeItem[] = snapshot.docs.map((docSnap) => {
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
          setCustomWorkTypes(list);
        },
        (err) => {
          console.warn('Firestore workTypes snapshot notice:', err.message);
        }
      );

      // 3. Users Collection Listener
      const usersQuery = query(collection(db, 'users'));
      unsubscribeUsers = onSnapshot(
        usersQuery,
        (snapshot) => {
          const userList: UserProfile[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              uid: docSnap.id,
              name: data.name || 'User',
              email: data.email || '',
              role: data.role || 'Field Worker',
              createdAt: data.createdAt,
            };
          });
          if (userList.length > 0) {
            setRegisteredUsers(userList);
          }
        },
        (err) => {
          console.warn('Firestore users snapshot notice:', err.message);
        }
      );
    } catch (err) {
      console.warn('Firestore setup listener exception:', err);
      setLoading(false);
    }

    return () => {
      unsubscribeEntries();
      unsubscribeTypes();
      unsubscribeUsers();
    };
  }, [isFirebase, user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. If Firebase is active and user is signed in, force refresh Firestore collections
      if (isFirebase && db && auth?.currentUser) {
        try {
          const [entriesSnap, usersSnap] = await Promise.all([
            getDocs(collection(db, 'entries')),
            getDocs(collection(db, 'users')),
          ]);

          if (!entriesSnap.empty) {
            const list: WorkEntry[] = entriesSnap.docs.map((docSnap) => {
              const data = docSnap.data();
              const dateHelper = parseWorkEntryDate(data.createdAt || data.createdAtDate, data.date);
              return {
                id: docSnap.id,
                uid: data.uid || '',
                userName: data.userName || 'Field Worker',
                workType: data.workType || data.route || 'Site Work',
                uom: data.uom || 'meter',
                quantity: Number(data.quantity) || 1,
                status: (data.status as EntryStatus) || 'Done',
                route: data.route || '',
                location: data.location || data.locationFrom || '',
                latLong: data.latLong || '',
                locationFrom: data.locationFrom || data.location || '',
                locationTo: data.locationTo || '',
                remark: data.remark || '',
                photos: data.photos || [],
                date: data.date,
                createdAt: { toDate: dateHelper.toDate },
                updatedAt: data.updatedAt,
              };
            });

            list.sort((a, b) => {
              const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
              const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
              return timeB - timeA;
            });

            setEntries(list);
          } else {
            setEntries([]);
          }

          if (!usersSnap.empty) {
            const userList: UserProfile[] = usersSnap.docs.map((docSnap) => {
              const data = docSnap.data();
              return {
                uid: docSnap.id,
                name: data.name || 'User',
                email: data.email || '',
                role: data.role || 'Field Worker',
                createdAt: data.createdAt,
              };
            });
            setRegisteredUsers(userList);
          }
          setLoading(false);
          return;
        } catch (fbErr) {
          console.warn('Manual Firestore fetch fallback to local storage:', fbErr);
        }
      }

      // 2. If Supabase configured, load from Supabase
      if (isSupabase) {
        const [sbEntries, sbWorkTypes] = await Promise.all([
          supabaseDb.getWorkEntries(),
          supabaseDb.getWorkTypes(),
        ]);
        if (sbEntries.length > 0) {
          setEntries(sbEntries);
        } else {
          const localSaved = localStorage.getItem(LOCAL_ENTRIES_KEY);
          if (localSaved) {
            try {
              const parsed = JSON.parse(localSaved);
              setEntries(
                parsed.map((item: any) => {
                  const dateHelper = parseWorkEntryDate(item.createdAt || item.createdAtDate, item.date);
                  return { ...item, createdAt: { toDate: dateHelper.toDate } };
                })
              );
            } catch {
              setEntries(INITIAL_DEMO_ENTRIES);
            }
          } else {
            setEntries(INITIAL_DEMO_ENTRIES);
          }
        }
        if (sbWorkTypes.length > 0) {
          setCustomWorkTypes(sbWorkTypes);
        }
        setLoading(false);
        return;
      }

      // 3. Local Storage Fallback
      const savedEntries = localStorage.getItem(LOCAL_ENTRIES_KEY);
      if (savedEntries) {
        try {
          const parsed = JSON.parse(savedEntries);
          setEntries(
            parsed.map((item: any) => {
              const dateHelper = parseWorkEntryDate(item.createdAt || item.createdAtDate, item.date);
              return {
                ...item,
                createdAt: { toDate: dateHelper.toDate },
              };
            })
          );
        } catch {
          setEntries(INITIAL_DEMO_ENTRIES);
        }
      } else {
        setEntries(INITIAL_DEMO_ENTRIES);
      }

      const savedCustomTypes = localStorage.getItem(LOCAL_CUSTOM_WORKTYPES_KEY);
      if (savedCustomTypes) {
        try {
          setCustomWorkTypes(JSON.parse(savedCustomTypes));
        } catch {}
      }

      const savedUsersDb = localStorage.getItem(LOCAL_USERS_DB_KEY);
      if (savedUsersDb) {
        try {
          const parsed = JSON.parse(savedUsersDb);
          setRegisteredUsers(Object.values(parsed));
        } catch {}
      }
    } catch (err) {
      console.warn('Error loading work data:', err);
    } finally {
      setLoading(false);
    }
  }, [isFirebase, isSupabase]);

  useEffect(() => {
    if (!isFirebase) {
      loadData();
    }
  }, [isFirebase, loadData]);

  // Real-time listener for Supabase
  useEffect(() => {
    if (!isSupabase) return;
    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel('work_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_entries' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [isSupabase, loadData]);

  const addWorkType = async (name: string, uom: UOMType) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (workTypes.some((wt) => wt.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error(`Work type "${trimmedName}" already exists.`);
    }

    const hasAuth = Boolean(isFirebase && db && auth?.currentUser);

    if (hasAuth && db && auth?.currentUser) {
      try {
        await addDoc(collection(db, 'workTypes'), {
          name: trimmedName,
          uom,
          createdBy: auth.currentUser.displayName || userProfile?.name || 'Field Worker',
          creatorUid: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        });
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'workTypes');
      }
    }

    if (isSupabase) {
      const added = await supabaseDb.addWorkType({
        name: trimmedName,
        uom,
        createdBy: userProfile?.name || 'Field User',
      });
      if (added) {
        setCustomWorkTypes((prev) => [added, ...prev]);
        return;
      }
    }

    // Local fallback
    const newItem: WorkTypeItem = {
      id: 'custom_' + Date.now(),
      name: trimmedName,
      uom,
      isCustom: true,
      createdBy: userProfile?.name || 'Local User',
    };
    const updated = [newItem, ...customWorkTypes];
    setCustomWorkTypes(updated);
    localStorage.setItem(LOCAL_CUSTOM_WORKTYPES_KEY, JSON.stringify(updated));
  };

  const addWorker = async (worker: { name: string; email?: string; role?: UserRole }): Promise<UserProfile> => {
    const trimmedName = worker.name.trim();
    if (!trimmedName) throw new Error('Worker name cannot be empty');

    const uid = 'worker_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newWorker: UserProfile = {
      uid,
      name: trimmedName,
      email: worker.email?.trim() || `${trimmedName.toLowerCase().replace(/\s+/g, '.')}@site.work`,
      role: worker.role || 'Field Executive',
      createdAt: new Date().toISOString(),
    };

    // 1. If Firebase is active and user is signed in
    if (isFirebase && db && auth?.currentUser) {
      try {
        await setDoc(doc(db, 'users', uid), {
          name: newWorker.name,
          email: newWorker.email,
          role: newWorker.role,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Could not save worker to Firestore users collection:', err);
      }
    }

    // 2. Supabase
    if (isSupabase) {
      await supabaseDb.upsertProfile(newWorker).catch(() => {});
    }

    // 3. Local database
    try {
      const localUsers = JSON.parse(localStorage.getItem(LOCAL_USERS_DB_KEY) || '{}');
      localUsers[uid] = newWorker;
      localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(localUsers));
    } catch {}

    setRegisteredUsers((prev) => {
      const exists = prev.some((w) => w.name.toLowerCase() === trimmedName.toLowerCase());
      return exists ? prev : [newWorker, ...prev];
    });

    return newWorker;
  };

  const createEntry = async (entryData: {
    workType?: string;
    uom?: UOMType;
    quantity?: number;
    status: EntryStatus;
    route?: string;
    location?: string;
    latLong?: string;
    locationFrom?: string;
    locationTo?: string;
    remark?: string;
    photos?: string[];
    date?: string;
  }): Promise<string> => {
    const hasAuth = Boolean(isFirebase && db && auth?.currentUser);
    const uid = hasAuth && auth?.currentUser ? auth.currentUser.uid : (userProfile?.uid || 'user_worker');

    // Prefer explicit logged-in profile name
    const resolvedName = (userProfile?.name && userProfile.name.trim() !== 'Field Worker' && userProfile.name.trim() !== '')
      ? userProfile.name.trim()
      : ((auth?.currentUser?.displayName && auth.currentUser.displayName.trim() !== '')
        ? auth.currentUser.displayName.trim()
        : (userProfile?.name?.trim() || 'Field Worker'));

    const todayDate = new Date().toLocaleDateString('en-CA');

    const payload = {
      uid,
      userName: resolvedName,
      workType: entryData.workType || entryData.route || 'Site Work',
      uom: entryData.uom || 'meter',
      quantity: entryData.quantity !== undefined ? Number(entryData.quantity) : 1,
      status: entryData.status,
      route: entryData.route || '',
      location: entryData.location || entryData.locationFrom || '',
      latLong: entryData.latLong || '',
      locationFrom: entryData.locationFrom || entryData.location || '',
      locationTo: entryData.locationTo || '',
      remark: entryData.remark || '',
      photos: entryData.photos || [],
      date: entryData.date || todayDate,
    };

    if (hasAuth && db) {
      try {
        const docRef = await addDoc(collection(db, 'entries'), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return docRef.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'entries');
      }
    }

    if (isSupabase) {
      const id = await supabaseDb.addWorkEntry(payload);
      if (id) {
        await loadData();
        return id;
      }
    }

    // Local Fallback (used when unauthenticated, offline or in guest mode)
    const id = 'entry_' + Date.now();
    const newEntry: WorkEntry = {
      id,
      ...payload,
      createdAt: { toDate: () => new Date() },
    };

    const updated = [newEntry, ...entries];
    setEntries(updated);
    localStorage.setItem(
      LOCAL_ENTRIES_KEY,
      JSON.stringify(
        updated.map((e) => ({
          ...e,
          createdAtDate: e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : new Date().toISOString(),
        }))
      )
    );
    return id;
  };

  const updateEntry = async (id: string, entryData: Partial<WorkEntry>) => {
    const hasAuth = Boolean(isFirebase && db && auth?.currentUser);
    if (hasAuth && db && !id.startsWith('demo_') && !id.startsWith('entry_')) {
      try {
        const cleanPayload: any = { updatedAt: serverTimestamp() };
        if (entryData.workType !== undefined) cleanPayload.workType = entryData.workType;
        if (entryData.uom !== undefined) cleanPayload.uom = entryData.uom;
        if (entryData.quantity !== undefined) cleanPayload.quantity = Number(entryData.quantity);
        if (entryData.status !== undefined) cleanPayload.status = entryData.status;
        if (entryData.route !== undefined) cleanPayload.route = entryData.route;
        if (entryData.location !== undefined) cleanPayload.location = entryData.location;
        if (entryData.latLong !== undefined) cleanPayload.latLong = entryData.latLong;
        if (entryData.locationFrom !== undefined) cleanPayload.locationFrom = entryData.locationFrom;
        if (entryData.locationTo !== undefined) cleanPayload.locationTo = entryData.locationTo;
        if (entryData.remark !== undefined) cleanPayload.remark = entryData.remark;
        if (entryData.photos !== undefined) cleanPayload.photos = entryData.photos;
        if (entryData.date !== undefined) cleanPayload.date = entryData.date;

        await updateDoc(doc(db, 'entries', id), cleanPayload);
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `entries/${id}`);
      }
    }

    if (isSupabase) {
      const ok = await supabaseDb.updateWorkEntry(id, entryData);
      if (ok) {
        await loadData();
        return;
      }
    }

    // Local Fallback
    const updated = entries.map((e) => (e.id === id ? { ...e, ...entryData } : e));
    setEntries(updated);
    localStorage.setItem(
      LOCAL_ENTRIES_KEY,
      JSON.stringify(
        updated.map((e) => ({
          ...e,
          createdAtDate: e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : new Date().toISOString(),
        }))
      )
    );
  };

  const deleteEntry = async (id: string) => {
    const hasAuth = Boolean(isFirebase && db && auth?.currentUser);
    if (hasAuth && db && !id.startsWith('demo_') && !id.startsWith('entry_')) {
      try {
        await deleteDoc(doc(db, 'entries', id));
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `entries/${id}`);
      }
    }

    if (isSupabase) {
      const ok = await supabaseDb.deleteWorkEntry(id);
      if (ok) {
        await loadData();
        return;
      }
    }

    // Local Fallback
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    localStorage.setItem(
      LOCAL_ENTRIES_KEY,
      JSON.stringify(
        updated.map((e) => ({
          ...e,
          createdAtDate: e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : new Date().toISOString(),
        }))
      )
    );
  };

  // Matches worker by UID or Name so logs are never hidden from field worker
  const myEntries = useMemo(() => {
    const currentUid = userProfile?.uid || auth?.currentUser?.uid;
    const currentName = userProfile?.name?.trim().toLowerCase() || auth?.currentUser?.displayName?.trim().toLowerCase();

    return entries.filter((e) => {
      if (currentUid && e.uid === currentUid) return true;
      if (currentName && e.userName && e.userName.trim().toLowerCase() === currentName) return true;
      return false;
    });
  }, [entries, userProfile, auth?.currentUser]);

  return (
    <WorkDataContext.Provider
      value={{
        workTypes,
        entries,
        myEntries,
        teamWorkers,
        loading,
        addWorkType,
        addWorker,
        createEntry,
        updateEntry,
        deleteEntry,
        refreshData: loadData,
      }}
    >
      {children}
    </WorkDataContext.Provider>
  );
};

export const useWorkData = () => {
  const context = useContext(WorkDataContext);
  if (!context) throw new Error('useWorkData must be used within a WorkDataProvider');
  return context;
};
