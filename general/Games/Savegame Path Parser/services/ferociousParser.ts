
import { ParsedFile, FieldSelection } from '../types';

export const getFileNameFromPath = (path: string): string => {
  const clean = path.trim().replace(/^["'](.*)["']$/, '$1');
  return clean.split(/[\\\/]/).pop() || '';
};

export const parseFerociousFile = (path: string): ParsedFile => {
  const cleanPath = path.trim().replace(/^["'](.*)["']$/, '$1');
  const filename = getFileNameFromPath(cleanPath);
  const dotIndex = filename.lastIndexOf('.');
  const extension = dotIndex !== -1 ? filename.substring(dotIndex) : '';
  const nameWithoutExt = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;

  // Regex voor datum (bijv. 16-8-2026, 16-08-2026, 1-1-2026) en tijd (bijv. 20-32, 19-36, 20:32)
  const dateTimeRegex = /(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4})\s+(\d{1,2})[-:](\d{2})(?:[-:](\d{2}))?/;
  const match = nameWithoutExt.match(dateTimeRegex);

  let date = 'Onbekend';
  let time = 'Onbekend';
  let baseName = nameWithoutExt;

  if (match) {
    date = match[1];
    time = match[4] ? `${match[2]}:${match[3]}:${match[4]}` : `${match[2]}:${match[3]}`;
    const matchIndex = match.index ?? -1;
    if (matchIndex >= 0) {
      baseName = nameWithoutExt.substring(0, matchIndex).trim();
      baseName = baseName.replace(/[\s\-_]+$/, '').trim();
    }
  } else {
    // Val terug op alleen datum als tijd niet direct aansluit
    const dateAloneRegex = /(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4})/;
    const dateMatch = nameWithoutExt.match(dateAloneRegex);
    if (dateMatch) {
      date = dateMatch[1];
      const matchIndex = dateMatch.index ?? -1;
      if (matchIndex >= 0) {
        baseName = nameWithoutExt.substring(0, matchIndex).trim();
        baseName = baseName.replace(/[\s\-_]+$/, '').trim();
      }
    }
  }

  return {
    originalPath: cleanPath,
    filename,
    baseName: baseName || nameWithoutExt,
    date,
    time,
    extension: extension.startsWith('.') ? extension.substring(1) : extension,
    isSkyrim: false
  };
};

const getSortableTimestamp = (file: ParsedFile): number => {
  if (file.date === 'Onbekend') return 0;
  const dateParts = file.date.split(/[-\/.]/).map(Number);
  const d = dateParts[0] || 1;
  const m = dateParts[1] || 1;
  const y = dateParts[2] < 100 ? 2000 + dateParts[2] : (dateParts[2] || 1970);
  const timeParts = file.time.replace(/-/g, ':').split(':').map(Number);
  const hh = timeParts[0] || 0;
  const mm = timeParts[1] || 0;
  const ss = timeParts[2] || 0;
  return new Date(y, m - 1, d, hh, mm, ss).getTime();
};

const getActiveColumns = (selection: FieldSelection) => {
  const cols: { key: keyof ParsedFile; label: string }[] = [];
  
  if (selection.showName) cols.push({ key: 'baseName', label: 'Naam' });
  if (selection.showType) cols.push({ key: 'extension', label: 'Type' });
  if (selection.showDate) cols.push({ key: 'date', label: 'Datum' });
  if (selection.showTime) cols.push({ key: 'time', label: 'Tijdstempel' });
  
  return cols;
};

export const generateFerociousTextOutput = (parsedFiles: ParsedFile[], selection: FieldSelection): string => {
  if (parsedFiles.length === 0) return '';
  let processedFiles = [...parsedFiles];
  if (selection.removeDuplicates) {
    const seen = new Set();
    processedFiles = processedFiles.filter(file => !seen.has(file.originalPath) && seen.add(file.originalPath));
  }
  
  if (selection.sortOption === 'name') {
    processedFiles.sort((a, b) => a.baseName.localeCompare(b.baseName));
  } else if (selection.sortOption === 'oldest') {
    processedFiles.sort((a, b) => getSortableTimestamp(a) - getSortableTimestamp(b));
  } else if (selection.sortOption === 'newest') {
    processedFiles.sort((a, b) => getSortableTimestamp(b) - getSortableTimestamp(a));
  }

  const activeColumns = getActiveColumns(selection);
  if (activeColumns.length === 0) return 'Selecteer velden.';

  const colWidths = activeColumns.map(col => {
    let max = col.label.length;
    processedFiles.forEach(f => {
      const val = String(f[col.key] ?? '-');
      if (val.length > max) max = val.length;
    });
    return max + 3;
  });

  const header = activeColumns.map((col, i) => i === 0 ? col.label.padEnd(colWidths[i]) : `| ${col.label.padEnd(colWidths[i])}`).join('');
  const separator = '-'.repeat(header.length);

  const rows = processedFiles.map((file) => {
    return activeColumns.map((col, i) => {
      const val = String(file[col.key] ?? '-');
      return i === 0 ? val.padEnd(colWidths[i]) : `| ${val.padEnd(colWidths[i])}`;
    }).join('');
  });

  return [header, separator, ...rows].join('\n');
};

export const generateFerociousExcelOutput = (parsedFiles: ParsedFile[], selection: FieldSelection): string => {
  if (parsedFiles.length === 0) return '';
  let processedFiles = [...parsedFiles];
  if (selection.removeDuplicates) {
    const seen = new Set();
    processedFiles = processedFiles.filter(f => !seen.has(f.originalPath) && seen.add(f.originalPath));
  }
  
  if (selection.sortOption === 'name') {
    processedFiles.sort((a, b) => a.baseName.localeCompare(b.baseName));
  } else if (selection.sortOption === 'oldest') {
    processedFiles.sort((a, b) => getSortableTimestamp(a) - getSortableTimestamp(b));
  } else if (selection.sortOption === 'newest') {
    processedFiles.sort((a, b) => getSortableTimestamp(b) - getSortableTimestamp(a));
  }

  const activeColumns = getActiveColumns(selection);
  const header = activeColumns.map(c => c.label).join('\t');
  const rows = processedFiles.map(file => {
    return activeColumns.map(col => String(file[col.key] ?? '-')).join('\t');
  });

  return [header, ...rows].join('\n');
};
