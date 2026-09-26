/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  XCircle, 
  ArrowRightLeft, 
  FileCheck, 
  AlertCircle, 
  Trash2, 
  Upload, 
  Loader2, 
  ShieldCheck, 
  Binary, 
  FileText,
  Sparkles,
  Info,
  Copy,
  Download,
  Files,
  Timer
} from 'lucide-react';

type VerificationStatus = 'idle' | 'checking' | 'success' | 'error';
type AppMode = 'text' | 'sha' | 'duplicates';

interface SHAFile {
  id: string;
  name: string;
  size: number;
  hash: string;
  status: 'pending' | 'hashing' | 'done' | 'error';
  progress: number;
}

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>(() => {
    try {
      const saved = localStorage.getItem('file_verificator_active_mode');
      return (saved as AppMode) || 'text';
    } catch {
      return 'text';
    }
  });
  
  // State for Text Mode
  const [sourcePaths, setSourcePaths] = useState('');
  const [destPaths, setDestPaths] = useState('');
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [showSplash, setShowSplash] = useState(false);

  // State for SHA Mode
  const [sourceFiles, setSourceFiles] = useState<SHAFile[]>(() => {
    try {
      const saved = localStorage.getItem('file_verificator_source_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [destFiles, setDestFiles] = useState<SHAFile[]>(() => {
    try {
      const saved = localStorage.getItem('file_verificator_dest_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isHashingSource, setIsHashingSource] = useState(false);
  const [isHashingDest, setIsHashingDest] = useState(false);
  const isHashing = isHashingSource || isHashingDest;

  const [shaStatus, setShaStatus] = useState<VerificationStatus>(() => {
    try {
      const saved = localStorage.getItem('file_verificator_sha_status');
      return (saved as VerificationStatus) || 'idle';
    } catch {
      return 'idle';
    }
  });
  const [shaShowSplash, setShaShowSplash] = useState(false);

  // State for Duplicates Mode
  const [dupFiles, setDupFiles] = useState<SHAFile[]>(() => {
    try {
      const saved = localStorage.getItem('file_verificator_dup_files');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isDupHashing, setIsDupHashing] = useState(false);

  // States voor timers en metingen (SHA-256 Benchmark)
  const [shaHashingTime, setShaHashingTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('file_verificator_sha_hashing_time');
      return saved ? parseFloat(saved) : null;
    } catch {
      return null;
    }
  });
  
  const [shaSourceHashingTime, setShaSourceHashingTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('file_verificator_sha_source_hashing_time');
      return saved ? parseFloat(saved) : null;
    } catch {
      return null;
    }
  });

  const [shaDestHashingTime, setShaDestHashingTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('file_verificator_sha_dest_hashing_time');
      return saved ? parseFloat(saved) : null;
    } catch {
      return null;
    }
  });

  const [shaSourceActiveTime, setShaSourceActiveTime] = useState<number>(0);
  const [shaDestActiveTime, setShaDestActiveTime] = useState<number>(0);

  // Deprecated redundant state kept as fallback compatibility
  const shaActiveTime = shaSourceActiveTime || shaDestActiveTime;

  const [dupHashingTime, setDupHashingTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('file_verificator_dup_hashing_time');
      return saved ? parseFloat(saved) : null;
    } catch {
      return null;
    }
  });
  const [dupActiveTime, setDupActiveTime] = useState<number>(0);

  // Batch progress status indicators
  const [shaSourceProgress, setShaSourceProgress] = useState<{ current: number; total: number } | null>(null);
  const [shaDestProgress, setShaDestProgress] = useState<{ current: number; total: number } | null>(null);
  const [dupProgress, setDupProgress] = useState<{ current: number; total: number } | null>(null);

  // Prevent-overlapping process controls
  const isHashingSourceRef = useRef(false);
  const isHashingDestRef = useRef(false);
  const isDupHashingRef = useRef(false);

  const shaSourceIntervalRef = useRef<any>(null);
  const shaDestIntervalRef = useRef<any>(null);
  const dupIntervalRef = useRef<any>(null);

  // Algemene debounced localStorage saver om mobiele crashes en main-thread blokkering te voorkomen
  const pendingSavesRef = useRef<{ [key: string]: any }>({});
  const saveTimeoutRef = useRef<{ [key: string]: any }>({});

  const debouncedSave = React.useCallback((key: string, value: any) => {
    pendingSavesRef.current[key] = value;
    if (saveTimeoutRef.current[key]) {
      clearTimeout(saveTimeoutRef.current[key]);
    }
    saveTimeoutRef.current[key] = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(pendingSavesRef.current[key]));
      } catch (e) {
        console.warn('Lokalestop-fout', e);
      }
    }, 1500); // 1.5 seconde debounce om schrijfopdrachten drastisch te beperken
  }, []);

  // Sync state changes with localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('file_verificator_active_mode', activeMode);
    } catch (e) {
      console.warn('Lokalestop-fout', e);
    }
  }, [activeMode]);

  React.useEffect(() => {
    debouncedSave('file_verificator_source_files', sourceFiles);
  }, [sourceFiles, debouncedSave]);

  React.useEffect(() => {
    debouncedSave('file_verificator_dest_files', destFiles);
  }, [destFiles, debouncedSave]);

  React.useEffect(() => {
    debouncedSave('file_verificator_dup_files', dupFiles);
  }, [dupFiles, debouncedSave]);

  React.useEffect(() => {
    try {
      localStorage.setItem('file_verificator_sha_status', shaStatus);
    } catch (e) {
      console.warn('Lokalestop-fout', e);
    }
  }, [shaStatus]);

  React.useEffect(() => {
    try {
      if (shaHashingTime !== null) {
        localStorage.setItem('file_verificator_sha_hashing_time', shaHashingTime.toString());
      } else {
        localStorage.removeItem('file_verificator_sha_hashing_time');
      }
    } catch (e) {
      console.warn('Lokalestop-fout', e);
    }
  }, [shaHashingTime]);

  React.useEffect(() => {
    try {
      if (shaSourceHashingTime !== null) {
        localStorage.setItem('file_verificator_sha_source_hashing_time', shaSourceHashingTime.toString());
      } else {
        localStorage.removeItem('file_verificator_sha_source_hashing_time');
      }
    } catch (e) {
      console.warn('Lokalestop-fout', e);
    }
  }, [shaSourceHashingTime]);

  React.useEffect(() => {
    try {
      if (shaDestHashingTime !== null) {
        localStorage.setItem('file_verificator_sha_dest_hashing_time', shaDestHashingTime.toString());
      } else {
        localStorage.removeItem('file_verificator_sha_dest_hashing_time');
      }
    } catch (e) {
      console.warn('Lokalestop-fout', e);
    }
  }, [shaDestHashingTime]);

  React.useEffect(() => {
    try {
      if (dupHashingTime !== null) {
        localStorage.setItem('file_verificator_dup_hashing_time', dupHashingTime.toString());
      } else {
        localStorage.removeItem('file_verificator_dup_hashing_time');
      }
    } catch (e) {
      console.warn('Lokalestop-fout', e);
    }
  }, [dupHashingTime]);

  // Reset SHA status, splash, and times when lists are empty
  React.useEffect(() => {
    if (sourceFiles.length === 0 || destFiles.length === 0) {
      if (shaStatus !== 'idle') {
        setShaStatus('idle');
      }
      setShaShowSplash(false);
    }
  }, [sourceFiles.length, destFiles.length, shaStatus]);

  React.useEffect(() => {
    if (sourceFiles.length === 0) {
      setShaSourceHashingTime(null);
      setShaSourceActiveTime(0);
      setShaSourceProgress(null);
    }
  }, [sourceFiles.length]);

  React.useEffect(() => {
    if (destFiles.length === 0) {
      setShaDestHashingTime(null);
      setShaDestActiveTime(0);
      setShaDestProgress(null);
    }
  }, [destFiles.length]);

  React.useEffect(() => {
    if (dupFiles.length === 0) {
      setDupHashingTime(null);
      setDupActiveTime(0);
      setDupProgress(null);
    }
  }, [dupFiles.length]);

  // Refs for custom file selectors
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const duplicatesInputRef = useRef<HTMLInputElement>(null);

  // States for Drag & Drop overlays
  const [isDragOverSource, setIsDragOverSource] = useState(false);
  const [isDragOverDest, setIsDragOverDest] = useState(false);
  const [isDragOverDup, setIsDragOverDup] = useState(false);

  // Recursive directory and file traversal using Webkit File System Entry API
  const traverseDirectory = async (entry: any): Promise<File[]> => {
    // Keep directory readers in memory to prevent Chrome garbage collection bug
    const activeReaders: any[] = [];

    const traverse = async (e: any): Promise<File[]> => {
      return new Promise((resolve) => {
        if (e.isFile) {
          e.file(
            (file: File) => {
              resolve([file]);
            },
            () => resolve([])
          );
        } else if (e.isDirectory) {
          const dirReader = e.createReader();
          activeReaders.push(dirReader); // Keep referenced during scanning!
          const allEntries: any[] = [];
          
          const readEntries = () => {
            dirReader.readEntries(
              async (results: any[]) => {
                if (results.length === 0) {
                  // Clean up this reader from active references
                  const idx = activeReaders.indexOf(dirReader);
                  if (idx > -1) activeReaders.splice(idx, 1);

                  const filePromises = allEntries.map(child => traverse(child));
                  const filesArrays = await Promise.all(filePromises);
                  resolve(filesArrays.flat());
                } else {
                  allEntries.push(...results);
                  readEntries();
                }
              },
              () => {
                const idx = activeReaders.indexOf(dirReader);
                if (idx > -1) activeReaders.splice(idx, 1);
                resolve([]);
              }
            );
          };
          readEntries();
        } else {
          resolve([]);
        }
      });
    };

    return traverse(entry);
  };

  const handleDropEvent = async (e: React.DragEvent<HTMLDivElement>, type: 'source' | 'dest' | 'duplicates') => {
    e.preventDefault();
    setIsDragOverSource(false);
    setIsDragOverDest(false);
    setIsDragOverDup(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    const promises: Promise<File[]>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          promises.push(traverseDirectory(entry));
        } else {
          // Fallback if webkitGetAsEntry is not supported
          const file = item.getAsFile();
          if (file) {
            promises.push(Promise.resolve([file]));
          }
        }
      }
    }

    const filesArrays = await Promise.all(promises);
    const flattenedFiles = filesArrays.flat();

    if (flattenedFiles.length > 0) {
      if (type === 'duplicates') {
        processDuplicateFiles(flattenedFiles);
      } else {
        processFiles(flattenedFiles, type);
      }
    }
  };

  // Helper to extract filename from path (handles both \ and /)
  const getFileName = (path: string) => {
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1].trim();
  };

  const parsePaths = (input: string) => {
    return input
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  };

  // Helper to calculate human readable size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Cryptographic hashing logic - Geoptimaliseerd met moderne native file.arrayBuffer() API
  const calculateSHA256 = async (file: File, onProgress: (pct: number) => void): Promise<string> => {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Cryptography API (crypto.subtle) is niet beschikbaar in deze browser of context (vereist HTTPS).');
    }
    
    onProgress(10);
    const buffer = await file.arrayBuffer();
    onProgress(50);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    onProgress(90);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    onProgress(100);
    return hashHex;
  };

  // Handle processing files for SHA Mode - Uitgevoerd met yielding timeouts om crash te voorkomen
  const processFiles = async (fileList: FileList | File[], type: 'source' | 'dest') => {
    if (type === 'source') {
      if (isHashingSourceRef.current) return;
      isHashingSourceRef.current = true;
      setIsHashingSource(true);
      setShaSourceHashingTime(null);
      setShaSourceActiveTime(0);
      setShaSourceProgress({ current: 0, total: 0 });
    } else {
      if (isHashingDestRef.current) return;
      isHashingDestRef.current = true;
      setIsHashingDest(true);
      setShaDestHashingTime(null);
      setShaDestActiveTime(0);
      setShaDestProgress({ current: 0, total: 0 });
    }

    const startTime = performance.now();
    if (type === 'source') {
      if (shaSourceIntervalRef.current) clearInterval(shaSourceIntervalRef.current);
      shaSourceIntervalRef.current = setInterval(() => {
        setShaSourceActiveTime((performance.now() - startTime) / 1000);
      }, 50);
    } else {
      if (shaDestIntervalRef.current) clearInterval(shaDestIntervalRef.current);
      shaDestIntervalRef.current = setInterval(() => {
        setShaDestActiveTime((performance.now() - startTime) / 1000);
      }, 50);
    }

    const filesArray = Array.isArray(fileList) ? fileList : Array.from(fileList);
    if (type === 'source') {
      setShaSourceProgress({ current: 0, total: filesArray.length });
    } else {
      setShaDestProgress({ current: 0, total: filesArray.length });
    }
    
    // Initialize file placeholder states
    const initialFiles: SHAFile[] = filesArray.map((f, idx) => ({
      id: `${type}-${Date.now()}-${idx}`,
      name: f.name,
      size: f.size,
      hash: '',
      status: 'pending',
      progress: 0
    }));

    if (type === 'source') {
      setSourceFiles(prev => [...prev, ...initialFiles]);
    } else {
      setDestFiles(prev => [...prev, ...initialFiles]);
    }

    try {
      // Process sequentially to keep browser responsive
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const targetId = initialFiles[i].id;

        const updateState = (hash: string, fileStatus: 'done' | 'error' | 'hashing', progress = 100) => {
          const updater = (prev: SHAFile[]) => prev.map(f => {
            if (f.id === targetId) {
              return { ...f, hash, status: fileStatus, progress };
            }
            return f;
          });

          if (type === 'source') {
            setSourceFiles(updater);
          } else {
            setDestFiles(updater);
          }
        };

        updateState('', 'hashing', 10);
        try {
          const hash = await calculateSHA256(file, (p) => {
            updateState('', 'hashing', p);
          });
          updateState(hash, 'done', 100);
        } catch (err) {
          updateState('', 'error', 0);
        }

        if (type === 'source') {
          setShaSourceProgress({ current: i + 1, total: filesArray.length });
        } else {
          setShaDestProgress({ current: i + 1, total: filesArray.length });
        }

        // ZEER KRITISCH: Geef de browser event-loop 15ms ademruimte om Garbage Collection te draaien
        // en de UI te renderen. Dit voorkomt effectief OOM-crashes bij batches van 70+ bestanden!
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    } finally {
      const finalTime = (performance.now() - startTime) / 1000;
      if (type === 'source') {
        if (shaSourceIntervalRef.current) {
          clearInterval(shaSourceIntervalRef.current);
          shaSourceIntervalRef.current = null;
        }
        setShaSourceActiveTime(finalTime);
        setShaSourceHashingTime(finalTime);
        setShaHashingTime(finalTime);
        setIsHashingSource(false);
        isHashingSourceRef.current = false;
      } else {
        if (shaDestIntervalRef.current) {
          clearInterval(shaDestIntervalRef.current);
          shaDestIntervalRef.current = null;
        }
        setShaDestActiveTime(finalTime);
        setShaDestHashingTime(finalTime);
        setShaHashingTime(finalTime);
        setIsHashingDest(false);
        isHashingDestRef.current = false;
      }
    }
  };

  // Handle processing files for Duplicates Mode - Uitgevoerd met yielding timeouts om crash te voorkomen
  const processDuplicateFiles = async (fileList: FileList | File[]) => {
    if (isDupHashingRef.current) return;
    isDupHashingRef.current = true;
    setIsDupHashing(true);
    setDupHashingTime(null);
    setDupActiveTime(0);
    setDupProgress({ current: 0, total: 0 });
    const startTime = performance.now();

    if (dupIntervalRef.current) clearInterval(dupIntervalRef.current);
    dupIntervalRef.current = setInterval(() => {
      setDupActiveTime((performance.now() - startTime) / 1000);
    }, 50);

    const filesArray = Array.isArray(fileList) ? fileList : Array.from(fileList);
    setDupProgress({ current: 0, total: filesArray.length });
    
    const initialFiles: SHAFile[] = filesArray.map((f, idx) => ({
      id: `dup-${Date.now()}-${idx}`,
      name: f.name,
      size: f.size,
      hash: '',
      status: 'pending',
      progress: 0
    }));

    setDupFiles(prev => [...prev, ...initialFiles]);

    try {
      // Process sequentially to keep browser responsive
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const targetId = initialFiles[i].id;

        const updateState = (hash: string, fileStatus: 'done' | 'error' | 'hashing', progress = 100) => {
          setDupFiles(prev => prev.map(f => {
            if (f.id === targetId) {
              return { ...f, hash, status: fileStatus, progress };
            }
            return f;
          }));
        };

        updateState('', 'hashing', 10);
        try {
          const hash = await calculateSHA256(file, (p) => {
            updateState('', 'hashing', p);
          });
          updateState(hash, 'done', 100);
        } catch (err) {
          updateState('', 'error', 0);
        }

        setDupProgress({ current: i + 1, total: filesArray.length });

        // ZEER KRITISCH: Geef de browser event-loop 15ms ademruimte om Garbage Collection te draaien
        // en de UI te renderen. Dit voorkomt effectief OOM-crashes bij batches van 70+ bestanden!
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    } finally {
      if (dupIntervalRef.current) {
        clearInterval(dupIntervalRef.current);
        dupIntervalRef.current = null;
      }
      const finalTime = (performance.now() - startTime) / 1000;
      setDupActiveTime(finalTime);
      setDupHashingTime(finalTime);
      setIsDupHashing(false);
      isDupHashingRef.current = false;
    }
  };

  // Check matching logic for Text Mode
  const textComparison = useMemo(() => {
    const sourceList = parsePaths(sourcePaths);
    const destList = parsePaths(destPaths);

    const sourceData = sourceList.map(path => ({
      fullPath: path,
      fileName: getFileName(path)
    })).filter(d => d.fileName.length > 0);

    const destData = destList.map(path => ({
      fullPath: path,
      fileName: getFileName(path)
    })).filter(d => d.fileName.length > 0);

    const sourceFreq: Record<string, string[]> = {};
    sourceData.forEach(d => {
      if (!sourceFreq[d.fileName]) sourceFreq[d.fileName] = [];
      sourceFreq[d.fileName].push(d.fullPath);
    });

    const destFreq: Record<string, string[]> = {};
    destData.forEach(d => {
      if (!destFreq[d.fileName]) destFreq[d.fileName] = [];
      destFreq[d.fileName].push(d.fullPath);
    });

    const missingInDest: string[] = [];
    const extraInDest: string[] = [];

    Object.keys(sourceFreq).forEach(name => {
      const sPaths = sourceFreq[name];
      const dPaths = destFreq[name] || [];
      if (sPaths.length > dPaths.length) {
        missingInDest.push(...sPaths.slice(dPaths.length));
      }
    });

    Object.keys(destFreq).forEach(name => {
      const dPaths = destFreq[name];
      const sPaths = sourceFreq[name] || [];
      if (dPaths.length > sPaths.length) {
        extraInDest.push(...dPaths.slice(sPaths.length));
      }
    });

    const countsMatch = sourceList.length === destList.length;
    const namesMatch = missingInDest.length === 0 && extraInDest.length === 0;

    return {
      sourceCount: sourceList.length,
      destCount: destList.length,
      countsMatch,
      namesMatch,
      missingInDest,
      extraInDest,
      isPerfectMatch: countsMatch && namesMatch
    };
  }, [sourcePaths, destPaths]);

  // Check matching logic for SHA Mode
  const shaComparison = useMemo(() => {
    const missing: { name: string; size: number }[] = [];
    const extra: { name: string; size: number }[] = [];
    const mismatches: { name: string; sourceHash: string; destHash: string; size: number }[] = [];
    const matches: { name: string; hash: string; size: number }[] = [];

    // Map by file name
    const sourceMap = new Map<string, SHAFile>();
    sourceFiles.forEach(f => {
      if (f.status === 'done') sourceMap.set(f.name, f);
    });

    const destMap = new Map<string, SHAFile>();
    destFiles.forEach(f => {
      if (f.status === 'done') destMap.set(f.name, f);
    });

    // Verify all source files
    sourceMap.forEach((sFile, name) => {
      const dFile = destMap.get(name);
      if (!dFile) {
        missing.push({ name: sFile.name, size: sFile.size });
      } else if (sFile.hash !== dFile.hash) {
        mismatches.push({
          name: sFile.name,
          sourceHash: sFile.hash,
          destHash: dFile.hash,
          size: sFile.size
        });
      } else {
        matches.push({ name: sFile.name, hash: sFile.hash, size: sFile.size });
      }
    });

    // Identify extra files in destination
    destMap.forEach((dFile, name) => {
      if (!sourceMap.has(name)) {
        extra.push({ name: dFile.name, size: dFile.size });
      }
    });

    const isPerfect = missing.length === 0 && extra.length === 0 && mismatches.length === 0 && matches.length > 0;

    return {
      missing,
      extra,
      mismatches,
      matches,
      isPerfect,
      sourceCount: sourceFiles.filter(f => f.status === 'done').length,
      destCount: destFiles.filter(f => f.status === 'done').length
    };
  }, [sourceFiles, destFiles]);

  const duplicateGroups = useMemo(() => {
    const groups: Record<string, SHAFile[]> = {};
    dupFiles.forEach(f => {
      if (f.status === 'done' && f.hash) {
        if (!groups[f.hash]) groups[f.hash] = [];
        groups[f.hash].push(f);
      }
    });

    const filtered: Record<string, SHAFile[]> = {};
    Object.keys(groups).forEach(hash => {
      if (groups[hash].length > 1) {
        filtered[hash] = groups[hash];
      }
    });
    return filtered;
  }, [dupFiles]);

  const wastedSpace = useMemo(() => {
    let space = 0;
    Object.keys(duplicateGroups).forEach(hash => {
      const groupFiles = duplicateGroups[hash];
      space += groupFiles[0].size * (groupFiles.length - 1);
    });
    return space;
  }, [duplicateGroups]);

  const downloadDuplicateLog = () => {
    const lines: string[] = [];
    lines.push('====================================================');
    lines.push('            DUBBELE BESTANDEN RAPPORT               ');
    lines.push(`            Gegenereerd op: ${new Date().toLocaleString('nl-NL')} `);
    if (dupHashingTime !== null) {
      lines.push(`            Verwerkingstijd (SHA-256): ${dupHashingTime.toFixed(2)}s`);
    }
    lines.push('====================================================\n');
    
    const hashes = Object.keys(duplicateGroups);
    if (hashes.length === 0) {
      lines.push('Geen dubbele bestanden gevonden op basis van SHA-256 handtekeningen.');
    } else {
      lines.push(`Aantal groepen met dubbele bestanden: ${hashes.length}\n`);
      
      hashes.forEach((hash, idx) => {
        const groupFiles = duplicateGroups[hash];
        const fileSize = formatSize(groupFiles[0].size);
        lines.push(`Groep #${idx + 1} (Bestandsgrootte: ${fileSize} | SHA-256: ${hash})`);
        lines.push('----------------------------------------------------');
        groupFiles.forEach((file, fIdx) => {
          lines.push(`  [${fIdx + 1}] ${file.name}`);
        });
        lines.push('');
      });

      lines.push('====================================================');
      lines.push(`Potentieel herwinbare schijfruimte: ${formatSize(wastedSpace)}`);
      lines.push('====================================================');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dubbele_bestanden_rapport_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadShaLog = () => {
    const lines: string[] = [];
    lines.push('====================================================');
    lines.push('            SHA-256 INTEGRITEITS RAPPORT             ');
    lines.push(`            Gegenereerd op: ${new Date().toLocaleString('nl-NL')} `);
    if (shaHashingTime !== null) {
      lines.push(`            Verwerkingstijd (SHA-256): ${shaHashingTime.toFixed(2)}s`);
    }
    lines.push('====================================================\n');

    lines.push(`Overall Status: ${shaComparison.isPerfect ? 'SUCCES - 100% Identiek' : 'AANDACHT VEREIST - Verschillen gedetecteerd'}`);
    lines.push(`Bronbestanden (Hashed): ${shaComparison.sourceCount}`);
    lines.push(`Doelbestanden (Hashed): ${shaComparison.destCount}\n`);

    lines.push('====================================================');
    lines.push('  1. GEWIJZIGDE OF CORRUPTE BESTANDEN (Mismatches)');
    lines.push('====================================================');
    if (shaComparison.mismatches.length === 0) {
      lines.push('Geen gewijzigde of corrupte bestanden gevonden.\n');
    } else {
      lines.push(`Aantal afwijkende bestanden: ${shaComparison.mismatches.length}\n`);
      shaComparison.mismatches.forEach((item, idx) => {
        lines.push(`  [${idx + 1}] ${item.name}`);
        lines.push(`      Grootte: ${formatSize(item.size)}`);
        lines.push(`      Bron Hash: ${item.sourceHash}`);
        lines.push(`      Doel Hash: ${item.destHash}`);
        lines.push('');
      });
    }

    lines.push('====================================================');
    lines.push('  2. ONTBREKEND IN DOEL (Missing in Destination)');
    lines.push('====================================================');
    if (shaComparison.missing.length === 0) {
      lines.push('Geen ontbrekende bestanden.\n');
    } else {
      lines.push(`Aantal ontbrekende bestanden: ${shaComparison.missing.length}\n`);
      shaComparison.missing.forEach((item, idx) => {
        lines.push(`  [${idx + 1}] ${item.name} (${formatSize(item.size)})`);
      });
      lines.push('');
    }

    lines.push('====================================================');
    lines.push('  3. EXTRA BESTANDEN IN DOEL (Extra in Destination)');
    lines.push('====================================================');
    if (shaComparison.extra.length === 0) {
      lines.push('Geen extra bestanden.\n');
    } else {
      lines.push(`Aantal extra bestanden: ${shaComparison.extra.length}\n`);
      shaComparison.extra.forEach((item, idx) => {
        lines.push(`  [${idx + 1}] ${item.name} (${formatSize(item.size)})`);
      });
      lines.push('');
    }

    lines.push('====================================================');
    lines.push('  4. CORRECT GEÏNTEGREERD (Perfect Matches)');
    lines.push('====================================================');
    if (shaComparison.matches.length === 0) {
      lines.push('Geen perfecte matches gevonden.\n');
    } else {
      lines.push(`Aantal correcte bestanden: ${shaComparison.matches.length}\n`);
      shaComparison.matches.forEach((item, idx) => {
        lines.push(`  [${idx + 1}] ${item.name} (${formatSize(item.size)})`);
        lines.push(`      Hash: ${item.hash}`);
      });
      lines.push('');
    }

    lines.push('====================================================');
    lines.push('                 EINDE VAN RAPPORT                  ');
    lines.push('====================================================');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sha256_integriteits_rapport_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleVerify = () => {
    if (!sourcePaths.trim() || !destPaths.trim()) return;
    setStatus('checking');
    setShowSplash(true);
    setTimeout(() => {
      if (textComparison.isPerfectMatch) {
        setStatus('success');
      } else {
        setStatus('error');
      }
      setTimeout(() => {
        setShowSplash(false);
      }, 2000);
    }, 800);
  };

  const handleShaVerify = () => {
    if (sourceFiles.length === 0 || destFiles.length === 0) return;
    setShaStatus('checking');
    setShaShowSplash(true);
    setTimeout(() => {
      if (shaComparison.isPerfect) {
        setShaStatus('success');
      } else {
        setShaStatus('error');
      }
      setTimeout(() => {
        setShaShowSplash(false);
      }, 2000);
    }, 800);
  };

  const resetText = () => {
    setSourcePaths('');
    setDestPaths('');
    setStatus('idle');
    setShowSplash(false);
  };

  const resetSha = () => {
    setSourceFiles([]);
    setDestFiles([]);
    setShaStatus('idle');
    setShaShowSplash(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between border-b border-[#141414]/10 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-serif italic tracking-tight">Bestandscontrole</h1>
            <p className="text-sm opacity-60 mt-1 uppercase tracking-widest font-medium">Kopieerverificatie & Integriteitscheck</p>
          </div>
          
          {/* Mode Switcher */}
          <div className="flex bg-[#141414]/5 p-1 rounded-full border border-[#141414]/10 max-w-lg self-start md:self-auto overflow-x-auto">
            <button
              onClick={() => setActiveMode('text')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all shrink-0 ${
                activeMode === 'text' 
                  ? 'bg-[#141414] text-white shadow' 
                  : 'hover:bg-[#141414]/10 text-[#141414]/70'
              }`}
            >
              <FileText size={14} />
              Paden Vergelijken
            </button>
            <button
              onClick={() => setActiveMode('sha')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all shrink-0 ${
                activeMode === 'sha' 
                  ? 'bg-[#141414] text-white shadow' 
                  : 'hover:bg-[#141414]/10 text-[#141414]/70'
              }`}
            >
              <Binary size={14} />
              SHA-256 Check
            </button>
            <button
              onClick={() => setActiveMode('duplicates')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all shrink-0 ${
                activeMode === 'duplicates' 
                  ? 'bg-[#141414] text-white shadow' 
                  : 'hover:bg-[#141414]/10 text-[#141414]/70'
              }`}
            >
              <Copy size={14} />
              Dubbele Bestanden
            </button>
          </div>
        </header>

        {/* Info panel */}
        <div className="bg-brand-gold/10 border border-[#141414]/5 rounded-2xl p-4 mb-8 flex items-start gap-3 bg-white/60">
          <Info size={18} className="text-[#141414]/60 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <span className="font-bold uppercase tracking-wider opacity-60">Tip van de app</span>
            <p className="opacity-75">
              {activeMode === 'text' && 'Gebruik deze snelle methode om de namen van duizenden gekopieerde bestanden binnen een milliseconde te scannen.'}
              {activeMode === 'sha' && 'Upload of sleep de echte bestanden hierin. De app vergelijkt de exacte byte-inhoud (cryptografische SHA-256) om er zeker van te zijn dat er geen bitje is veranderd tijdens het kopiëren.'}
              {activeMode === 'duplicates' && 'Sleep een map met bestanden hierin. De app controleert op basis van cryptografische SHA-256 signatures of er dubbele bestanden zijn en genereert een handige txt-rapportage.'}
            </p>
          </div>
        </div>

        {/* TEXT COMPARISON MODE */}
        {activeMode === 'text' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-50">
                    <FileCheck size={14} />
                    Bronpaden (Veld 1)
                  </label>
                  {sourcePaths && (
                    <button onClick={() => setSourcePaths('')} className="text-xs opacity-55 hover:opacity-100 flex items-center gap-1 transition-opacity">
                      Wissen
                    </button>
                  )}
                </div>
                <textarea
                  value={sourcePaths}
                  onChange={(e) => setSourcePaths(e.target.value)}
                  placeholder="Plak hier de paden uit de bronmap..."
                  className="w-full h-64 p-4 bg-white border border-[#141414]/10 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#141414]/5 focus:border-[#141414]/20 outline-none transition-all font-mono text-xs resize-none"
                />
                <div className="text-[10px] font-mono opacity-40 text-right">
                  {textComparison.sourceCount} regels gevonden
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-50">
                    <ArrowRightLeft size={14} />
                    Doelpaden (Veld 2)
                  </label>
                  {destPaths && (
                    <button onClick={() => setDestPaths('')} className="text-xs opacity-55 hover:opacity-100 flex items-center gap-1 transition-opacity">
                      Wissen
                    </button>
                  )}
                </div>
                <textarea
                  value={destPaths}
                  onChange={(e) => setDestPaths(e.target.value)}
                  placeholder="Plak hier de paden uit de doelmap..."
                  className="w-full h-64 p-4 bg-white border border-[#141414]/10 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#141414]/5 focus:border-[#141414]/20 outline-none transition-all font-mono text-xs resize-none"
                />
                <div className="text-[10px] font-mono opacity-40 text-right">
                  {textComparison.destCount} regels gevonden
                </div>
              </div>
            </div>

            <div className="flex justify-center mb-8 gap-4">
              <button
                onClick={handleVerify}
                disabled={!sourcePaths.trim() || !destPaths.trim()}
                className="group relative px-12 py-4 bg-[#141414] text-white rounded-full font-bold text-base overflow-hidden transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:hover:scale-100"
              >
                <span className="relative z-10 flex items-center gap-3">
                  Controleer Paden
                  <ArrowRightLeft size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                </span>
              </button>
            </div>

            {status !== 'idle' && !showSplash && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {textComparison.isPerfectMatch ? (
                  <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-3xl flex flex-col items-center text-center">
                    <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                    <h2 className="text-2xl font-serif italic mb-2">Alles klopt!</h2>
                    <p className="text-emerald-700/80">Alle {textComparison.sourceCount} bestanden zijn correct overgezet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-rose-50 border border-rose-200 p-8 rounded-3xl flex flex-col items-center text-center">
                      <XCircle size={48} className="text-rose-500 mb-4" />
                      <h2 className="text-2xl font-serif italic mb-2">Verschillen gevonden</h2>
                      <p className="text-rose-700/80">Er zijn inconsistenties tussen de bron en het doel.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Missing in Destination */}
                      <div className="bg-white border border-[#141414]/5 p-6 rounded-2xl shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 text-rose-600">
                          <AlertCircle size={16} />
                          Ontbrekend in Doel ({textComparison.missingInDest.length})
                        </h3>
                        {textComparison.missingInDest.length > 0 ? (
                          <ul className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {textComparison.missingInDest.map((file, i) => (
                              <li key={i} className="text-xs font-mono p-2 bg-rose-50/50 rounded border border-rose-100/50 break-all">
                                {file}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm opacity-40 italic">Geen ontbrekende bestanden.</p>
                        )}
                      </div>

                      {/* Extra in Destination */}
                      <div className="bg-white border border-[#141414]/5 p-6 rounded-2xl shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 text-[#C27E00]">
                          <AlertCircle size={16} />
                          Extra in Doel ({textComparison.extraInDest.length})
                        </h3>
                        {textComparison.extraInDest.length > 0 ? (
                          <ul className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {textComparison.extraInDest.map((file, i) => (
                              <li key={i} className="text-xs font-mono p-2 bg-amber-50/50 rounded border border-amber-100/50 break-all">
                                {file}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm opacity-40 italic">Geen extra bestanden.</p>
                        )}
                      </div>
                    </div>

                    {!textComparison.countsMatch && (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800">
                        <AlertCircle size={20} />
                        <span className="text-sm font-medium">
                          Let op: Het aantal paden komt niet overeen ({textComparison.sourceCount} vs {textComparison.destCount}).
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* SHA INTEGRITY MODE */}
        {activeMode === 'sha' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              
              {/* SOURCE UPLOAD ZONE */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-50">
                      <FileCheck size={14} />
                      Bronbestanden (1)
                    </label>
                    {sourceFiles.length > 0 && (
                      <span className="bg-[#141414]/5 text-[#141414]/70 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {sourceFiles.length} {sourceFiles.length === 1 ? 'bestand' : 'bestanden'}
                      </span>
                    )}
                  </div>
                  {sourceFiles.length > 0 && (
                    <button 
                      onClick={() => setSourceFiles([])}
                      className="text-xs text-rose-600 font-semibold hover:opacity-80 transition-opacity"
                    >
                      Alles wissen
                    </button>
                  )}
                </div>
                                <input 
                  type="file" 
                  ref={sourceInputRef}
                  multiple 
                  onChange={(e) => e.target.files && processFiles(e.target.files, 'source')} 
                  className="hidden" 
                />

                <div 
                  onClick={(e) => {
                    e.preventDefault();
                    if (isHashingSource) return;
                    sourceInputRef.current?.click();
                  }}
                  onDragOver={(e) => { e.preventDefault(); if (!isHashingSource) setIsDragOverSource(true); }}
                  onDragLeave={() => setIsDragOverSource(false)}
                  onDrop={(e) => handleDropEvent(e, 'source')}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center min-h-40 ${
                    isHashingSource 
                      ? 'border-[#141414]/10 bg-[#141414]/2 opacity-50 cursor-not-allowed'
                      : isDragOverSource 
                      ? 'border-[#141414] bg-[#141414]/5 scale-[1.02]' 
                      : 'border-[#141414]/15 bg-white hover:border-[#141414]/40 hover:bg-[#141414]/5 cursor-pointer'
                  }`}
                >
                  <Upload size={32} className="text-[#141414]/40 mb-3" />
                  <p className="text-sm font-semibold">Selecteer of sleep bronbestanden/mappen</p>
                  <p className="text-xs opacity-50 mt-1">Slepen van mappen wordt volledig ondersteund</p>
                </div>

                {sourceFiles.length > 0 && (
                  <div className="bg-white border border-[#141414]/5 rounded-2xl p-4 max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                    {sourceFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 bg-[#F5F5F0]/60 rounded-xl border border-[#141414]/5 text-xs">
                        <div className="truncate pr-4 max-w-[60%]">
                          <p className="font-semibold truncate">{file.name}</p>
                          <p className="text-[10px] opacity-50">{formatSize(file.size)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {file.status === 'done' ? (
                            <span className="font-mono text-[9px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
                              <ShieldCheck size={10} />
                              {file.hash.substring(0, 8)}...
                            </span>
                          ) : file.status === 'hashing' ? (
                            <span className="flex items-center gap-1 text-[10px] text-[#C27E00]">
                              <Loader2 size={12} className="animate-spin" />
                              Hashed {file.progress}%
                            </span>
                          ) : (
                            <span className="text-[10px] opacity-40">Wachten...</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DESTINATION UPLOAD ZONE */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-50">
                      <ArrowRightLeft size={14} />
                      Doelbestanden (2)
                    </label>
                    {destFiles.length > 0 && (
                      <span className="bg-[#141414]/5 text-[#141414]/70 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {destFiles.length} {destFiles.length === 1 ? 'bestand' : 'bestanden'}
                      </span>
                    )}
                  </div>
                  {destFiles.length > 0 && (
                    <button 
                      onClick={() => setDestFiles([])}
                      className="text-xs text-rose-600 font-semibold hover:opacity-80 transition-opacity"
                    >
                      Alles wissen
                    </button>
                  )}
                </div>

                <input 
                  type="file" 
                  ref={destInputRef}
                  multiple 
                  onChange={(e) => e.target.files && processFiles(e.target.files, 'dest')} 
                  className="hidden" 
                />

                <div 
                  onClick={(e) => {
                    e.preventDefault();
                    if (isHashingDest) return;
                    destInputRef.current?.click();
                  }}
                  onDragOver={(e) => { e.preventDefault(); if (!isHashingDest) setIsDragOverDest(true); }}
                  onDragLeave={() => setIsDragOverDest(false)}
                  onDrop={(e) => handleDropEvent(e, 'dest')}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center min-h-40 ${
                    isHashingDest 
                      ? 'border-[#141414]/10 bg-[#141414]/2 opacity-50 cursor-not-allowed'
                      : isDragOverDest 
                      ? 'border-[#141414] bg-[#141414]/5 scale-[1.02]' 
                      : 'border-[#141414]/15 bg-white hover:border-[#141414]/40 hover:bg-[#141414]/5 cursor-pointer'
                  }`}
                >
                  <Upload size={32} className="text-[#141414]/40 mb-3" />
                  <p className="text-sm font-semibold">Selecteer of sleep doelbestanden/mappen</p>
                  <p className="text-xs opacity-50 mt-1">Slepen van mappen wordt volledig ondersteund</p>
                </div>

                {destFiles.length > 0 && (
                  <div className="bg-white border border-[#141414]/5 rounded-2xl p-4 max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                    {destFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 bg-[#F5F5F0]/60 rounded-xl border border-[#141414]/5 text-xs">
                        <div className="truncate pr-4 max-w-[60%]">
                          <p className="font-semibold truncate">{file.name}</p>
                          <p className="text-[10px] opacity-50">{formatSize(file.size)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {file.status === 'done' ? (
                            <span className="font-mono text-[9px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
                              <ShieldCheck size={10} />
                              {file.hash.substring(0, 8)}...
                            </span>
                          ) : file.status === 'hashing' ? (
                            <span className="flex items-center gap-1 text-[10px] text-[#C27E00]">
                              <Loader2 size={12} className="animate-spin" />
                              Hashed {file.progress}%
                            </span>
                          ) : (
                            <span className="text-[10px] opacity-40">Wachten...</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* SHA HASHING TIMER DISPLAY - Gesplitst voor onafhankelijke timers en voortgangstellers */}
            {(isHashingSource || isHashingDest || shaSourceHashingTime !== null || shaDestHashingTime !== null) && (
              <div className="flex flex-col items-center gap-3 mb-6">
                <div className="flex flex-wrap justify-center gap-4">
                  {/* BRONBESTANDEN TIMING & PROGRESS */}
                  {(isHashingSource || shaSourceHashingTime !== null) && (
                    <div className="inline-flex items-center gap-2 bg-white border border-[#141414]/10 px-4 py-2 rounded-full shadow-sm text-xs font-mono">
                      <span className="flex items-center gap-1.5 text-[#141414]/70 font-semibold">
                        {isHashingSource ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-[#C27E00]" />
                            <span>Bron: {shaSourceProgress ? `${shaSourceProgress.current}/${shaSourceProgress.total}` : 'Laden...'}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            <span>Bron gehasht ({sourceFiles.length} best.)</span>
                          </>
                        )}
                      </span>
                      <span className="w-1 h-3 bg-[#141414]/15 rounded-full" />
                      <span className="font-bold text-[#141414] flex items-center gap-1">
                        <Timer size={12} className="text-[#141414]/50" />
                        {isHashingSource ? shaSourceActiveTime.toFixed(2) : shaSourceHashingTime?.toFixed(2)}s
                      </span>
                    </div>
                  )}

                  {/* DOELBESTANDEN TIMING & PROGRESS */}
                  {(isHashingDest || shaDestHashingTime !== null) && (
                    <div className="inline-flex items-center gap-2 bg-white border border-[#141414]/10 px-4 py-2 rounded-full shadow-sm text-xs font-mono">
                      <span className="flex items-center gap-1.5 text-[#141414]/70 font-semibold">
                        {isHashingDest ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-[#C27E00]" />
                            <span>Doel: {shaDestProgress ? `${shaDestProgress.current}/${shaDestProgress.total}` : 'Laden...'}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            <span>Doel gehasht ({destFiles.length} best.)</span>
                          </>
                        )}
                      </span>
                      <span className="w-1 h-3 bg-[#141414]/15 rounded-full" />
                      <span className="font-bold text-[#141414] flex items-center gap-1">
                        <Timer size={12} className="text-[#141414]/50" />
                        {isHashingDest ? shaDestActiveTime.toFixed(2) : shaDestHashingTime?.toFixed(2)}s
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SHA COMPARE TRIGGER */}
            <div className="flex justify-center mb-8 gap-4">
              <button
                onClick={handleShaVerify}
                disabled={isHashing || sourceFiles.length === 0 || destFiles.length === 0}
                className="group relative px-12 py-4 bg-[#141414] text-white rounded-full font-bold text-base overflow-hidden transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:hover:scale-100"
              >
                <span className="relative z-10 flex items-center gap-3">
                  Check Crypto Integriteit (SHA-256)
                  {isHashing ? <Loader2 size={18} className="animate-spin" /> : <Binary size={18} />}
                </span>
              </button>
            </div>

            {/* SHA Results section */}
            {shaStatus !== 'idle' && !shaShowSplash && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Download banner */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-[#141414] text-white p-4 rounded-2xl shadow-sm">
                  <div>
                    <h4 className="font-serif italic text-base">Integriteitsrapport is klaar</h4>
                    <p className="text-[10px] opacity-75 mt-0.5">Download een compleet overzicht (.txt) van alle gematchte, gewijzigde en ontbrekende bestanden.</p>
                  </div>
                  <button
                    onClick={downloadShaLog}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-[#141414] rounded-full font-bold text-xs hover:bg-[#F5F5F0] transition-colors self-start sm:self-auto shrink-0"
                  >
                    <Download size={14} />
                    Download TXT Rapport
                  </button>
                </div>

                {shaComparison.isPerfect ? (
                  <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-3xl flex flex-col items-center text-center">
                    <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                    <h2 className="text-2xl font-serif italic mb-2">Integriteit 100% Correct!</h2>
                    <p className="text-emerald-700/80 mb-2">Alle {shaComparison.matches.length} bestanden zijn perfect en exact hetzelfde overgezet.</p>
                    <p className="text-xs text-emerald-600/65 font-mono">Gecontroleerd via cryptografische hashing signatures</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-rose-50 border border-rose-200 p-8 rounded-3xl flex flex-col items-center text-center">
                      <XCircle size={48} className="text-rose-500 mb-4" />
                      <h2 className="text-2xl font-serif italic mb-2">Integriteitsprobleem gedetecteerd!</h2>
                      <p className="text-rose-700/80">Er zijn cruciale afwijkingen tussen de geüploade bestanden.</p>
                    </div>

                    {/* Mismatching hash alerts */}
                    {shaComparison.mismatches.length > 0 && (
                      <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 text-rose-600">
                          <Binary size={16} />
                          Gewijzigde of Corrupte Bestanden ({shaComparison.mismatches.length})
                        </h3>
                        <p className="text-xs opacity-60 mb-3">Deze bestanden hebben exact dezelfde naam, maar de inhoud is gewijzigd of corrupt (de sha codes matchen niet).</p>
                        <div className="space-y-3">
                          {shaComparison.mismatches.map((item, i) => (
                            <div key={i} className="p-3 bg-white rounded-xl border border-rose-200/50 flex flex-col gap-2">
                              <p className="font-bold text-sm text-rose-700">{item.name} <span className="text-xs font-normal text-[#141414]/50">({formatSize(item.size)})</span></p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                                <span className="bg-[#F5F5F0] p-1.5 rounded text-[#141414]/70 truncate flex flex-col">
                                  <strong className="text-[8px] uppercase tracking-wider opacity-60">Bron Hash</strong>
                                  {item.sourceHash}
                                </span>
                                <span className="bg-rose-50 p-1.5 rounded text-rose-800 truncate flex flex-col">
                                  <strong className="text-[8px] uppercase tracking-wider opacity-60 text-rose-600/70">Doel Hash</strong>
                                  {item.destHash}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Missing in Destination (SHA Check) */}
                      <div className="bg-white border border-[#141414]/5 p-6 rounded-2xl shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 text-rose-600">
                          <AlertCircle size={16} />
                          Ontbrekend in Doel ({shaComparison.missing.length})
                        </h3>
                        {shaComparison.missing.length > 0 ? (
                          <ul className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {shaComparison.missing.map((file, i) => (
                              <li key={i} className="text-xs font-mono p-2 bg-rose-50/50 rounded border border-rose-100/50 flex justify-between">
                                <span className="truncate pr-2 font-bold">{file.name}</span>
                                <span className="opacity-50 text-[10px]">{formatSize(file.size)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm opacity-40 italic">Geen ontbrekende bestanden.</p>
                        )}
                      </div>

                      {/* Extra in Destination (SHA Check) */}
                      <div className="bg-white border border-[#141414]/5 p-6 rounded-2xl shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 text-[#C27E00]">
                          <AlertCircle size={16} />
                          Extra in Doel ({shaComparison.extra.length})
                        </h3>
                        {shaComparison.extra.length > 0 ? (
                          <ul className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {shaComparison.extra.map((file, i) => (
                              <li key={i} className="text-xs font-mono p-2 bg-amber-50/50 rounded border border-amber-100/50 flex justify-between">
                                <span className="truncate pr-2">{file.name}</span>
                                <span className="opacity-55 text-[10px]">{formatSize(file.size)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm opacity-40 italic">Geen extra bestanden.</p>
                        )}
                      </div>
                    </div>

                    {/* Valid Files list to reassure user */}
                    {shaComparison.matches.length > 0 && (
                      <div className="bg-white border border-[#141414]/5 p-6 rounded-2xl shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-emerald-700 flex items-center gap-2">
                          <CheckCircle2 size={16} />
                          Correct Geïntegreerd ({shaComparison.matches.length})
                        </h3>
                        <ul className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                          {shaComparison.matches.map((item, i) => (
                            <li key={i} className="text-xs font-mono flex justify-between p-1.5 bg-[#F5F5F0]/30 rounded">
                              <span className="truncate text-[#141414]/75">{item.name}</span>
                              <span className="text-[10px] opacity-45">{formatSize(item.size)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* DUPLICATE FILES MODE */}
        {activeMode === 'duplicates' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              
              {/* Left Column: Upload and File Processing */}
              <div className="md:col-span-1 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-1.5">
                    <Upload size={14} />
                    Map of Bestanden toevoegen
                  </h3>
                  {dupFiles.length > 0 && (
                    <button 
                      onClick={() => setDupFiles([])}
                      className="text-xs text-rose-600 font-semibold hover:opacity-80 transition-opacity flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      Wissen
                    </button>
                  )}
                </div>

                <input 
                  type="file" 
                  ref={duplicatesInputRef}
                  multiple 
                  onChange={(e) => e.target.files && processDuplicateFiles(e.target.files)} 
                  className="hidden" 
                />

                <div 
                  onClick={(e) => {
                    e.preventDefault();
                    if (isDupHashing) return;
                    duplicatesInputRef.current?.click();
                  }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOverDup(true); }}
                  onDragLeave={() => setIsDragOverDup(false)}
                  onDrop={(e) => handleDropEvent(e, 'duplicates')}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center min-h-40 ${
                    isDupHashing 
                      ? 'border-[#141414]/10 bg-[#141414]/2 opacity-50 cursor-not-allowed'
                      : isDragOverDup 
                      ? 'border-[#141414] bg-[#141414]/5 scale-[1.02]' 
                      : 'border-[#141414]/15 bg-white hover:border-[#141414]/40 hover:bg-[#141414]/5 cursor-pointer'
                  }`}
                >
                  <Upload size={32} className="text-[#141414]/40 mb-3" />
                  <p className="text-sm font-semibold">Selecteer of sleep bestanden/mappen</p>
                  <p className="text-xs opacity-50 mt-1">Slepen van mappen wordt volledig ondersteund</p>
                </div>

                {dupFiles.length > 0 && (
                  <div className="bg-white border border-[#141414]/5 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-[#141414]/5 mb-2">
                      <span className="font-semibold opacity-60">Upload status ({dupFiles.length})</span>
                      {isDupHashing ? (
                        <span className="flex items-center gap-1.5 text-[#C27E00] font-mono font-medium">
                          <Loader2 size={12} className="animate-spin" />
                          {dupProgress ? `${dupProgress.current}/${dupProgress.total} bestanden (${Math.round((dupProgress.current / dupProgress.total) * 100)}%) ` : ''}
                          ({dupActiveTime.toFixed(2)}s)
                        </span>
                      ) : dupHashingTime !== null ? (
                        <span className="flex items-center gap-1 text-emerald-700 font-mono font-medium">
                          Gehasht ({dupFiles.length} bestanden) in {dupHashingTime.toFixed(2)}s
                        </span>
                      ) : null}
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                      {dupFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-2 bg-[#F5F5F0]/60 rounded-xl border border-[#141414]/5 text-[11px]">
                          <div className="truncate pr-4 max-w-[65%]">
                            <p className="font-semibold truncate text-[#141414]">{file.name}</p>
                            <p className="text-[9px] opacity-45">{formatSize(file.size)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {file.status === 'done' ? (
                              <span className="font-mono text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 font-semibold">
                                {file.hash.substring(0, 8)}...
                              </span>
                            ) : file.status === 'hashing' ? (
                              <span className="flex items-center gap-1 text-[10px] text-[#C27E00] font-medium">
                                <Loader2 size={10} className="animate-spin" />
                                {file.progress}%
                              </span>
                            ) : (
                              <span className="text-[9px] opacity-40">Wachtend...</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Columns: Analysis Dashboard */}
              <div className="md:col-span-2 space-y-6">
                
                {/* Stats cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-[#141414]/5 p-4 rounded-2xl shadow-sm text-center">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-45 mb-1">Totaal Gescand</p>
                    <p className="text-2xl font-serif italic text-[#141414]">
                      {dupFiles.filter(f => f.status === 'done').length}
                    </p>
                    <p className="text-[10px] opacity-50 mt-1">bestanden voltooid</p>
                  </div>

                  <div className="bg-white border border-[#141414]/5 p-4 rounded-2xl shadow-sm text-center">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-45 mb-1">Dubbele Groepen</p>
                    <p className="text-2xl font-serif italic text-rose-600">
                      {Object.keys(duplicateGroups).length}
                    </p>
                    <p className="text-[10px] opacity-50 mt-1">sets van kopieën</p>
                  </div>

                  <div className="bg-white border border-[#141414]/5 p-4 rounded-2xl shadow-sm text-center">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-45 mb-1">Herwinbare Ruimte</p>
                    <p className="text-2xl font-serif italic text-[#C27E00]">
                      {formatSize(wastedSpace)}
                    </p>
                    <p className="text-[10px] opacity-50 mt-1">verspilde schijfruimte</p>
                  </div>
                </div>

                {/* Main panel displays result */}
                {dupFiles.length === 0 ? (
                  <div className="bg-white/40 border border-dashed border-[#141414]/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                    <Copy size={40} className="text-[#141414]/25 mb-3" />
                    <h3 className="text-lg font-serif italic mb-1">Geen bestanden geladen</h3>
                    <p className="text-xs opacity-60 max-w-sm">
                      Upload bestanden via het linkerpaneel om ze direct cryptografisch op duplicaten te controleren.
                    </p>
                  </div>
                ) : isDupHashing ? (
                  <div className="bg-white border border-[#141414]/5 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-64">
                    <Loader2 size={40} className="text-[#C27E00] animate-spin mb-4" />
                    <h3 className="text-lg font-serif italic mb-2">Analyse is bezig...</h3>
                    <p className="text-xs opacity-60 max-w-xs">
                      De signatures van je bestanden worden berekend met SHA-256 om byte-preciese duplicaten te vinden.
                    </p>
                  </div>
                ) : Object.keys(duplicateGroups).length === 0 ? (
                  <div className="bg-emerald-50/55 border border-emerald-200/60 p-8 rounded-3xl flex flex-col items-center text-center">
                    <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
                    <h3 className="text-xl font-serif italic mb-1">Geweldig nieuws!</h3>
                    <p className="text-xs text-emerald-700/80 mb-2">Er zijn geen dubbele bestanden gevonden in de opgeladen set.</p>
                    <p className="text-[10px] opacity-60">Alle signature hashes waren volledig uniek.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-[#141414] text-white p-4 rounded-2xl">
                      <div>
                        <h4 className="font-serif italic text-base">Rapport is klaar</h4>
                        <p className="text-[10px] opacity-75 mt-0.5">Met deze actie download je een compleet .txt-rapport van alle duplicaten.</p>
                      </div>
                      <button
                        onClick={downloadDuplicateLog}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-[#141414] rounded-full font-bold text-xs hover:bg-[#F5F5F0] transition-colors self-start sm:self-auto shrink-0"
                      >
                        <Download size={14} />
                        Download TXT Rapport
                      </button>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider opacity-60">Gevonden Dubbele Bestanden</h4>
                      <div className="space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                        {Object.keys(duplicateGroups).map((hash, idx) => {
                          const groupFiles = duplicateGroups[hash];
                          const sampleFile = groupFiles[0];
                          return (
                            <div key={hash} className="bg-white border border-[#141414]/5 rounded-2xl p-4 space-y-3">
                              <div className="flex justify-between items-center text-xs pb-2 border-b border-[#141414]/5">
                                <span className="font-serif italic font-semibold text-[#141414]">
                                  Groep #{idx + 1} ({groupFiles.length} kopieën)
                                </span>
                                <span className="text-[10px] font-mono opacity-50 bg-[#F5F5F0] px-2 py-0.5 rounded">
                                  {formatSize(sampleFile.size)} elk
                                </span>
                              </div>
                              <ul className="space-y-1.5">
                                {groupFiles.map((file, fIdx) => (
                                  <li key={file.id} className="text-xs font-mono p-2 bg-[#F5F5F0]/40 rounded-lg flex items-center justify-between gap-4">
                                    <span className="truncate font-semibold text-[#141414]/80">{file.name}</span>
                                    {fIdx === 0 ? (
                                      <span className="text-[8px] uppercase tracking-wider bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100/50 font-bold shrink-0">
                                        Origineel / Eerste
                                      </span>
                                    ) : (
                                      <span className="text-[8px] uppercase tracking-wider bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100/50 font-bold shrink-0">
                                        Duplicaat
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Splash Screen Overlay for Text Mode */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#F5F5F0]/95 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="flex flex-col items-center"
            >
              {status === 'checking' ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="w-24 h-24 border-4 border-[#141414]/10 border-t-[#141414] rounded-full animate-spin" />
                  <p className="text-xl font-serif italic">Paden vergelijken...</p>
                </div>
              ) : status === 'success' ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                    <CheckCircle2 size={80} className="text-white" />
                  </div>
                  <h2 className="text-4xl font-serif italic text-emerald-600">Perfect!</h2>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <div className="w-32 h-32 bg-rose-500 rounded-full flex items-center justify-center shadow-2xl shadow-rose-500/20">
                    <XCircle size={80} className="text-white" />
                  </div>
                  <h2 className="text-4xl font-serif italic text-rose-600">Fout gevonden</h2>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Splash Screen Overlay for SHA Mode */}
      <AnimatePresence>
        {shaShowSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#F5F5F0]/95 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="flex flex-col items-center"
            >
              {shaStatus === 'checking' ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="w-24 h-24 border-4 border-[#141414]/10 border-t-[#141414] rounded-full animate-spin" />
                  <p className="text-xl font-serif italic">Byte-integriteit scannen...</p>
                </div>
              ) : shaStatus === 'success' ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                    <CheckCircle2 size={80} className="text-white" />
                  </div>
                  <h2 className="text-4xl font-serif italic text-emerald-600">Byte-Perfect!</h2>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <div className="w-32 h-32 bg-rose-500 rounded-full flex items-center justify-center shadow-2xl shadow-rose-500/20">
                    <XCircle size={80} className="text-white" />
                  </div>
                  <h2 className="text-4xl font-serif italic text-rose-600">Integriteitsfout</h2>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(20, 20, 20, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(20, 20, 20, 0.2);
        }
      `}</style>
    </div>
  );
}
