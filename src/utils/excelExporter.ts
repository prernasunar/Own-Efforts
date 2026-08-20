import * as XLSX from 'xlsx';
import { WorkEntry } from '../types';

export interface ExcelExportOptions {
  fileName?: string;
  workerFilter?: string; // 'ALL' or specific worker name
  dateFilterType?: 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM_DATE' | 'DATE_RANGE';
  customDate?: string; // YYYY-MM-DD
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
  statusFilter?: 'ALL' | 'Pending' | 'Done';
  groupBy?: 'none' | 'worker' | 'date' | 'multi_tab_master';
}

/**
 * Formats a Firebase timestamp / Date into YYYY-MM-DD and HH:MM
 */
export function parseEntryDateTime(entry: WorkEntry): { dateStr: string; timeStr: string; dateObj: Date | null } {
  if (!entry.createdAt) {
    return { dateStr: 'N/A', timeStr: 'N/A', dateObj: null };
  }
  let d: Date;
  if (typeof entry.createdAt.toDate === 'function') {
    d = entry.createdAt.toDate();
  } else if (entry.createdAt instanceof Date) {
    d = entry.createdAt;
  } else if (typeof entry.createdAt === 'string' || typeof entry.createdAt === 'number') {
    d = new Date(entry.createdAt);
  } else {
    return { dateStr: 'N/A', timeStr: 'N/A', dateObj: null };
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const timeStr = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return { dateStr, timeStr, dateObj: d };
}

/**
 * Filter entries according to date, worker, and status criteria
 */
export function filterEntriesForExport(entries: WorkEntry[], options: ExcelExportOptions): WorkEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  return entries.filter((entry) => {
    // 1. Worker filter
    if (options.workerFilter && options.workerFilter !== 'ALL') {
      if (entry.userName !== options.workerFilter) return false;
    }

    // 2. Status filter
    if (options.statusFilter && options.statusFilter !== 'ALL') {
      if (entry.status !== options.statusFilter) return false;
    }

    // 3. Date filter
    const { dateObj, dateStr } = parseEntryDateTime(entry);
    if (!dateObj) return true;

    const entryMidnight = new Date(dateObj);
    entryMidnight.setHours(0, 0, 0, 0);

    switch (options.dateFilterType) {
      case 'TODAY':
        return entryMidnight.getTime() === today.getTime();

      case 'YESTERDAY':
        return entryMidnight.getTime() === yesterday.getTime();

      case 'LAST_7_DAYS':
        return entryMidnight >= sevenDaysAgo && entryMidnight <= today;

      case 'THIS_MONTH':
        return (
          dateObj.getFullYear() === today.getFullYear() &&
          dateObj.getMonth() === today.getMonth()
        );

      case 'CUSTOM_DATE':
        if (!options.customDate) return true;
        return dateStr === options.customDate;

      case 'DATE_RANGE':
        if (options.startDate && options.endDate) {
          return dateStr >= options.startDate && dateStr <= options.endDate;
        } else if (options.startDate) {
          return dateStr >= options.startDate;
        } else if (options.endDate) {
          return dateStr <= options.endDate;
        }
        return true;

      case 'ALL':
      default:
        return true;
    }
  });
}

/**
 * Formats row data for detailed work log sheets
 */
function buildRowData(entry: WorkEntry, index: number) {
  const { dateStr, timeStr } = parseEntryDateTime(entry);
  return {
    'Sr No': index + 1,
    'Date': dateStr,
    'Time': timeStr,
    'Field Worker': entry.userName || 'Unknown',
    'Work Type': entry.workType,
    'Quantity': entry.quantity,
    'Unit (UOM)': entry.uom,
    'Status': entry.status,
    'Location From': entry.locationFrom || '',
    'Location To': entry.locationTo || '',
    'Remark / Notes': entry.remark || '',
    'Photos Attached': (entry.photos && entry.photos.length) || 0,
    'Entry ID': entry.id || '',
  };
}

/**
 * Computes summary metrics across a list of entries
 */
