import PptxGenJS from 'pptxgenjs';
import { WorkEntry } from '../types';
import { parseEntryDateTime } from './excelExporter';

export interface PptExportOptions {
  fileName?: string;
  workerFilter?: string; // 'ALL' or specific worker name
  dateFilterType?: 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM_DATE' | 'DATE_RANGE';
  customDate?: string; // YYYY-MM-DD
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
  statusFilter?: 'ALL' | 'Pending' | 'Done';
  includeSummarySlide?: boolean;
}

export function filterEntriesForPpt(entries: WorkEntry[], options: PptExportOptions): WorkEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  return entries.filter((entry) => {
    // 1. Worker filter (case-insensitive)
    if (options.workerFilter && options.workerFilter !== 'ALL') {
      const target = options.workerFilter.trim().toLowerCase();
      const current = (entry.userName || '').trim().toLowerCase();
      if (current !== target && entry.uid !== options.workerFilter) return false;
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

function addEntrySlide(pptx: PptxGenJS, entry: WorkEntry, index: number, total: number) {
  const slide = pptx.addSlide();
  slide.background = { color: 'F5F5F4' }; // Stone-100 background

  const { dateStr, timeStr } = parseEntryDateTime(entry);
  const isDone = entry.status === 'Done';
  const titleText = entry.route || entry.workType || 'Civil Site Work Log';
  const photos = (entry.photos || []).filter(Boolean);

  // Top Header Banner
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.72,
    fill: { color: '1C1917' },
  });

  // Amber Accent Bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0.72,
    w: 10,
    h: 0.05,
    fill: { color: 'F59E0B' },
  });

  // Log Number & Title in Header
  slide.addText(`LOG #${index + 1} OF ${total}  •  ${titleText}`, {
    x: 0.3,
    y: 0.08,
    w: 7.4,
    h: 0.34,
    fontSize: 15,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial',
  });

  slide.addText(
    `Field Executive: ${entry.userName || 'Field Executive'}   |   Work Date: ${dateStr}   |   Logged Time: ${timeStr}`,
    {
      x: 0.3,
      y: 0.4,
      w: 7.4,
      h: 0.25,
      fontSize: 9.5,
      color: 'D6D3D1',
      fontFace: 'Arial',
    }
  );

  // Status Badge in Header Right
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 8.15,
    y: 0.16,
    w: 1.55,
    h: 0.4,
    fill: { color: isDone ? '059669' : 'EA580C' },
    rectRadius: 0.08,
  });

  slide.addText(isDone ? 'STATUS: DONE' : 'STATUS: PENDING', {
    x: 8.15,
    y: 0.16,
    w: 1.55,
    h: 0.4,
    fontSize: 10,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
    fontFace: 'Arial',
  });

  // =========================================================================
  // TOP SECTION: SITE PHOTOS (Photos placed prominently at the top)
  // =========================================================================
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.3,
    y: 0.88,
    w: 9.4,
    h: 2.38,
    fill: { color: 'FFFFFF' },
    line: { color: 'E7E5E4', width: 1 },
    rectRadius: 0.06,
  });

  slide.addText(
    `SITE WORK PHOTOS (${photos.length} ${photos.length === 1 ? 'PHOTO' : 'PHOTOS'} ATTACHED)`,
    {
      x: 0.45,
      y: 0.94,
      w: 9.1,
      h: 0.24,
      fontSize: 9.5,
      bold: true,
      color: 'B45309',
      fontFace: 'Arial',
    }
  );

  if (photos.length > 0) {
    const maxPhotosOnSlide = Math.min(photos.length, 4);
    const availableWidth = 9.1;
    const gap = 0.16;
    const cardW = (availableWidth - gap * (maxPhotosOnSlide - 1)) / maxPhotosOnSlide;
    const cardH = 1.92;
    const startX = 0.45;
    const startY = 1.22;

    for (let i = 0; i < maxPhotosOnSlide; i++) {
      const photoUrl = photos[i];
      const itemX = startX + i * (cardW + gap);

      // Photo frame background
      slide.addShape(pptx.ShapeType.rect, {
        x: itemX,
        y: startY,
        w: cardW,
        h: cardH,
        fill: { color: '1C1917' },
        line: { color: 'D6D3D1', width: 1 },
      });

      try {
        const imgProps: PptxGenJS.ImageProps = {
          x: itemX + 0.04,
          y: startY + 0.04,
          w: cardW - 0.08,
          h: cardH - 0.28,
          sizing: { type: 'contain', w: cardW - 0.08, h: cardH - 0.28 },
        };

        if (photoUrl.startsWith('data:')) {
          imgProps.data = photoUrl;
        } else {
          imgProps.path = photoUrl;
        }

        slide.addImage(imgProps);
      } catch (imgErr) {
        console.warn('Could not embed photo in PPT slide:', imgErr);
      }

      // Photo caption bar
      slide.addText(`Photo #${i + 1}`, {
        x: itemX,
        y: startY + cardH - 0.24,
        w: cardW,
        h: 0.22,
        fontSize: 8.5,
        bold: true,
        color: 'F59E0B',
        align: 'center',
        valign: 'middle',
        fontFace: 'Arial',
      });
    }
  } else {
    slide.addText('No Site Photos Attached for This Work Log', {
      x: 0.45,
      y: 1.75,
      w: 9.1,
      h: 0.5,
      fontSize: 11,
      italic: true,
      color: '78716C',
      align: 'center',
      valign: 'middle',
      fontFace: 'Arial',
    });
  }

  // =========================================================================
  // BOTTOM SECTION: COMPLETE FIELD LOG DETAILS TABLE
  // =========================================================================
  const fromLoc = entry.locationFrom || entry.location || '—';
  const toLoc = entry.locationTo || '—';
  const routeDisplay = entry.route || entry.workType || '—';
  const workTypeDisplay = entry.workType || 'Site Work';
  const qtyDisplay = `${entry.quantity ?? 1} ${entry.uom || 'meter'}`;
  const gpsDisplay = entry.latLong || 'Not recorded';
  const remarkDisplay = entry.remark || 'No additional remarks provided.';

  const rows: PptxGenJS.TableRow[] = [
    [
      {
        text: 'Field Executive',
        options: { bold: true, fill: { color: 'F5F5F4' }, color: '44403C', fontSize: 9.5 },
      },
      {
        text: entry.userName || 'Field Executive',
        options: { bold: true, fill: { color: 'FFFFFF' }, color: '1C1917', fontSize: 10 },
      },
      {
        text: 'Work Date & Time',
        options: { bold: true, fill: { color: 'F5F5F4' }, color: '44403C', fontSize: 9.5 },
      },
      {
        text: `${dateStr} (Logged: ${timeStr})`,
        options: { fill: { color: 'FFFFFF' }, color: '1C1917', fontSize: 9.5 },
      },
    ],
    [
      {
        text: 'Route Name',
        options: { bold: true, fill: { color: 'F5F5F4' }, color: '44403C', fontSize: 9.5 },
      },
      {
        text: routeDisplay,
        options: { bold: true, fill: { color: 'FFFFFF' }, color: 'B45309', fontSize: 10 },
      },
      {
        text: 'Work Type & Qty',
        options: { bold: true, fill: { color: 'F5F5F4' }, color: '44403C', fontSize: 9.5 },
      },
      {
        text: `${workTypeDisplay}  •  ${qtyDisplay}`,
        options: { bold: true, fill: { color: 'FFFFFF' }, color: '1C1917', fontSize: 10 },
      },
    ],
    [
      {
        text: 'From → To Location',
        options: { bold: true, fill: { color: 'F5F5F4' }, color: '44403C', fontSize: 9.5 },
      },
      {
        text: `${fromLoc}  →  ${toLoc}`,
        options: { fill: { color: 'FFFFFF' }, color: '1C1917', fontSize: 9.5 },
      },
      {
        text: 'GPS Coordinates',
        options: { bold: true, fill: { color: 'F5F5F4' }, color: '44403C', fontSize: 9.5 },
      },
      {
        text: gpsDisplay,
        options: { fill: { color: 'FFFFFF' }, color: '1C1917', fontSize: 9 },
      },
    ],
    [
      {
        text: 'Site Remarks',
        options: { bold: true, fill: { color: 'F5F5F4' }, color: '44403C', fontSize: 9.5 },
      },
      {
        text: remarkDisplay,
        options: { colspan: 3, fill: { color: 'FFFFFF' }, color: '292524', fontSize: 9.5 },
      },
    ],
  ];

  slide.addTable(rows, {
    x: 0.3,
    y: 3.36,
    w: 9.4,
    colW: [1.65, 3.05, 1.65, 3.05],
    rowH: [0.44, 0.44, 0.46, 0.56],
    border: { type: 'solid', color: 'D6D3D1', pt: 0.75 },
    fontFace: 'Arial',
    valign: 'middle',
    margin: [3, 6, 3, 6],
  });
}

