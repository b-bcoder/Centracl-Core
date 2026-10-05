import * as ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import { ConversionTarget } from '../types';

type DocumentTarget = ConversionTarget.TXT | ConversionTarget.HTML | ConversionTarget.PDF | ConversionTarget.CSV | ConversionTarget.JSON;

const createPdf = (text: string): Blob => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const lines = text.split(/\r?\n/);
  let y = 14;

  for (const line of lines) {
    const wrappedLines = pdf.splitTextToSize(line || ' ', 182);
    for (const wrappedLine of wrappedLines) {
      if (y > 282) {
        pdf.addPage();
        y = 14;
      }
      pdf.text(wrappedLine, 14, y);
      y += 5;
    }
  }

  return pdf.output('blob');
};

const cellToText = (cell: ExcelJS.Cell): string => cell.text ?? '';

const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const convertWorkbook = async (file: File, target: DocumentTarget): Promise<Blob> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheets = workbook.worksheets;
  const cellCount = worksheets.reduce((total, worksheet) => total + worksheet.rowCount * worksheet.columnCount, 0);
  if (cellCount > 1_000_000) throw new Error('Workbook exceeds the 1,000,000-cell conversion limit.');

  if (target === ConversionTarget.CSV) {
    const worksheet = worksheets[0];
    if (!worksheet) throw new Error('The workbook does not contain a worksheet.');
    const rows: string[] = [];
    worksheet.eachRow({ includeEmpty: true }, row => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, cell => values.push(escapeCsv(cellToText(cell))));
      rows.push(values.join(','));
    });
    return new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  const workbookData = worksheets.map(worksheet => ({
    name: worksheet.name,
    rows: Array.from({ length: worksheet.rowCount }, (_, index) => {
      const row = worksheet.getRow(index + 1);
      return Array.from({ length: worksheet.columnCount }, (_unused, columnIndex) => cellToText(row.getCell(columnIndex + 1)));
    }),
  }));

  if (target === ConversionTarget.JSON) {
    return new Blob([JSON.stringify(workbookData, null, 2)], { type: 'application/json;charset=utf-8' });
  }

  const text = workbookData.map(sheet => `${sheet.name}\n${sheet.rows.map(row => row.join('\t')).join('\n')}`).join('\n\n');
  if (target === ConversionTarget.PDF) return createPdf(text);
  return new Blob([text], { type: 'text/plain;charset=utf-8' });
};

export const convertOfficeDocument = async (
  file: File,
  target: DocumentTarget,
  onProgress: (progress: number) => void,
): Promise<Blob> => {
  onProgress(5);
  const extension = file.name.toLowerCase().split('.').pop();

  if (extension === 'docx') {
    if (target === ConversionTarget.CSV || target === ConversionTarget.JSON) {
      throw new Error('DOCX documents can be converted to TXT, HTML or PDF.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = target === ConversionTarget.HTML
      ? await mammoth.convertToHtml({ arrayBuffer })
      : await mammoth.extractRawText({ arrayBuffer });
    onProgress(80);
    const blob = target === ConversionTarget.HTML
      ? new Blob([`<!doctype html><html><head><meta charset="utf-8"></head><body>${result.value}</body></html>`], { type: 'text/html;charset=utf-8' })
      : target === ConversionTarget.PDF
        ? createPdf(result.value)
        : new Blob([result.value], { type: 'text/plain;charset=utf-8' });
    onProgress(100);
    return blob;
  }

  if (extension === 'xlsx') {
    const blob = await convertWorkbook(file, target);
    onProgress(100);
    return blob;
  }

  throw new Error(`Office conversion is not available for .${extension || 'unknown'} files.`);
};

