import React, { useState } from 'react';
import { X, KeyRound, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { getSavedFirebaseConfig, saveFirebaseConfig, FirebaseConfigType, isFirebaseConfigured } from '../lib/firebase';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ isOpen, onClose }) => {
  const currentConfig = getSavedFirebaseConfig();
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig.projectId || '');
  const [storageBucket, setStorageBucket] = useState(currentConfig.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(currentConfig.messagingSenderId || '');
  const [appId, setAppId] = useState(currentConfig.appId || '');

  const [saved, setSaved] = useState(false);
  const configured = isFirebaseConfigured();

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newConfig: FirebaseConfigType = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
    };
    saveFirebaseConfig(newConfig);
    setSaved(true);
  };

  const handleResetToDemo = () => {
    localStorage.removeItem('civil_site_firebase_config');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-stone-200 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
          <div className="flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-stone-900">Firebase Cloud Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-200">
          <div className="font-semibold text-stone-800 mb-1 flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                configured ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span>Status: {configured ? 'Live Firebase Connected' : 'Demo Local Mode Active'}</span>
          </div>
          Paste your Firebase project web configuration keys below to synchronize live across all field workers and manager dashboards.
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              API Key (apiKey)
            </label>
            <input
              type="text"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Project ID
              </label>
              <input
                type="text"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="civil-site-logger"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Auth Domain
              </label>
              <input
                type="text"
                required
                value={authDomain}
                onChange={(e) => setAuthDomain(e.target.value)}
                placeholder="project.firebaseapp.com"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                App ID (appId)
              </label>
              <input
                type="text"
                required
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="1:123456789:web:..."
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Messaging Sender ID
              </label>
              <input
                type="text"
                value={messagingSenderId}
                onChange={(e) => setMessagingSenderId(e.target.value)}
                placeholder="123456789"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={handleResetToDemo}
              className="px-3 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
            >
              Reset to Demo
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white shadow-md transition-colors flex items-center justify-center space-x-1.5"
            >
              {saved ? <Check className="w-4 h-4" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{saved ? 'Saved & Reloading...' : 'Save & Connect Cloud'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
