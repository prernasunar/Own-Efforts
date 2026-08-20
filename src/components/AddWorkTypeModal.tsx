import React, { useState } from 'react';
import { UOMType } from '../types';
import { X, PlusCircle, Ruler, Hash } from 'lucide-react';

interface AddWorkTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, uom: UOMType) => Promise<void>;
}

export const AddWorkTypeModal: React.FC<AddWorkTypeModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [uom, setUom] = useState<UOMType>('meter');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a work type name');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onAdd(name.trim(), uom);
      setName('');
      setUom('meter');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save new work type');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
          <div className="flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-stone-900">Add Custom Work Type</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-stone-800 mb-1.5">
              Work Item Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Micro Trenching, OFC Splicing"
              className="w-full px-3.5 py-3 rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 text-base focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-800 mb-1.5">
              Unit of Measurement (UOM)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUom('meter')}
                className={`py-3 px-4 rounded-xl border-2 font-bold text-sm flex items-center justify-center space-x-2 transition-all ${
                  uom === 'meter'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-sm'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Ruler className="w-4 h-4 text-amber-600" />
                <span>meter (m)</span>
              </button>

              <button
                type="button"
                onClick={() => setUom('Number')}
                className={`py-3 px-4 rounded-xl border-2 font-bold text-sm flex items-center justify-center space-x-2 transition-all ${
                  uom === 'Number'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-sm'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Hash className="w-4 h-4 text-amber-600" />
                <span>Number (count)</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-500">
              This will be shared across the entire team's dropdown list in real time.
            </p>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-stone-300 font-bold text-stone-700 hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 font-bold text-white shadow-md disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save to Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
