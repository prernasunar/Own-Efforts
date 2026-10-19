import React, { useState } from 'react';
import { UserRole } from '../types';
import { X, UserPlus, HardHat, Mail, CheckCircle2, AlertCircle, Phone } from 'lucide-react';

interface AddWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (worker: { name: string; email?: string; role?: UserRole }) => Promise<void>;
}

export const AddWorkerModal: React.FC<AddWorkerModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('Field Executive');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter field executive full name');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onAdd({
        name: cleanName,
        email: email.trim() || `${cleanName.toLowerCase().replace(/\s+/g, '.')}@site.work`,
        role,
      });

      setSuccessNotice(`Field Executive "${cleanName}" added successfully!`);
      setTimeout(() => {
        setName('');
        setEmail('');
        setSuccessNotice(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to add field executive to team');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3.5 border-b border-stone-200 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 font-bold shadow-2xs">
              <UserPlus className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-stone-900">Add New Field Executive</h3>
              <p className="text-xs text-stone-500">Register field executive to track their site logs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successNotice && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs sm:text-sm font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-800 uppercase tracking-wide mb-1.5">
              Field Executive Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma, Ganesh Kumbhar"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-800 uppercase tracking-wide mb-1.5">
              Contact Email / Mobile ID (Optional)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. rahul.sharma@site.work or +91 9876543210"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 placeholder-stone-400 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              If left blank, a site ID email will be generated automatically.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-800 uppercase tracking-wide mb-1.5">
              Designation / Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('Field Executive')}
                className={`py-2 px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all ${
                  role !== 'Manager'
                    ? 'border-amber-600 bg-amber-50 text-amber-950 shadow-xs'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <HardHat className="w-3.5 h-3.5 text-amber-600" />
                <span>Field Executive</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('Manager')}
                className={`py-2 px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all ${
                  role === 'Manager'
                    ? 'border-amber-600 bg-amber-50 text-amber-950 shadow-xs'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <span>👔 Supervisor / Mgr</span>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>{submitting ? 'Adding...' : 'Add Field Executive'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
