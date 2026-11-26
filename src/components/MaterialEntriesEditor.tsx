import React from 'react';
import { MOUType, MaterialItem } from '../types';
import { Package, Hash, Ruler, Plus, Trash2 } from 'lucide-react';

export interface MaterialRowDraft {
  id: string;
  material: string;
  mou: MOUType;
  quantity: string;
}

export function createEmptyMaterialRow(defaultMou: MOUType = 'MTR'): MaterialRowDraft {
  return {
    id: `mat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    material: '',
    mou: defaultMou,
    quantity: '',
  };
}

export function materialItemsToDrafts(items: MaterialItem[]): MaterialRowDraft[] {
  if (!items || items.length === 0) {
    return [createEmptyMaterialRow('MTR')];
  }
  return items.map((item, idx) => ({
    id: `mat_init_${idx}_${Date.now()}`,
    material: item.material || '',
    mou: item.mou === 'Count' ? 'Count' : 'MTR',
    quantity:
      item.quantity !== undefined && item.quantity !== null && !isNaN(Number(item.quantity))
        ? String(item.quantity)
        : '',
  }));
}

export function draftsToMaterialItems(rows: MaterialRowDraft[]): MaterialItem[] {
  return rows
    .slice(0, 30)
    .map((row): MaterialItem | null => {
      const mat = row.material.trim().slice(0, 200);
      const qtyStr = row.quantity.trim();
      const hasQty = qtyStr !== '' && !isNaN(Number(qtyStr)) && Number(qtyStr) >= 0;
      if (!mat && !hasQty) return null;
      return hasQty
        ? { material: mat, mou: row.mou, quantity: Math.max(0, Number(qtyStr)) }
        : { material: mat, mou: row.mou };
    })
    .filter((item): item is MaterialItem => item !== null);
}

interface MaterialEntriesEditorProps {
  rows: MaterialRowDraft[];
  onChange: (rows: MaterialRowDraft[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const MaterialEntriesEditor: React.FC<MaterialEntriesEditorProps> = ({
  rows,
  onChange,
  disabled = false,
  compact = false,
}) => {
  const handleAddRow = () => {
    if (rows.length >= 30 || disabled) return;
    onChange([...rows, createEmptyMaterialRow('MTR')]);
  };

  const handleRemoveRow = (id: string) => {
    if (disabled) return;
    if (rows.length <= 1) {
      onChange([createEmptyMaterialRow('MTR')]);
      return;
    }
    onChange(rows.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, patch: Partial<MaterialRowDraft>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div className={`bg-stone-50 ${compact ? 'p-3' : 'p-3.5 sm:p-4'} rounded-xl border border-stone-200 space-y-3`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center space-x-1.5">
          <Package className="w-4 h-4 text-amber-600 shrink-0" />
          <label className="text-xs font-bold text-stone-900">
            Material, MOU & Quantity
          </label>
          {rows.length > 1 && (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
              {rows.length} items
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddRow}
          disabled={disabled || rows.length >= 30}
          className="min-h-[34px] inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Material</span>
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="bg-white p-3 rounded-xl border border-stone-200 space-y-2.5 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-stone-500">
                Material #{idx + 1}
              </span>
              {(rows.length > 1 || row.material.trim() !== '' || row.quantity.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => handleRemoveRow(row.id)}
                  disabled={disabled}
                  className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                  title={rows.length > 1 ? 'Remove this material row' : 'Clear material row'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{rows.length > 1 ? 'Remove' : 'Clear'}</span>
                </button>
              )}
            </div>

            <div>
              <input
                type="text"
                value={row.material}
                disabled={disabled}
                onChange={(e) => handleUpdateRow(row.id, { material: e.target.value })}
                placeholder="Enter material name (e.g. 40mm HDPE Duct, Coupler, HH Cover)"
                className={`w-full ${compact ? 'min-h-[40px] py-2' : 'min-h-[44px] py-2.5'} px-3 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm font-medium placeholder-stone-400 focus:border-amber-600 focus:outline-none`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  MOU (Option)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleUpdateRow(row.id, { mou: 'Count' })}
                    className={`${compact ? 'min-h-[38px] py-1.5' : 'min-h-[42px] py-2'} px-2.5 rounded-xl border-2 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      row.mou === 'Count'
                        ? 'border-amber-600 bg-amber-50 text-amber-950'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Hash className={`w-3.5 h-3.5 shrink-0 ${row.mou === 'Count' ? 'text-amber-600' : 'text-stone-400'}`} />
                    <span>Count</span>
                  </button>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleUpdateRow(row.id, { mou: 'MTR' })}
                    className={`${compact ? 'min-h-[38px] py-1.5' : 'min-h-[42px] py-2'} px-2.5 rounded-xl border-2 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      row.mou === 'MTR'
                        ? 'border-amber-600 bg-amber-50 text-amber-950'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Ruler className={`w-3.5 h-3.5 shrink-0 ${row.mou === 'MTR' ? 'text-amber-600' : 'text-stone-400'}`} />
                    <span>MTR</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Quantity ({row.mou}) <span className="font-normal text-stone-500">(Optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={disabled}
                  value={row.quantity}
                  onChange={(e) => handleUpdateRow(row.id, { quantity: e.target.value })}
                  placeholder={row.mou === 'Count' ? 'e.g. 5 (Count)' : 'e.g. 120 (MTR)'}
                  className={`w-full ${compact ? 'min-h-[38px] py-1.5' : 'min-h-[42px] py-2'} px-3 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm font-bold font-mono placeholder-stone-400 focus:border-amber-600 focus:outline-none`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {rows.length < 30 && (
        <button
          type="button"
          onClick={handleAddRow}
          disabled={disabled}
          className="w-full min-h-[40px] py-2 px-3 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50 text-amber-800 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>+ Add Another Material Entry</span>
        </button>
      )}
    </div>
  );
};
