export type UserRole = 'Field Worker' | 'Manager';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: any;
}

export type UOMType = 'meter' | 'Number';

export interface WorkTypeItem {
  id?: string;
  name: string;
  uom: UOMType;
  isCustom?: boolean;
  createdBy?: string;
  createdAt?: any;
}

export type EntryStatus = 'Pending' | 'Done';

export interface WorkEntry {
  id: string;
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
