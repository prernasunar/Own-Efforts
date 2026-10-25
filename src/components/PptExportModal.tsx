import React, { useState, useMemo, useEffect } from 'react';
import { WorkEntry } from '../types';
import {
  Presentation,
  X,
  Calendar,
  User,
  CheckCircle2,
  Download,
  Sparkles,
  ArrowRight,
  Camera,
  AlertCircle,
} from 'lucide-react';
import {
  exportCivilWorkToPpt,
  filterEntriesForPpt,
  PptExportOptions,
} from '../utils/pptExporter';

interface PptExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: WorkEntry[];
  workerNames?: string[];
  initialWorker?: string;
  initialDateType?: 'ALL' | 'TODAY' | 'CUSTOM_DATE';
  initialCustomDate?: string;
}

export const PptExportModal: React.FC<PptExportModalProps> = ({
  isOpen,
  onClose,
  entries,
  workerNames,
  initialWorker = 'ALL',
  initialDateType = 'ALL',
  initialCustomDate = new Date().toISOString().split('T')[0],
}) => {
  const [workerFilter, setWorkerFilter] = useState<string>(initialWorker);
  const [dateFilterType, setDateFilterType] = useState<
    'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM_DATE' | 'DATE_RANGE'
  >(
    initialDateType === 'CUSTOM_DATE'
      ? 'CUSTOM_DATE'
      : initialDateType === 'TODAY'
      ? 'TODAY'
      : 'ALL'
  );
  const [customDate, setCustomDate] = useState<string>(initialCustomDate);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Done'>('ALL');
  const [includeSummarySlide, setIncludeSummarySlide] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [exportErrorMsg, setExportErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setWorkerFilter(initialWorker);
      setDateFilterType(
        initialDateType === 'CUSTOM_DATE'
          ? 'CUSTOM_DATE'
          : initialDateType === 'TODAY'
          ? 'TODAY'
          : 'ALL'
      );
      setCustomDate(initialCustomDate);
      setExportSuccessMsg(null);
      setExportErrorMsg(null);
    }
  }, [isOpen, initialWorker, initialDateType, initialCustomDate]);

  const uniqueWorkerNames = useMemo(() => {
    if (workerNames && workerNames.length > 0) return workerNames;
    const map = new Map<string, string>();
    entries.forEach((e) => {
      if (e.userName && e.userName.trim()) {
        const key = e.userName.trim().toLowerCase();
        if (!map.has(key)) map.set(key, e.userName.trim());
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [entries, workerNames]);

  const currentOptions: PptExportOptions = useMemo(
    () => ({
      workerFilter,
      dateFilterType,
      customDate,
      startDate,
      endDate,
      statusFilter,
      includeSummarySlide,
    }),
    [workerFilter, dateFilterType, customDate, startDate, endDate, statusFilter, includeSummarySlide]
  );

  const matchingEntries = useMemo(() => {
    return filterEntriesForPpt(entries, currentOptions);
  }, [entries, currentOptions]);

  const summaryStats = useMemo(() => {
    let meters = 0;
    let nos = 0;
    let done = 0;
    let pending = 0;
    let photosCount = 0;
    const workers = new Set<string>();

    matchingEntries.forEach((e) => {
      if (e.uom === 'meter') meters += Number(e.quantity) || 0;
      else nos += Number(e.quantity) || 0;
      if (e.status === 'Done') done++;
      else pending++;
      photosCount += (e.photos || []).length;
      if (e.userName) workers.add(e.userName.trim().toLowerCase());
    });

    return {
      count: matchingEntries.length,
      meters,
      nos,
      done,
      pending,
      photosCount,
      workerCount: workers.size,
      totalSlides: matchingEntries.length + (includeSummarySlide ? 1 : 0),
    };
  }, [matchingEntries, includeSummarySlide]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);
    setExportSuccessMsg(null);
    setExportErrorMsg(null);

    try {
      const result = await exportCivilWorkToPpt(entries, currentOptions);
      if (result.success) {
        setExportSuccessMsg(`Downloaded PowerPoint presentation: ${result.fileName}`);
        setTimeout(() => {
          setExportSuccessMsg(null);
          onClose();
        }, 1600);
      } else {
        setExportErrorMsg(result.message || 'No entries match your selected filters.');
      }
    } catch (err) {
      console.error('Error generating PPT:', err);
      setExportErrorMsg('Could not generate PowerPoint file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-stone-900 px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-300/40 flex-shrink-0">
              <Presentation className="w-5 h-5 sm:w-6 sm:h-6 text-amber-200" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center space-x-2 flex-wrap">
                <span className="truncate">Export to PowerPoint (.pptx)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/30 text-amber-100 border border-amber-300/40 font-bold flex-shrink-0">
                  With Site Photos
                </span>
              </h3>
              <p className="text-xs text-amber-100/90 line-clamp-1 sm:line-clamp-none">
                Each field log creates a slide with site photos at the top and full work details below
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {exportSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{exportSuccessMsg}</span>
            </div>
          )}

          {exportErrorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{exportErrorMsg}</span>
            </div>
          )}

          {/* 1. DATE SELECTION */}
          <div className="space-y-2.5">
            <label className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-amber-700" />
              <span>1. Date Selection (Date-Wise)</span>
            </label>

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
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                    dateFilterType === item.id
                      ? 'bg-amber-700 text-white border-amber-800 shadow-xs ring-2 ring-amber-500/20'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {dateFilterType === 'CUSTOM_DATE' && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center space-x-3">
                <span className="text-xs font-bold text-stone-700 flex-shrink-0">Select Date:</span>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 text-stone-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 text-stone-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none flex-1"
                  />
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 hidden sm:block" />
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-stone-600">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 text-stone-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none flex-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. FIELD EXECUTIVE SELECTION */}
          <div className="space-y-2.5 pt-1">
            <label className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center space-x-1.5">
              <User className="w-4 h-4 text-amber-700" />
              <span>2. Field Executive Selection (User-Wise)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={workerFilter}
                  onChange={(e) => setWorkerFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-xs sm:text-sm font-bold bg-stone-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="ALL">👥 All Field Executives ({uniqueWorkerNames.length})</option>
                  {uniqueWorkerNames.map((name) => (
                    <option key={name} value={name}>
                      👷 {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-1.5">
                {(['ALL', 'Done', 'Pending'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {st === 'ALL' ? 'All Status' : st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. SLIDE LAYOUT OPTION */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-stone-900">
                Include Executive Summary Cover Slide
              </p>
              <p className="text-[11px] text-stone-600">
                Adds an overview slide with total meters, status counts & summary table before individual photo slides
              </p>
            </div>
            <input
              type="checkbox"
              checked={includeSummarySlide}
              onChange={(e) => setIncludeSummarySlide(e.target.checked)}
              className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
            />
          </div>

          {/* PREVIEW SUMMARY BOX */}
          <div className="bg-stone-900 text-white rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Presentation className="w-4 h-4" />
                <span>PowerPoint Deck Preview</span>
              </span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                {summaryStats.count > 0 ? `${summaryStats.totalSlides} Slides Total` : '0 Slides'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="bg-stone-800/90 p-2.5 rounded-xl border border-stone-700">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">
                  Matching Logs
                </span>
                <span className="text-lg font-black text-white">{summaryStats.count}</span>
              </div>
              <div className="bg-stone-800/90 p-2.5 rounded-xl border border-stone-700">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">
                  Site Photos
                </span>
                <span className="text-lg font-black text-amber-400 flex items-center justify-center space-x-1">
                  <Camera className="w-4 h-4" />
                  <span>{summaryStats.photosCount}</span>
                </span>
              </div>
              <div className="bg-stone-800/90 p-2.5 rounded-xl border border-stone-700">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">
                  Total Meters
                </span>
                <span className="text-lg font-black text-emerald-400">
                  {summaryStats.meters.toLocaleString()} m
                </span>
              </div>
              <div className="bg-stone-800/90 p-2.5 rounded-xl border border-stone-700">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">
                  Done / Pending
                </span>
                <span className="text-sm font-black text-stone-200 mt-1 block">
                  {summaryStats.done} Done • {summaryStats.pending} Pend
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || summaryStats.count === 0}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer ${
              summaryStats.count === 0 || exporting
                ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>
              {exporting
                ? 'Generating PPTX...'
                : `Download PowerPoint (${summaryStats.count} Logs)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
