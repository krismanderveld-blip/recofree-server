/**
 * Diary Export — generates a formatted text document from diary entries
 * for sharing with therapists or saving locally.
 *
 * Uses expo-file-system to write the file and expo-sharing to share it.
 * Supports both plain text (.txt) and simple HTML-to-PDF via expo-print (if available).
 */
import { Platform } from 'react-native';

export interface DiaryExportEntry {
  id: string;
  content: string;
  moodTag: string;
  timestamp: string;
  gratitude?: {
    entry1: string;
    entry2: string;
    entry3: string;
  };
}

export interface DiaryExportOptions {
  entries: DiaryExportEntry[];
  userName: string;
  dateRange?: { from: string; to: string };
  includeGratitude?: boolean;
  format: 'txt' | 'html';
}

/**
 * Generate formatted diary text content
 */
export function generateDiaryText(options: DiaryExportOptions): string {
  const { entries, userName, dateRange, includeGratitude = true } = options;

  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════');
  lines.push(`  DAGBOEK — ${userName}`);
  if (dateRange) {
    lines.push(`  Periode: ${dateRange.from} tot ${dateRange.to}`);
  }
  lines.push(`  Geëxporteerd: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`  Aantal entries: ${sorted.length}`);
  lines.push('═══════════════════════════════════════════════');
  lines.push('');

  for (const entry of sorted) {
    const date = entry.timestamp.slice(0, 10);
    const time = entry.timestamp.slice(11, 16);
    lines.push(`┌─────────────────────────────────────────────`);
    lines.push(`│ ${date} ${time}  •  Stemming: ${entry.moodTag || 'niet ingevuld'}`);
    lines.push(`├─────────────────────────────────────────────`);
    lines.push(`│`);

    // Wrap content at ~70 chars
    const contentLines = entry.content.split('\n');
    for (const cl of contentLines) {
      lines.push(`│  ${cl}`);
    }

    if (includeGratitude && entry.gratitude) {
      const g = entry.gratitude;
      if (g.entry1 || g.entry2 || g.entry3) {
        lines.push(`│`);
        lines.push(`│  ✦ Dankbaarheid:`);
        if (g.entry1) lines.push(`│    1. ${g.entry1}`);
        if (g.entry2) lines.push(`│    2. ${g.entry2}`);
        if (g.entry3) lines.push(`│    3. ${g.entry3}`);
      }
    }

    lines.push(`│`);
    lines.push(`└─────────────────────────────────────────────`);
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════');
  lines.push('  Einde dagboek export');
  lines.push('═══════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Generate HTML version for PDF-like rendering
 */
export function generateDiaryHtml(options: DiaryExportOptions): string {
  const { entries, userName, dateRange, includeGratitude = true } = options;
  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, sans-serif; padding: 20px; color: #333; line-height: 1.5; }
  h1 { color: #039BE5; border-bottom: 2px solid #039BE5; padding-bottom: 8px; }
  .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
  .entry { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .entry-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .entry-date { font-weight: 600; color: #039BE5; }
  .entry-mood { background: #f0f0f0; padding: 2px 8px; border-radius: 4px; font-size: 13px; }
  .entry-content { white-space: pre-wrap; }
  .gratitude { margin-top: 12px; padding: 8px 12px; background: #f8fdf8; border-left: 3px solid #22C55E; border-radius: 4px; }
  .gratitude-title { font-weight: 600; color: #22C55E; font-size: 13px; margin-bottom: 4px; }
  .gratitude-item { font-size: 13px; color: #555; }
</style>
</head>
<body>
<h1>Dagboek — ${escapeHtml(userName)}</h1>
<div class="meta">
  ${dateRange ? `Periode: ${dateRange.from} tot ${dateRange.to}<br>` : ''}
  Geëxporteerd: ${new Date().toISOString().slice(0, 10)}<br>
  Aantal entries: ${sorted.length}
</div>
`;

  for (const entry of sorted) {
    const date = entry.timestamp.slice(0, 10);
    const time = entry.timestamp.slice(11, 16);
    html += `<div class="entry">
  <div class="entry-header">
    <span class="entry-date">${date} ${time}</span>
    <span class="entry-mood">${escapeHtml(entry.moodTag || 'niet ingevuld')}</span>
  </div>
  <div class="entry-content">${escapeHtml(entry.content)}</div>`;

    if (includeGratitude && entry.gratitude) {
      const g = entry.gratitude;
      if (g.entry1 || g.entry2 || g.entry3) {
        html += `\n  <div class="gratitude">
    <div class="gratitude-title">✦ Dankbaarheid</div>`;
        if (g.entry1) html += `\n    <div class="gratitude-item">1. ${escapeHtml(g.entry1)}</div>`;
        if (g.entry2) html += `\n    <div class="gratitude-item">2. ${escapeHtml(g.entry2)}</div>`;
        if (g.entry3) html += `\n    <div class="gratitude-item">3. ${escapeHtml(g.entry3)}</div>`;
        html += `\n  </div>`;
      }
    }

    html += `\n</div>\n`;
  }

  html += `</body></html>`;
  return html;
}

/**
 * Export diary entries: write to file and share
 */
export async function exportDiary(options: DiaryExportOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');

    const content = options.format === 'html'
      ? generateDiaryHtml(options)
      : generateDiaryText(options);

    const ext = options.format === 'html' ? 'html' : 'txt';
    const fileName = `dagboek_${options.userName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${ext}`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // On web, trigger download
    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: options.format === 'html' ? 'text/html' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    }

    // On native, use sharing (which allows saving to Files app)
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'Delen is niet beschikbaar op dit apparaat' };
    }

    await Sharing.shareAsync(filePath, {
      mimeType: options.format === 'html' ? 'text/html' : 'text/plain',
      dialogTitle: 'Dagboek exporteren',
      UTI: options.format === 'html' ? 'public.html' : 'public.plain-text',
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Export mislukt' };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
