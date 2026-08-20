import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  RefreshCw,
  X,
  AlertTriangle,
  Code2
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  getSupabaseClient,
  SUPABASE_SETUP_SQL,
  isSupabaseConfigured,
} from '../lib/supabase';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url);
      setAnonKey(config.anonKey);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    const trimmedUrl = url.trim();
    const trimmedKey = anonKey.trim();

    if (!trimmedUrl || !trimmedKey) {
      setTestResult({
        success: false,
        message: 'Please provide both Supabase Project URL and Anon Key.',
      });
      setTesting(false);
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setTestResult({
        success: false,
        message: 'URL must start with https:// (e.g. https://your-project.supabase.co)',
      });
      setTesting(false);
      return;
    }

    try {
      saveSupabaseConfig(trimmedUrl, trimmedKey);
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Could not instantiate Supabase client.');
      }

      // Quick ping test
      const { data, error } = await client.from('work_entries').select('id').limit(1);

      if (error && error.code !== 'PGRST116') {
        // Table might not exist yet, which is normal before running SQL script
        if (error.message.includes('relation "public.work_entries" does not exist')) {
          setTestResult({
            success: true,
            message: 'Connected to Supabase! Note: Please copy and run the SQL setup script below in your Supabase SQL editor to create the tables.',
          });
          setShowSql(true);
        } else {
          setTestResult({
            success: false,
            message: `Connection error: ${error.message}`,
          });
        }
      } else {
        setTestResult({
          success: true,
          message: 'Successfully connected and verified with Supabase!',
        });
      }

      if (onConfigChanged) {
        onConfigChanged();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Connection failed. Please check credentials.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    saveSupabaseConfig('', '');
    setUrl('');
    setAnonKey('');
    setTestResult({
      success: true,
      message: 'Supabase credentials cleared. Using local demo/instant mode.',
    });
    if (onConfigChanged) {
      onConfigChanged();
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-stone-200 overflow-hidden my-6 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Database className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">Supabase Database & Auth</h2>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isConfigured
                      ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                      : 'bg-amber-400/20 text-amber-200 border border-amber-400/30'
                  }`}
                >
                  {isConfigured ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs text-emerald-200">
                Connect your PostgreSQL database & authentication in seconds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(85vh-120px)] overflow-y-auto">
          {/* Quick instructions */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 text-xs text-emerald-900 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-emerald-950">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>How to get your Supabase API Keys:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-stone-700 pl-1">
              <li>
                Go to{' '}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-emerald-700 underline inline-flex items-center space-x-0.5"
                >
                  <span>supabase.com/dashboard</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </li>
              <li>Select your project &rarr; <strong>Project Settings</strong> &rarr; <strong>API</strong></li>
              <li>Copy the <strong>Project URL</strong> and <strong>anon public key</strong> and paste below</li>
            </ol>
          </div>

          {/* Form */}
          <form onSubmit={handleTestAndSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Supabase Project URL
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project-ref.supabase.co"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Supabase Anon / Public Key
              </label>
              <textarea
                required
                rows={2}
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono bg-stone-50/50 resize-none"
              />
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start space-x-2.5 border ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{testResult.success ? 'Success' : 'Notice'}</p>
                  <p className="mt-0.5 leading-relaxed">{testResult.message}</p>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="submit"
                disabled={testing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-sm"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting & Testing...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Save & Connect Supabase</span>
                  </>
                )}
              </button>

              {isConfigured && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs font-semibold"
                >
                  Disconnect
                </button>
              )}
            </div>
          </form>

          {/* 1-Click SQL Setup Script */}
          <div className="border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setShowSql(!showSql)}
                className="flex items-center space-x-2 text-xs font-bold text-stone-800 hover:text-emerald-700"
              >
                <Code2 className="w-4 h-4 text-emerald-600" />
                <span>{showSql ? 'Hide' : 'View'} Supabase Database SQL Tables</span>
              </button>
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors border border-stone-300"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied SQL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy SQL Script</span>
                  </>
                )}
              </button>
            </div>

            {showSql && (
              <div className="mt-2">
                <p className="text-[11px] text-stone-500 mb-1.5">
                  Paste and click <strong>Run</strong> in your Supabase Dashboard &rarr; <strong>SQL Editor</strong>:
                </p>
                <pre className="bg-stone-900 text-emerald-300 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-stone-800">
                  {SUPABASE_SETUP_SQL}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-50 px-6 py-3.5 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span>Civil Site Work Logger • Supabase Ready</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
