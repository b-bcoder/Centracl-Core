
import { ParsedFile, FieldSelection } from '../types';

export const getFileNameFromPath = (path: string): string => {
  return path.split(/[\\\/]/).pop() || '';
};

export const parseSkyrimFile = (path: string): ParsedFile => {
  const filename = getFileNameFromPath(path);
  const dotIndex = filename.lastIndexOf('.');
  const extension = filename.substring(dotIndex + 1);
  const nameWithoutExt = filename.substring(0, dotIndex);
  const parts = nameWithoutExt.split('_');
  
  let date = 'Onbekend';
  let time = 'Onbekend';
  
  const timestampPart = parts[6];
  if (timestampPart && timestampPart.length >= 12) {
    const y = timestampPart.substring(0, 4);
    const m = timestampPart.substring(4, 6);
    const d = timestampPart.substring(6, 8);
    const hh = timestampPart.substring(8, 10);
    const mm = timestampPart.substring(10, 12);
    const ss = timestampPart.substring(12, 14) || '00';
    date = `${d}-${m}-${y}`;
    time = `${hh}:${mm}:${ss}`;
  }

  return {
    originalPath: path,
    filename,
    baseName: parts[4] || nameWithoutExt,
    date,
    time,
    extension,
    isSkyrim: true,
    skyrimSaveType: parts[0],
    skyrimProfile1: parts[1],
    skyrimProfile2: parts[2],
    skyrimProfile3: parts[3],
    skyrimLocation: parts[4],
    skyrimSaveNr: parts[5]
  };
};

const getSortableTimestamp = (file: ParsedFile): number => {
  if (file.date === 'Onbekend') return 0;
  const [d, m, y] = file.date.split('-').map(Number);
  const timeParts = file.time.split(':').map(Number);
  const hh = timeParts[0] || 0;
  const mm = timeParts[1] || 0;
  const ss = timeParts[2] || 0;
  return new Date(y, m - 1, d, hh, mm, ss).getTime();
};

const getActiveColumns = (selection: FieldSelection) => {
  const cols: { key: keyof ParsedFile; label: string }[] = [];
  
  if (selection.showSkyrimSaveType) cols.push({ key: 'skyrimSaveType', label: 'Save Type' });
  if (selection.showSkyrimProfile1) cols.push({ key: 'skyrimProfile1', label: 'Profiel-1' });
  if (selection.showSkyrimProfile2) cols.push({ key: 'skyrimProfile2', label: 'P-2' });
  if (selection.showSkyrimProfile3) cols.push({ key: 'skyrimProfile3', label: 'Profiel-3' });
  if (selection.showSkyrimLocation) cols.push({ key: 'skyrimLocation', label: 'Locatie' });
  if (selection.showSkyrimSaveNr) cols.push({ key: 'skyrimSaveNr', label: 'Save Nr.' });
  
  if (selection.showDate) cols.push({ key: 'date', label: 'Datum' });
  if (selection.showTime) cols.push({ key: 'time', label: 'Tijdstempel' });
  
  return cols;
};

export const generateSkyrimTextOutput = (parsedFiles: ParsedFile[], selection: FieldSelection): string => {
  if (parsedFiles.length === 0) return '';
  let processedFiles = [...parsedFiles];
  if (selection.removeDuplicates) {
    const seen = new Set();
    processedFiles = processedFiles.filter(file => !seen.has(file.originalPath) && seen.add(file.originalPath));
  }
  
  if (selection.sortOption === 'oldest') {
    processedFiles.sort((a, b) => getSortableTimestamp(a) - getSortableTimestamp(b));
  } else if (selection.sortOption === 'newest') {
    processedFiles.sort((a, b) => getSortableTimestamp(b) - getSortableTimestamp(a));
  } else {
    // Voor Skyrim sorteren we standaard op Save Nr als we op naam sorteren
    processedFiles.sort((a, b) => (a.skyrimSaveNr || '').localeCompare(b.skyrimSaveNr || ''));
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

export const generateSkyrimExcelOutput = (parsedFiles: ParsedFile[], selection: FieldSelection): string => {
  if (parsedFiles.length === 0) return '';
  let processedFiles = [...parsedFiles];
  if (selection.removeDuplicates) {
    const seen = new Set();
    processedFiles = processedFiles.filter(f => !seen.has(f.originalPath) && seen.add(f.originalPath));
  }
  
  if (selection.sortOption === 'oldest') {
    processedFiles.sort((a, b) => getSortableTimestamp(a) - getSortableTimestamp(b));
  } else if (selection.sortOption === 'newest') {
    processedFiles.sort((a, b) => getSortableTimestamp(b) - getSortableTimestamp(a));
  } else {
    processedFiles.sort((a, b) => (a.skyrimSaveNr || '').localeCompare(b.skyrimSaveNr || ''));
  }

  const activeColumns = getActiveColumns(selection);
  const header = activeColumns.map(c => c.label).join('\t');
  const rows = processedFiles.map(file => {
    return activeColumns.map(col => String(file[col.key] ?? '-')).join('\t');
  });

  return [header, ...rows].join('\n');
};
