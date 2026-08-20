import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { WorkEntry, WorkTypeItem, PRESET_WORK_TYPES, EntryStatus, UOMType } from '../types';
import { supabaseDb, isSupabaseConfigured, getSupabaseClient } from '../lib/supabase';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

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
  refreshData: () => Promise<void>;
}

const WorkDataContext = createContext<WorkDataContextType | undefined>(undefined);

const LOCAL_ENTRIES_KEY = 'civil_site_entries_data';
const LOCAL_CUSTOM_WORKTYPES_KEY = 'civil_site_custom_worktypes';

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
  const { userProfile } = useAuth();
  const [customWorkTypes, setCustomWorkTypes] = useState<WorkTypeItem[]>([]);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const isSupabase = isSupabaseConfigured();
  const isFirebase = isFirebaseConfigured() && Boolean(db);

  const workTypes: WorkTypeItem[] = [
    ...PRESET_WORK_TYPES.map((p) => ({ ...p, isCustom: false })),
    ...customWorkTypes,
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. If Supabase configured, load from Supabase
      if (isSupabase) {
        const [sbEntries, sbWorkTypes] = await Promise.all([
          supabaseDb.getWorkEntries(),
          supabaseDb.getWorkTypes(),
        ]);
        if (sbEntries.length > 0) {
          setEntries(sbEntries);
        } else {
          // Fallback to demo entries if Supabase table is fresh/empty
          const localSaved = localStorage.getItem(LOCAL_ENTRIES_KEY);
          setEntries(localSaved ? JSON.parse(localSaved) : INITIAL_DEMO_ENTRIES);
        }
        if (sbWorkTypes.length > 0) {
          setCustomWorkTypes(sbWorkTypes);
        }
        setLoading(false);
        return;
      }

      // 2. Local Storage
      const savedEntries = localStorage.getItem(LOCAL_ENTRIES_KEY);
      if (savedEntries) {
        try {
          const parsed = JSON.parse(savedEntries);
          setEntries(
            parsed.map((item: any) => ({
              ...item,
              createdAt: { toDate: () => new Date(item.createdAtDate || Date.now()) },
            }))
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
    } catch (err) {
      console.warn('Error loading work data:', err);
    } finally {
      setLoading(false);
    }
  }, [isSupabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    const uid = userProfile?.uid || 'user_guest';
    const userName = userProfile?.name || 'Field Worker';

    if (isSupabase) {
      const id = await supabaseDb.addWorkEntry({
        uid,
        userName,
        ...entryData,
      });
      if (id) {
        await loadData();
        return id;
      }
    }

    // Local Fallback
    const id = 'entry_' + Date.now();
    const newEntry: WorkEntry = {
      id,
      uid,
      userName,
      ...entryData,
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

  const myEntries = entries.filter((e) => e.uid === userProfile?.uid);

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