export async function exportCivilWorkToPpt(
  entries: WorkEntry[],
  options: PptExportOptions = {}
): Promise<{ success: boolean; count: number; fileName: string; message?: string }> {
  const filtered = filterEntriesForPpt(entries, options);

  if (filtered.length === 0) {
    return {
      success: false,
      count: 0,
      fileName: '',
      message: 'No work entries match the selected filters.',
    };
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Civil Site Work Logger';
  pptx.company = 'Civil Engineering Site Operations';
  pptx.subject = 'Daily Site Progress Presentation';
  pptx.title = 'Civil Site Work Progress Report';

  // Calculate summary stats
  let totalMeters = 0;
  let totalNos = 0;
  let doneCount = 0;
  let pendingCount = 0;
  const workerSet = new Set<string>();

  filtered.forEach((e) => {
    if (e.uom === 'meter') totalMeters += Number(e.quantity) || 0;
    else totalNos += Number(e.quantity) || 0;
    if (e.status === 'Done') doneCount++;
    else pendingCount++;
    if (e.userName) workerSet.add(e.userName.trim());
  });

  // =========================================================================
  // SLIDE 1: EXECUTIVE SUMMARY SLIDE (if enabled)
  // =========================================================================
  if (options.includeSummarySlide !== false) {
    const summarySlide = pptx.addSlide();
    summarySlide.background = { color: 'F5F5F4' };

    // Header
    summarySlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.85,
      fill: { color: '1C1917' },
    });
    summarySlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0.85,
      w: 10,
      h: 0.06,
      fill: { color: 'F59E0B' },
    });

    summarySlide.addText('CIVIL SITE WORK LOGGER — PROGRESS REPORT', {
      x: 0.35,
      y: 0.12,
      w: 9.3,
      h: 0.36,
      fontSize: 18,
      bold: true,
      color: 'FFFFFF',
      fontFace: 'Arial',
    });

    const workerLabel =
      options.workerFilter && options.workerFilter !== 'ALL'
        ? `Executive: ${options.workerFilter}`
        : `All Executives (${workerSet.size})`;
    const dateLabel = options.dateFilterType || 'ALL DATES';

    summarySlide.addText(
      `${workerLabel}   |   Date Scope: ${dateLabel}   |   Generated: ${new Date().toLocaleString()}`,
      {
        x: 0.35,
        y: 0.48,
        w: 9.3,
        h: 0.26,
        fontSize: 10,
        color: 'FCD34D',
        fontFace: 'Arial',
      }
    );

    // 4 Metric Cards
    const metrics = [
      { label: 'TOTAL FIELD LOGS', value: `${filtered.length}`, sub: `${workerSet.size} Executive(s)`, color: '1C1917' },
      { label: 'TOTAL METERS (m)', value: `${totalMeters.toLocaleString()} m`, sub: 'Linear Progress', color: 'B45309' },
      { label: 'TOTAL UNITS (Nos)', value: `${totalNos.toLocaleString()} Nos`, sub: 'Discrete Installations', color: '334155' },
      { label: 'COMPLETION STATUS', value: `${doneCount} Done`, sub: `${pendingCount} Pending`, color: '059669' },
    ];

    metrics.forEach((m, idx) => {
      const cardX = 0.35 + idx * 2.36;
      summarySlide.addShape(pptx.ShapeType.roundRect, {
        x: cardX,
        y: 1.08,
        w: 2.22,
        h: 1.05,
        fill: { color: 'FFFFFF' },
        line: { color: 'D6D3D1', width: 1 },
        rectRadius: 0.06,
      });

      summarySlide.addText(m.label, {
        x: cardX + 0.12,
        y: 1.14,
        w: 1.98,
        h: 0.22,
        fontSize: 8.5,
        bold: true,
        color: '78716C',
        fontFace: 'Arial',
      });

      summarySlide.addText(m.value, {
        x: cardX + 0.12,
        y: 1.38,
        w: 1.98,
        h: 0.42,
        fontSize: 17,
        bold: true,
        color: m.color,
        fontFace: 'Arial',
      });

      summarySlide.addText(m.sub, {
        x: cardX + 0.12,
        y: 1.82,
        w: 1.98,
        h: 0.22,
        fontSize: 8.5,
        color: '57534E',
        fontFace: 'Arial',
      });
    });

    // Overview Table (top 8 entries on summary slide)
    const tableHeader: PptxGenJS.TableCell[] = [
      { text: '#', options: { bold: true, fill: { color: '292524' }, color: 'FFFFFF', fontSize: 9 } },
      { text: 'Date', options: { bold: true, fill: { color: '292524' }, color: 'FFFFFF', fontSize: 9 } },
      { text: 'Field Executive', options: { bold: true, fill: { color: '292524' }, color: 'FFFFFF', fontSize: 9 } },
      { text: 'Route / Work Type', options: { bold: true, fill: { color: '292524' }, color: 'FFFFFF', fontSize: 9 } },
      { text: 'Qty', options: { bold: true, fill: { color: '292524' }, color: 'FFFFFF', fontSize: 9 } },
      { text: 'Status', options: { bold: true, fill: { color: '292524' }, color: 'FFFFFF', fontSize: 9 } },
      { text: 'Photos', options: { bold: true, fill: { color: '292524' }, color: 'FFFFFF', fontSize: 9 } },
    ];

    const previewRows: PptxGenJS.TableRow[] = [tableHeader];
    filtered.slice(0, 8).forEach((entry, idx) => {
      const { dateStr } = parseEntryDateTime(entry);
      const rowFill = idx % 2 === 0 ? 'FFFFFF' : 'F5F5F4';
      previewRows.push([
        { text: `${idx + 1}`, options: { fill: { color: rowFill }, fontSize: 8.5, color: '44403C' } },
        { text: dateStr, options: { fill: { color: rowFill }, fontSize: 8.5, color: '1C1917' } },
        { text: entry.userName || 'Executive', options: { fill: { color: rowFill }, fontSize: 8.5, bold: true, color: '1C1917' } },
        { text: entry.route || entry.workType || 'Site Work', options: { fill: { color: rowFill }, fontSize: 8.5, color: 'B45309', bold: true } },
        { text: `${entry.quantity ?? 1} ${entry.uom || 'm'}`, options: { fill: { color: rowFill }, fontSize: 8.5, color: '1C1917' } },
        {
          text: entry.status,
          options: {
            fill: { color: rowFill },
            fontSize: 8.5,
            bold: true,
            color: entry.status === 'Done' ? '059669' : 'EA580C',
          },
        },
        { text: `${(entry.photos || []).length}`, options: { fill: { color: rowFill }, fontSize: 8.5, color: '44403C' } },
      ]);
    });

    summarySlide.addTable(previewRows, {
      x: 0.35,
      y: 2.28,
      w: 9.3,
      colW: [0.45, 1.15, 1.85, 3.25, 0.95, 0.9, 0.75],
      border: { type: 'solid', color: 'D6D3D1', pt: 0.5 },
      fontFace: 'Arial',
      valign: 'middle',
      margin: [3, 5, 3, 5],
    });
  }

  // =========================================================================
  // INDIVIDUAL SLIDES FOR EACH FIELD ENTRY (WITH PHOTOS AT TOP)
  // =========================================================================
  filtered.forEach((entry, index) => {
    addEntrySlide(pptx, entry, index, filtered.length);
  });

  const dateTag = new Date().toISOString().split('T')[0];
  const workerTag =
    options.workerFilter && options.workerFilter !== 'ALL'
      ? `_${options.workerFilter.replace(/\s+/g, '_')}`
      : '_Team';
  const finalFileName = options.fileName || `Civil_Site_Report${workerTag}_${dateTag}.pptx`;

  await pptx.writeFile({ fileName: finalFileName });

  return {
    success: true,
    count: filtered.length,
    fileName: finalFileName,
  };
}

export async function exportSingleEntryToPpt(entry: WorkEntry): Promise<string> {
  const safeWorker = (entry.userName || 'Executive').replace(/\s+/g, '_');
  const safeDate = entry.date || new Date().toISOString().split('T')[0];
  const fileName = `Site_Log_${safeWorker}_${safeDate}.pptx`;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = entry.userName || 'Field Executive';
  pptx.title = entry.route || entry.workType || 'Site Work Log';

  addEntrySlide(pptx, entry, 0, 1);

  await pptx.writeFile({ fileName });
  return fileName;
}
