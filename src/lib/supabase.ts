import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile, UserRole, WorkEntry, WorkTypeItem, UOMType, EntryStatus } from '../types';

const STORAGE_SUPABASE_URL_KEY = 'civil_site_supabase_url';
const STORAGE_SUPABASE_KEY_KEY = 'civil_site_supabase_anon_key';

export const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_SUPABASE_URL_KEY) : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_SUPABASE_KEY_KEY) : null;

  const url = (localUrl || envUrl || '').trim();
  const anonKey = (localKey || envKey || '').trim();

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey && url.startsWith('http') && anonKey.length > 10),
  };
};

export const saveSupabaseConfig = (url: string, anonKey: string) => {
  if (typeof window !== 'undefined') {
    if (url && anonKey) {
      localStorage.setItem(STORAGE_SUPABASE_URL_KEY, url.trim());
      localStorage.setItem(STORAGE_SUPABASE_KEY_KEY, anonKey.trim());
    } else {
      localStorage.removeItem(STORAGE_SUPABASE_URL_KEY);
      localStorage.removeItem(STORAGE_SUPABASE_KEY_KEY);
    }
  }
  // Reinitialize client
  supabaseInstance = null;
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  const config = getSupabaseConfig();
  if (config.isConfigured) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      return supabaseInstance;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return null;
};

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseConfig().isConfigured;
};

// SQL Schema generator for users to copy into Supabase SQL Editor
export const SUPABASE_SETUP_SQL = `-- 1. Create Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Field Worker',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Custom Work Types Table
CREATE TABLE IF NOT EXISTS public.work_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  uom TEXT NOT NULL CHECK (uom IN ('meter', 'Number')),
  is_custom BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Daily Site Work Entries Table
CREATE TABLE IF NOT EXISTS public.work_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  work_type TEXT NOT NULL,
  uom TEXT NOT NULL CHECK (uom IN ('meter', 'Number')),
  quantity NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Done')),
  location_from TEXT NOT NULL,
  location_to TEXT NOT NULL,
  remark TEXT,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_entries ENABLE ROW LEVEL SECURITY;

-- 5. Create Permissive Policies for Field Work App
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Work types are viewable by all users" ON public.work_types;
CREATE POLICY "Work types are viewable by all users" ON public.work_types FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert work types" ON public.work_types;
CREATE POLICY "Authenticated users can insert work types" ON public.work_types FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Work entries are viewable by all authenticated team members" ON public.work_entries;
CREATE POLICY "Work entries are viewable by all authenticated team members" ON public.work_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Team members can insert work entries" ON public.work_entries;
CREATE POLICY "Team members can insert work entries" ON public.work_entries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Team members can update work entries" ON public.work_entries;
CREATE POLICY "Team members can update work entries" ON public.work_entries FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Team members can delete work entries" ON public.work_entries;
CREATE POLICY "Team members can delete work entries" ON public.work_entries FOR DELETE USING (true);
`;

// Helper methods for Supabase Database operations
export const supabaseDb = {
  // Profiles
  async getProfile(uid: string): Promise<UserProfile | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        console.warn('Supabase getProfile error:', error.message);
        return null;
      }
      if (!data) return null;
      return {
        uid: data.id,
        name: data.name,
        email: data.email,
        role: data.role as UserRole,
        createdAt: data.created_at,
      };
    } catch (err) {
      console.warn('Supabase getProfile exception:', err);
      return null;
    }
  },

  async upsertProfile(profile: UserProfile): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('profiles').upsert(
        {
          id: profile.uid,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (error) {
        console.warn('Supabase upsertProfile error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Supabase upsertProfile exception:', err);
      return false;
    }
  },

  // Work Types
  async getWorkTypes(): Promise<WorkTypeItem[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('work_types')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase getWorkTypes error:', error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        uom: row.uom as UOMType,
        isCustom: row.is_custom ?? true,
        createdBy: row.created_by,
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.warn('Supabase getWorkTypes exception:', err);
      return [];
    }
  },

  async addWorkType(item: { name: string; uom: UOMType; createdBy?: string }): Promise<WorkTypeItem | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('work_types')
        .insert({
          name: item.name,
          uom: item.uom,
          is_custom: true,
          created_by: item.createdBy || 'Field User',
        })
        .select()
        .single();

      if (error) {
        console.warn('Supabase addWorkType error:', error.message);
        return null;
      }
      return {
        id: data.id,
        name: data.name,
        uom: data.uom as UOMType,
        isCustom: true,
        createdBy: data.created_by,
        createdAt: data.created_at,
      };
    } catch (err) {
      console.warn('Supabase addWorkType exception:', err);
      return null;
    }
  },

  // Work Entries
  async getWorkEntries(): Promise<WorkEntry[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('work_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase getWorkEntries error:', error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        uid: row.user_id,
        userName: row.user_name,
        workType: row.work_type,
        uom: row.uom as UOMType,
        quantity: Number(row.quantity),
        status: row.status as EntryStatus,
        locationFrom: row.location_from,
        locationTo: row.location_to,
        remark: row.remark || '',
        photos: Array.isArray(row.photos) ? row.photos : [],
        createdAt: {
          toDate: () => new Date(row.created_at || Date.now()),
        },
        updatedAt: row.updated_at ? { toDate: () => new Date(row.updated_at) } : undefined,
      }));
    } catch (err) {
      console.warn('Supabase getWorkEntries exception:', err);
      return [];
    }
  },

  async addWorkEntry(entry: {
    uid: string;
    userName: string;
    workType: string;
    uom: UOMType;
    quantity: number;
    status: EntryStatus;
    locationFrom: string;
    locationTo: string;
    remark?: string;
    photos?: string[];
  }): Promise<string | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('work_entries')
        .insert({
          user_id: entry.uid,
          user_name: entry.userName,
          work_type: entry.workType,
          uom: entry.uom,
          quantity: entry.quantity,
          status: entry.status,
          location_from: entry.locationFrom,
          location_to: entry.locationTo,
          remark: entry.remark || '',
          photos: entry.photos || [],
        })
        .select('id')
        .single();

      if (error) {
        console.warn('Supabase addWorkEntry error:', error.message);
        return null;
      }
      return data.id;
    } catch (err) {
      console.warn('Supabase addWorkEntry exception:', err);
      return null;
    }
  },

  async updateWorkEntry(id: string, updates: Partial<WorkEntry>): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    try {
      const payload: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.workType !== undefined) payload.work_type = updates.workType;
      if (updates.uom !== undefined) payload.uom = updates.uom;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.locationFrom !== undefined) payload.location_from = updates.locationFrom;
      if (updates.locationTo !== undefined) payload.location_to = updates.locationTo;
      if (updates.remark !== undefined) payload.remark = updates.remark;
      if (updates.photos !== undefined) payload.photos = updates.photos;

      const { error } = await supabase.from('work_entries').update(payload).eq('id', id);
      if (error) {
        console.warn('Supabase updateWorkEntry error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Supabase updateWorkEntry exception:', err);
      return false;
    }
  },

  async deleteWorkEntry(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('work_entries').delete().eq('id', id);
      if (error) {
        console.warn('Supabase deleteWorkEntry error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Supabase deleteWorkEntry exception:', err);
      return false;
    }
  },
};
