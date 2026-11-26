export type UserRole = 'Field Executive' | 'Manager' | 'Field Worker';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: any;
}

export type UOMType = 'meter' | 'Number';
export type MOUType = 'Count' | 'MTR';

export interface MaterialItem {
  material: string;
  mou: MOUType;
  quantity?: number;
}

export interface WorkTypeItem {
  id?: string;
  name: string;
  uom: UOMType;
  isCustom?: boolean;
  createdBy?: string;
  createdAt?: any;
}

export type EntryStatus = 'Rectify by us' | 'Rectify by Genesis';

export function normalizeEntryStatus(status?: string | null): EntryStatus {
  if (status === 'Rectify by us' || status === 'Pending') return 'Rectify by us';
  if (status === 'Rectify by Genesis' || status === 'Done') return 'Rectify by Genesis';
  return 'Rectify by us';
}

export function normalizeMOU(mou?: string | null, uom?: string | null): MOUType {
  if (mou === 'Count' || mou === 'count') return 'Count';
  if (mou === 'MTR' || mou === 'mtr' || mou === 'Mtr') return 'MTR';
  if (uom === 'Number') return 'Count';
  return 'MTR';
}

export function sanitizeMaterialItems(items?: any[] | null): MaterialItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 30)
    .map((item): MaterialItem | null => {
      if (!item || typeof item !== 'object') return null;
      const mat = typeof item.material === 'string' ? item.material.trim().slice(0, 200) : '';
      const mou = normalizeMOU(item.mou, item.uom);
      const rawQty = item.quantity;
      const hasValidQty =
        rawQty !== undefined &&
        rawQty !== null &&
        rawQty !== '' &&
        !isNaN(Number(rawQty)) &&
        Number(rawQty) >= 0;
      if (!mat && !hasValidQty) return null;
      return hasValidQty
        ? { material: mat, mou, quantity: Number(rawQty) }
        : { material: mat, mou };
    })
    .filter((item): item is MaterialItem => item !== null);
}

export function getEntryMaterials(entry: Partial<WorkEntry>): MaterialItem[] {
  if (Array.isArray(entry.materials) && entry.materials.length > 0) {
    const cleaned = sanitizeMaterialItems(entry.materials);
    if (cleaned.length > 0) return cleaned;
  }
  const mat = (entry.material || '').trim();
  const hasExplicitMou = entry.mou === 'Count' || entry.mou === 'MTR';
  const hasPositiveQty =
    entry.quantity !== undefined &&
    entry.quantity !== null &&
    !isNaN(Number(entry.quantity)) &&
    Number(entry.quantity) > 0;
  if (mat || hasExplicitMou) {
    const mou = normalizeMOU(entry.mou, entry.uom);
    return hasPositiveQty
      ? [{ material: mat, mou, quantity: Number(entry.quantity) }]
      : [{ material: mat, mou }];
  }
  return [];
}

export function formatMaterialItem(item: MaterialItem): string {
  const name = item.material.trim();
  const hasQty = item.quantity !== undefined && item.quantity !== null && !isNaN(Number(item.quantity));
  if (name && hasQty) return `${name} (${item.quantity} ${item.mou})`;
  if (name) return `${name} (${item.mou})`;
  if (hasQty) return `${item.quantity} ${item.mou}`;
  return item.mou;
}

export function formatEntryMaterialsSummary(entry: Partial<WorkEntry>): string {
  const items = getEntryMaterials(entry);
  if (items.length === 0) return 'Not specified';
  return items.map(formatMaterialItem).join(', ');
}

export function computeEntryMaterialTotals(entry: Partial<WorkEntry>): { meters: number; counts: number } {
  const items = getEntryMaterials(entry);
  if (items.length > 0) {
    let meters = 0;
    let counts = 0;
    let anyQty = false;
    items.forEach((item) => {
      if (item.quantity !== undefined && item.quantity !== null && !isNaN(Number(item.quantity))) {
        anyQty = true;
        if (item.mou === 'Count') counts += Number(item.quantity);
        else meters += Number(item.quantity);
      }
    });
    if (anyQty) return { meters, counts };
  }
  const fallbackQty = Number(entry.quantity) || 0;
  if (entry.mou === 'Count' || entry.uom === 'Number') {
    return { meters: 0, counts: fallbackQty };
  }
  return { meters: fallbackQty, counts: 0 };
}

export interface WorkEntry {
  id: string;
  uid: string;
  userName: string;
  workType?: string;
  uom?: UOMType;
  quantity?: number;
  material?: string;
  mou?: MOUType;
  materials?: MaterialItem[];
  status: EntryStatus;
  route?: string;
  location?: string;
  latLong?: string;
  locationFrom?: string;
  locationTo?: string;
  remark?: string;
  photos?: string[];
  date?: string; // YYYY-MM-DD format (editable, defaults to current date)
  createdAt: any;
  updatedAt?: any;
}

export const PRESET_WORK_TYPES: Array<{ name: string; uom: UOMType }> = [
  { name: 'T&D', uom: 'meter' },
  { name: 'PCC', uom: 'meter' },
  { name: 'New HH', uom: 'Number' },
  { name: 'HH raising', uom: 'Number' },
  { name: 'Cable Blowing', uom: 'meter' },
  { name: 'HH shifting', uom: 'Number' },
  { name: 'Aerial cable tightening', uom: 'meter' },
  { name: 'Duct & cable Saved', uom: 'meter' },
  { name: 'Duct Laying', uom: 'meter' },
  { name: 'Buried Handhold Open', uom: 'Number' },
  { name: 'HH Cover Change', uom: 'Number' },
  { name: 'HH cleaning', uom: 'Number' },
  { name: 'Cable pulling', uom: 'meter' },
  { name: 'Trial pit', uom: 'Number' },
  { name: 'Cable safeguarding', uom: 'meter' },
  { name: 'Aerial To UG', uom: 'meter' },
  { name: 'Aerial Work', uom: 'meter' },
  { name: 'HH Open', uom: 'Number' },
  { name: 'Trenching', uom: 'meter' },
];