function computeSummary(entries: WorkEntry[]) {
  let totalMeterQty = 0;
  let totalNumberQty = 0;
  let doneCount = 0;
  let pendingCount = 0;

  const workTypeBreakdown: Record<string, { qty: number; uom: string; count: number }> = {};
  const workerBreakdown: Record<string, { totalEntries: number; done: number; pending: number; meterQty: number; numQty: number }> = {};
  const dateBreakdown: Record<string, { totalEntries: number; done: number; pending: number; meterQty: number; numQty: number }> = {};

  entries.forEach((e) => {
    if (e.uom === 'meter') {
      totalMeterQty += Number(e.quantity) || 0;
    } else {
      totalNumberQty += Number(e.quantity) || 0;
    }

    if (e.status === 'Done') doneCount++;
    else pendingCount++;

    // Work type
    if (!workTypeBreakdown[e.workType]) {
      workTypeBreakdown[e.workType] = { qty: 0, uom: e.uom, count: 0 };
    }
    workTypeBreakdown[e.workType].qty += Number(e.quantity) || 0;
    workTypeBreakdown[e.workType].count += 1;

    // Worker breakdown
    const worker = e.userName || 'Unknown';
    if (!workerBreakdown[worker]) {
      workerBreakdown[worker] = { totalEntries: 0, done: 0, pending: 0, meterQty: 0, numQty: 0 };
    }
    workerBreakdown[worker].totalEntries += 1;
    if (e.status === 'Done') workerBreakdown[worker].done += 1;
    else workerBreakdown[worker].pending += 1;
    if (e.uom === 'meter') workerBreakdown[worker].meterQty += Number(e.quantity) || 0;
    else workerBreakdown[worker].numQty += Number(e.quantity) || 0;

    // Date breakdown
    const { dateStr } = parseEntryDateTime(e);
    if (!dateBreakdown[dateStr]) {
      dateBreakdown[dateStr] = { totalEntries: 0, done: 0, pending: 0, meterQty: 0, numQty: 0 };
    }
    dateBreakdown[dateStr].totalEntries += 1;
    if (e.status === 'Done') dateBreakdown[dateStr].done += 1;
    else dateBreakdown[dateStr].pending += 1;
    if (e.uom === 'meter') dateBreakdown[dateStr].meterQty += Number(e.quantity) || 0;
    else dateBreakdown[dateStr].numQty += Number(e.quantity) || 0;
  });

  return {
    totalEntries: entries.length,
    totalMeterQty,
    totalNumberQty,
    doneCount,
    pendingCount,
    workTypeBreakdown,
    workerBreakdown,
    dateBreakdown,
  };
}

/**
 * Auto-fits columns in worksheet
 */
function autoFitColumns(ws: XLSX.WorkSheet, data: any[]) {
  if (!data || data.length === 0) return;
  const colWidths: { [key: string]: number } = {};

  // Headers
  Object.keys(data[0]).forEach((key) => {
    colWidths[key] = Math.max(key.length, 10);
  });

  // Data rows
  data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      const val = row[key] ? String(row[key]) : '';
      colWidths[key] = Math.max(colWidths[key] || 10, Math.min(val.length + 2, 45));
    });
  });

  ws['!cols'] = Object.keys(colWidths).map((key) => ({ wch: colWidths[key] }));
}

/**
 * Main export function to generate and download Excel (.xlsx) file
 */
