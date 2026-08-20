import React, { useState, useMemo } from 'react';
import { WorkEntry } from '../types';
import {
  FileSpreadsheet,
  X,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Layers,
  Download,
  Filter,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import {
  exportCivilWorkToExcel,
  filterEntriesForExport,
  ExcelExportOptions,
} from '../utils/excelExporter';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: WorkEntry[];
  initialWorker?: string;
  initialDateType?: 'ALL' | 'TODAY' | 'CUSTOM_DATE';
  initialCustomDate?: string;
}

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
  isOpen,
  onClose,
  entries,
  initialWorker = 'ALL',
  initialDateType = 'ALL',
  initialCustomDate = new Date().toISOString().split('T')[0],
}) => {
  // Config state
  const [workerFilter, setWorkerFilter] = useState<string>(initialWorker);
  const [dateFilterType, setDateFilterType] = useState<
    'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM_DATE' | 'DATE_RANGE'
  >(initialDateType === 'CUSTOM_DATE' ? 'CUSTOM_DATE' : initialDateType === 'TODAY' ? 'TODAY' : 'ALL');
  const [customDate, setCustomDate] = useState<string>(initialCustomDate);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Done'>('ALL');
  const [groupBy, setGroupBy] = useState<'multi_tab_master' | 'worker' | 'date' | 'none'>(
    'multi_tab_master'
  );
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Extract unique worker names
  const uniqueWorkerNames = useMemo(() => {
    const names = new Set<string>();
    entries.forEach((e) => {
      if (e.userName) names.add(e.userName);
    });
    return Array.from(names).sort();
  }, [entries]);

  // Options object for current selection
  const currentOptions: ExcelExportOptions = useMemo(
    () => ({
      workerFilter,
      dateFilterType,
      customDate,
      startDate,
      endDate,
      statusFilter,
      groupBy,
    }),
    [workerFilter, dateFilterType, customDate, startDate, endDate, statusFilter, groupBy]
  );

  // Preview matching entries & summary
  const matchingEntries = useMemo(() => {
    return filterEntriesForExport(entries, currentOptions);
  }, [entries, currentOptions]);

  const summaryStats = useMemo(() => {
    let meters = 0;
    let nos = 0;
    let done = 0;
    let pending = 0;
    const workers = new Set<string>();

    matchingEntries.forEach((e) => {
      if (e.uom === 'meter') meters += Number(e.quantity) || 0;
      else nos += Number(e.quantity) || 0;
      if (e.status === 'Done') done++;
      else pending++;
      if (e.userName) workers.add(e.userName);
    });

    return {
      count: matchingEntries.length,
      meters,
      nos,
      done,
      pending,
      workerCount: workers.size,
    };
  }, [matchingEntries]);

  if (!isOpen) return null;

  const handleExport = () => {
    setExporting(true);
    setExportSuccessMsg(null);

    try {
      const result = exportCivilWorkToExcel(entries, currentOptions);
      if (result.success) {
        setExportSuccessMsg(`Successfully generated and downloaded ${result.fileName}!`);
        setTimeout(() => {
          setExportSuccessMsg(null);
          onClose();
        }, 1800);
      } else {
        alert(result.message || 'No entries to export.');
      }
    } catch (err) {
      console.error('Error generating Excel:', err);
      alert('Failed to generate Excel file. Please check console.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-stone-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-400/30">
              <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white flex items-center space-x-2">
                <span>Export to Excel (.xlsx)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-bold">
                  Date-Wise & User-Wise
                </span>
              </h3>
              <p className="text-xs text-stone-300">
                Customizable civil site reports for management, billing, and progress auditing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {exportSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
              <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{exportSuccessMsg}</span>
            </div>
          )}

          {/* 1. DATE-WISE CONFIGURATION */}
          <div className="space-y-2.5">
            <label className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>1. Date Selection (Date-Wise)</span>
            </label>

            {/* Quick Date Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'ALL', label: 'All Dates' },
                { id: 'TODAY', label: 'Today Only' },
                { id: 'YESTERDAY', label: 'Yesterday' },
                { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
                { id: 'THIS_MONTH', label: 'This Month' },
                { id: 'CUSTOM_DATE', label: 'Specific Day' },
                { id: 'DATE_RANGE', label: 'Custom Range' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDateFilterType(item.id as any)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-center ${
                    dateFilterType === item.id
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Date Picker Details */}
            {dateFilterType === 'CUSTOM_DATE' && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center space-x-3">
                <span className="text-xs font-bold text-stone-700 flex-shrink-0">Select Date:</span>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 text-stone-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {dateFilterType === 'DATE_RANGE' && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-stone-600">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 text-stone-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none flex-1"
                  />
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 hidden sm:block" />
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-stone-600">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 text-stone-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none flex-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. USER-WISE CONFIGURATION */}
          <div className="space-y-2.5 pt-1">
            <label className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center space-x-1.5">
              <User className="w-4 h-4 text-amber-700" />
              <span>2. Field Worker Selection (User-Wise)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div
                onClick={() => setWorkerFilter('ALL')}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  workerFilter === 'ALL'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">👥 All Field Workers</span>
                  {workerFilter === 'ALL' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Exports logs from all {uniqueWorkerNames.length} registered field staff
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border-2 transition-all ${
                  workerFilter !== 'ALL'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                    : 'border-stone-200 bg-stone-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-stone-900">👷 Specific Worker</span>
                  {workerFilter !== 'ALL' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <select
                  value={workerFilter === 'ALL' ? '' : workerFilter}
                  onChange={(e) => setWorkerFilter(e.target.value || 'ALL')}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-bold text-stone-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Choose Field Worker --</option>
                  {uniqueWorkerNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. STATUS FILTER */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Filter className="w-4 h-4 text-stone-600" />
              <span>3. Verification Status Filter</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ALL', label: 'All Statuses' },
                { id: 'Done', label: 'Done Only (Complete)' },
                { id: 'Pending', label: 'Pending Only' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id as any)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                    statusFilter === st.id
                      ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. WORKBOOK STRUCTURE / SHEETS */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>4. Excel Sheet Format & Grouping</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  id: 'multi_tab_master',
                  title: '📊 Executive Master Report (Recommended)',
                  desc: 'Includes Executive Summary + Worker-wise Summary + Date-wise Summary + Detailed Logs tab',
                },
                {
                  id: 'worker',
                  title: '👥 Separate Tabs per Worker',
                  desc: 'Creates a unique Excel tab for every field engineer/worker',
                },
                {
                  id: 'date',
                  title: '📅 Separate Tabs per Date',
                  desc: 'Creates individual tabs for each working day',
                },
                {
                  id: 'none',
                  title: '📄 Single Flat Sheet',
                  desc: 'Simple single sheet with all rows sorted chronologically',
                },
              ].map((layout) => (
                <div
                  key={layout.id}
                  onClick={() => setGroupBy(layout.id as any)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    groupBy === layout.id
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                      : 'border-stone-200 bg-stone-50/40 hover:bg-stone-100'
                  }`}
                >
                  <div className="text-xs font-black text-stone-900 flex items-center justify-between">
                    <span>{layout.title}</span>
                    {groupBy === layout.id && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1 leading-snug">{layout.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* LIVE SUMMARY PREVIEW BAR */}
          <div className="p-4 rounded-xl bg-stone-900 text-white shadow-inner space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Export Dataset Preview</span>
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {summaryStats.count} Entries Selected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-stone-800">
              <div className="bg-stone-800/80 p-2 rounded-lg">
                <span className="text-[10px] text-stone-400 uppercase block">Total Meters</span>
                <span className="text-sm font-black text-white">
                  {summaryStats.meters.toLocaleString()} m
                </span>
              </div>
              <div className="bg-stone-800/80 p-2 rounded-lg">
                <span className="text-[10px] text-stone-400 uppercase block">Total Numbers</span>
                <span className="text-sm font-black text-white">
                  {summaryStats.nos.toLocaleString()} Nos
                </span>
              </div>
              <div className="bg-stone-800/80 p-2 rounded-lg">
                <span className="text-[10px] text-stone-400 uppercase block">Status Breakdown</span>
                <span className="text-xs font-bold text-emerald-400">
                  {summaryStats.done} Done • {summaryStats.pending} Pend
                </span>
              </div>
              <div className="bg-stone-800/80 p-2 rounded-lg">
                <span className="text-[10px] text-stone-400 uppercase block">Active Workers</span>
                <span className="text-sm font-black text-amber-300">
                  {summaryStats.workerCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-stone-500 text-center sm:text-left">
            Generates standard <strong>.xlsx</strong> compatible with MS Excel, Google Sheets, & Numbers
          </span>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={exporting || summaryStats.count === 0}
              onClick={handleExport}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl font-black text-xs text-white shadow-md transition-all ${
                summaryStats.count === 0
                  ? 'bg-stone-400 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Generating Excel...' : `Download Excel (${summaryStats.count})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
