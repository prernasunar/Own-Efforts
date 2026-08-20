import { WorkEntry } from '../types';

export function formatSingleEntryText(entry: WorkEntry): string {
  const dateStr = entry.createdAt?.toDate 
    ? entry.createdAt.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString();

  const lines = [
    `🏗️ *CIVIL WORK SITE LOG*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👷 *Worker:* ${entry.userName}`,
    `📌 *Work Type:* ${entry.workType}`,
    `📊 *Quantity:* ${entry.quantity} ${entry.uom}`,
    `🚦 *Status:* ${entry.status === 'Done' ? '✅ Done' : '⏳ Pending'}`,
    `📍 *From:* ${entry.locationFrom || 'N/A'}`,
    `📍 *To:* ${entry.locationTo || 'N/A'}`,
    entry.remark ? `📝 *Remark:* ${entry.remark}` : '',
    entry.photos && entry.photos.length > 0 ? `📸 *Photos:* ${entry.photos.length} site photo(s) attached` : '',
    `⏱️ *Time:* ${dateStr}`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean);

  return lines.join('\n');
}

export function formatTeamReportText(entries: WorkEntry[], filterInfo?: string): string {
  const now = new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const total = entries.length;
  const doneCount = entries.filter((e) => e.status === 'Done').length;
  const pendingCount = entries.filter((e) => e.status === 'Pending').length;

  const header = [
    `📋 *CIVIL SITE TEAM DAILY REPORT*`,
    `📅 *Date:* ${now}`,
    filterInfo ? `🔍 *Filter:* ${filterInfo}` : '',
    `📊 *Summary:* Total ${total} | ✅ Done: ${doneCount} | ⏳ Pending: ${pendingCount}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    '',
  ].filter(Boolean).join('\n');

  if (entries.length === 0) {
    return `${header}No work entries recorded for this filter.`;
  }

  const entriesText = entries
    .map((e, idx) => {
      const time = e.createdAt?.toDate
        ? e.createdAt.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '';
      return [
        `*#${idx + 1}* [${e.status === 'Done' ? '✅ Done' : '⏳ Pending'}] *${e.workType}*`,
        `👷 ${e.userName} | 📏 ${e.quantity} ${e.uom}`,
        `📍 From: ${e.locationFrom}`,
        `📍 To: ${e.locationTo}`,
        e.remark ? `📝 Remark: ${e.remark}` : '',
        time ? `🕒 ${time}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return `${header}${entriesText}\n\n━━━━━━━━━━━━━━━━━━━━\n_Generated via Civil Site Work Logger_`;
}

export function formatWorkerBatchReportText(entries: WorkEntry[], workerName?: string): string {
  const now = new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const total = entries.length;
  const doneCount = entries.filter((e) => e.status === 'Done').length;
  const pendingCount = entries.filter((e) => e.status === 'Pending').length;
  const totalPhotos = entries.reduce((sum, e) => sum + (e.photos?.length || 0), 0);
  const worker = workerName || entries[0]?.userName || 'Field Worker';

  const header = [
    `🏗️ *CIVIL SITE WORK LOG SUMMARY*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👷 *Logged By:* ${worker}`,
    `📅 *Date:* ${now}`,
    `📊 *Total Works Selected:* ${total} (✅ ${doneCount} Done | ⏳ ${pendingCount} Pending)`,
    totalPhotos > 0 ? `📸 *Total Attached Photos:* ${totalPhotos}` : '',
    `━━━━━━━━━━━━━━━━━━━━`,
    '',
  ].filter(Boolean).join('\n');

  if (entries.length === 0) {
    return `${header}No work items selected.`;
  }

  const itemsList = entries
    .map((e, idx) => {
      const time = e.createdAt?.toDate
        ? e.createdAt.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '';
      const photoNote = e.photos && e.photos.length > 0 ? ` [📸 ${e.photos.length} photo(s)]` : '';
      return [
        `*${idx + 1}.* [${e.status === 'Done' ? '✅ DONE' : '⏳ PENDING'}] *${e.workType}*`,
        `   📏 *Qty:* ${e.quantity} ${e.uom}${photoNote}`,
        `   📍 *From:* ${e.locationFrom || 'N/A'} ➡️ *To:* ${e.locationTo || 'N/A'}`,
        e.remark ? `   📝 *Note:* ${e.remark}` : '',
        time ? `   🕒 *Logged:* ${time}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return `${header}${itemsList}\n\n━━━━━━━━━━━━━━━━━━━━\n_Generated via Civil Site Work Logger_`;
}

export function getWhatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function getTelegramUrl(text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent('https://civilsite.app')}&text=${encodeURIComponent(text)}`;
}
