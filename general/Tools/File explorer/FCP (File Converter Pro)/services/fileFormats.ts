import { ConversionTarget } from '../types';

export const getOfficeFormats = (fileName: string): ConversionTarget[] => {
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'docx') return [ConversionTarget.TXT, ConversionTarget.HTML, ConversionTarget.PDF];
  if (extension === 'xlsx') return [ConversionTarget.CSV, ConversionTarget.JSON, ConversionTarget.TXT, ConversionTarget.PDF];
  return [];
};

export const isOfficeDocument = (fileName: string): boolean => getOfficeFormats(fileName).length > 0;