export function exportCivilWorkToExcel(
  allEntries: WorkEntry[],
  options: ExcelExportOptions = {}
): { success: boolean; rowCount: number; fileName: string; message?: string } {
  const filtered = filterEntriesForExport(allEntries, options);

  if (filtered.length === 0) {
    return {
      success: false,
      rowCount: 0,
      fileName: '',
      message: 'No work entries match the selected date or worker criteria.',
    };
  }

  // Sort chronologically (newest first or oldest first)
  const sorted = [...filtered].sort((a, b) => {
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return timeB - timeA;
  });

  const wb = XLSX.utils.book_new();
  const summary = computeSummary(sorted);

  // Generate File Name based on filters
  let nameParts: string[] = ['Civil_Work_Report'];
  if (options.workerFilter && options.workerFilter !== 'ALL') {
    nameParts.push(options.workerFilter.replace(/[^a-zA-Z0-9]/g, '_'));
  }
  if (options.dateFilterType === 'TODAY') {
    nameParts.push('Today');
  } else if (options.dateFilterType === 'CUSTOM_DATE' && options.customDate) {
    nameParts.push(options.customDate);
  } else if (options.dateFilterType === 'DATE_RANGE' && (options.startDate || options.endDate)) {
    nameParts.push(`${options.startDate || 'start'}_to_${options.endDate || 'end'}`);
  } else {
    nameParts.push(new Date().toISOString().split('T')[0]);
  }

  const finalFileName = `${nameParts.join('_')}.xlsx`;

  // Determine export strategy based on groupBy
  const groupBy = options.groupBy || 'multi_tab_master';

  if (groupBy === 'multi_tab_master') {
    // TAB 1: EXECUTIVE SUMMARY
    const summarySheetData: any[] = [
      { 'METRIC': 'REPORT OVERVIEW', 'VALUE': '' },
      { 'METRIC': 'Report Generated At', 'VALUE': new Date().toLocaleString() },
      { 'METRIC': 'Total Work Entries Logged', 'VALUE': summary.totalEntries },
      { 'METRIC': 'Completed Entries (Done)', 'VALUE': `${summary.doneCount} (${((summary.doneCount / summary.totalEntries) * 100).toFixed(1)}%)` },
      { 'METRIC': 'Pending Entries', 'VALUE': `${summary.pendingCount} (${((summary.pendingCount / summary.totalEntries) * 100).toFixed(1)}%)` },
      { 'METRIC': 'Total Linear Work (Meters)', 'VALUE': `${summary.totalMeterQty.toLocaleString()} m` },
      { 'METRIC': 'Total Item Work (Numbers)', 'VALUE': `${summary.totalNumberQty.toLocaleString()} Nos` },
      { 'METRIC': '', 'VALUE': '' },
      { 'METRIC': '--- WORK TYPE QUANTITY BREAKDOWN ---', 'VALUE': '' },
    ];

    Object.entries(summary.workTypeBreakdown).forEach(([name, data]) => {
      summarySheetData.push({
        'METRIC': name,
        'VALUE': `${data.qty.toLocaleString()} ${data.uom} (${data.count} logs)`,
      });
    });

    const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
    autoFitColumns(wsSummary, summarySheetData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // TAB 2: USER-WISE SUMMARY TABLE
    const workerSheetData = Object.entries(summary.workerBreakdown).map(([workerName, stats], idx) => ({
      'Sr No': idx + 1,
      'Field Worker Name': workerName,
      'Total Logs': stats.totalEntries,
      'Completed (Done)': stats.done,
      'Pending': stats.pending,
      'Total Meters (m)': stats.meterQty,
      'Total Numbers (Nos)': stats.numQty,
      'Completion Rate': `${((stats.done / stats.totalEntries) * 100).toFixed(1)}%`,
    }));

    // Add totals row for worker sheet
    if (workerSheetData.length > 0) {
      workerSheetData.push({
        'Sr No': '' as any,
        'Field Worker Name': 'TOTAL TEAM SUMMARY',
        'Total Logs': summary.totalEntries,
        'Completed (Done)': summary.doneCount,
        'Pending': summary.pendingCount,
        'Total Meters (m)': summary.totalMeterQty,
        'Total Numbers (Nos)': summary.totalNumberQty,
        'Completion Rate': `${((summary.doneCount / summary.totalEntries) * 100).toFixed(1)}%`,
      });
    }

    const wsWorkers = XLSX.utils.json_to_sheet(workerSheetData);
    autoFitColumns(wsWorkers, workerSheetData);
    XLSX.utils.book_append_sheet(wb, wsWorkers, 'Worker-wise Summary');

    // TAB 3: DATE-WISE SUMMARY TABLE
    const dateSheetData = Object.entries(summary.dateBreakdown)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, stats], idx) => ({
        'Sr No': idx + 1,
        'Date': date,
        'Total Logs': stats.totalEntries,
        'Done Logs': stats.done,
        'Pending Logs': stats.pending,
        'Meters Done (m)': stats.meterQty,
        'Numbers Done (Nos)': stats.numQty,
      }));

    const wsDates = XLSX.utils.json_to_sheet(dateSheetData);
    autoFitColumns(wsDates, dateSheetData);
    XLSX.utils.book_append_sheet(wb, wsDates, 'Date-wise Summary');

    // TAB 4: COMPLETE DETAILED WORK LOGS
    const detailedData = sorted.map((entry, idx) => buildRowData(entry, idx));
    const wsDetailed = XLSX.utils.json_to_sheet(detailedData);
    autoFitColumns(wsDetailed, detailedData);
    XLSX.utils.book_append_sheet(wb, wsDetailed, 'All Detailed Logs');

  } else if (groupBy === 'worker') {
    // MASTER SHEET: Summary + Separate tab for each worker
    const workerNames = Object.keys(summary.workerBreakdown);

    // Summary tab
    const workerSheetData = workerNames.map(([workerName, stats]: any, idx) => ({
      'Sr No': idx + 1,
      'Field Worker Name': workerName,
      'Total Logs': stats.totalEntries,
      'Done': stats.done,
      'Pending': stats.pending,
      'Total Meters (m)': stats.meterQty,
      'Total Numbers (Nos)': stats.numQty,
    }));
    const wsSummary = XLSX.utils.json_to_sheet(workerSheetData);
    autoFitColumns(wsSummary, workerSheetData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Team Summary');

    // Separate tab for each worker (limit name to 30 chars for Excel tab rules)
    workerNames.forEach((wName) => {
      const userEntries = sorted.filter((e) => (e.userName || 'Unknown') === wName);
      const rows = userEntries.map((e, idx) => buildRowData(e, idx));
      const cleanTabName = wName.replace(/[:\\/?*[\]]/g, '').substring(0, 28) || 'Worker';
      const wsUser = XLSX.utils.json_to_sheet(rows);
      autoFitColumns(wsUser, rows);
      XLSX.utils.book_append_sheet(wb, wsUser, cleanTabName);
    });

  } else if (groupBy === 'date') {
    // MASTER SHEET: Date Summary + Separate tab for each date
    const dates = Object.keys(summary.dateBreakdown).sort((a, b) => b.localeCompare(a));

    const dateSheetData = dates.map((d, idx) => {
      const stats = summary.dateBreakdown[d];
      return {
        'Sr No': idx + 1,
        'Date': d,
        'Total Entries': stats.totalEntries,
        'Done': stats.done,
        'Pending': stats.pending,
        'Meters': stats.meterQty,
        'Numbers': stats.numQty,
      };
    });
    const wsSummary = XLSX.utils.json_to_sheet(dateSheetData);
    autoFitColumns(wsSummary, dateSheetData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Date Summary');

    // Add sheets for the most recent dates (up to 15 distinct dates)
    dates.slice(0, 15).forEach((d) => {
      const dayEntries = sorted.filter((e) => parseEntryDateTime(e).dateStr === d);
      const rows = dayEntries.map((e, idx) => buildRowData(e, idx));
      const cleanTabName = d.substring(5, 10); // MM-DD
      const wsDate = XLSX.utils.json_to_sheet(rows);
      autoFitColumns(wsDate, rows);
      XLSX.utils.book_append_sheet(wb, wsDate, `Date_${cleanTabName}`);
    });

  } else {
    // Single Sheet Detailed Dump
    const detailedData = sorted.map((entry, idx) => buildRowData(entry, idx));
    const ws = XLSX.utils.json_to_sheet(detailedData);
    autoFitColumns(ws, detailedData);
    XLSX.utils.book_append_sheet(wb, ws, 'Work Logs');
  }

  // Trigger download in browser
  XLSX.writeFile(wb, finalFileName);

  return {
    success: true,
    rowCount: sorted.length,
    fileName: finalFileName,
  };
}
