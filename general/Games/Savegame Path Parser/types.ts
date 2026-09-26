
export type SortOption = 'name' | 'oldest' | 'newest';

export interface ParsedFile {
  originalPath: string;
  filename: string;
  baseName: string;
  date: string;
  time: string;
  extension: string;
  // Skyrim specifieke velden
  skyrimSaveType?: string;
  skyrimProfile1?: string;
  skyrimProfile2?: string;
  skyrimProfile3?: string;
  skyrimLocation?: string;
  skyrimSaveNr?: string;
  isSkyrim: boolean;
}

export interface FieldSelection {
  // Ferocious / Basis toggles
  showName: boolean;
  showDate: boolean;
  showTime: boolean;
  showType: boolean;
  // Skyrim toggles
  showSkyrimSaveType: boolean;
  showSkyrimProfile1: boolean;
  showSkyrimProfile2: boolean;
  showSkyrimProfile3: boolean;
  showSkyrimLocation: boolean;
  showSkyrimSaveNr: boolean;
  // Verwerking
  removeDuplicates: boolean;
  sortOption: SortOption;
}

export interface ParseResult {
  files: ParsedFile[];
  rawOutput: string;
}
