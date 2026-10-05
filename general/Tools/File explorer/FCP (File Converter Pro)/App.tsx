import React, { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { ConversionTarget, FileStatus, ConversionFile } from './types';
import { convertAudioToText, convertImage, convertMedia, convertPdfToText } from './services/fileConverter';
import { convertModel, getModelFormat, is3DModel, ModelFormat } from './services/modelConverter';
import { getOfficeFormats, isOfficeDocument } from './services/fileFormats';
import { t, translations } from './i18n';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import workerURL from '@ffmpeg/ffmpeg/worker?url';
import { jsPDF } from 'jspdf';
import { BlobReader, ZipWriter } from '@zip.js/zip.js';
import ImageTracer from 'imagetracerjs';

interface FileSystemEntry {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    fullPath: string;
    file: (success: (file: File) => void, error: (error: any) => void) => void;
    createReader: () => {
        readEntries: (success: (entries: FileSystemEntry[]) => void, error: (error: any) => void) => void;
    };
}

const getMediaType = (file: File) => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    
    // We strictly define what needs the Media Engine (FFmpeg)
    // GIFs are included here because FFmpeg is used for high-quality GIF resizing/conversion
    const isVideo = type.startsWith('video/') || /\.(mp4|webm|wmv|mkv|avi|mov|flv|gif)$/.test(name);
    const isAudio = type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac)$/.test(name);
    const isPdf = type === 'application/pdf' || /\.pdf$/i.test(name);
    const isModel = is3DModel(file);
    const isOffice = isOfficeDocument(file.name);
    const isArchive = /\.(zip|7z|tar|gz|tgz|bz2|tbz|tbz2|xz|txz|cab|lzma)$/i.test(name);
    
    // Images that can be handled by the browser's Canvas/HEIF engine
    const isImage = (type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif|avif|ico|bmp|tiff|svg)$/.test(name)) && !isVideo;
    
    return { isImage, isVideo, isAudio, isPdf, isModel, isOffice, isArchive, isSupported: isImage || isVideo || isAudio || isPdf || isModel || isOffice || isArchive };
};

// Helper to check if a file is supported
const isSupportedMedia = (file: File): boolean => getMediaType(file).isSupported;

const getDraggedFiles = (dataTransfer: DataTransfer): File[] => {
  const itemFiles = Array.from(dataTransfer.items)
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((file): file is File => file !== null);
  return itemFiles.length > 0 ? itemFiles : Array.from(dataTransfer.files);
};

const isFileDrag = (dataTransfer: DataTransfer): boolean =>
  Array.from(dataTransfer.types).includes('Files') || Array.from(dataTransfer.items).some(item => item.kind === 'file');

type ConversionCategory = 'image' | 'video' | 'audio' | 'pdf' | 'office' | 'archive' | 'model';

const getConversionCategory = (file: File): ConversionCategory | null => {
  const mediaType = getMediaType(file);
  if (mediaType.isImage) return 'image';
  if (mediaType.isVideo) return 'video';
  if (mediaType.isAudio) return 'audio';
  if (mediaType.isPdf) return 'pdf';
  if (mediaType.isOffice) return 'office';
  if (mediaType.isArchive) return 'archive';
  if (mediaType.isModel) return 'model';
  return null;
};

const getAvailableFormats = (file: File): ConversionTarget[] => {
  const category = getConversionCategory(file);
  if (category === 'image') return [ConversionTarget.JPG, ConversionTarget.PNG, ConversionTarget.WEBP, ConversionTarget.HEIC, ConversionTarget.AVIF, ConversionTarget.PDF, ConversionTarget.ICO, ConversionTarget.SVG];
  if (category === 'video') return [ConversionTarget.MP4, ConversionTarget.WEBM, ConversionTarget.WMV, ConversionTarget.MKV, ConversionTarget.MP3, ConversionTarget.WAV, ConversionTarget.FLAC, ConversionTarget.OGG];
  if (category === 'audio') return [ConversionTarget.MP3, ConversionTarget.WAV, ConversionTarget.FLAC, ConversionTarget.OGG, ConversionTarget.TXT, ConversionTarget.SRT];
  if (category === 'pdf') return [ConversionTarget.TXT];
  if (category === 'office') return getOfficeFormats(file.name);
  if (category === 'archive') return [ConversionTarget.EXTRACT];
  if (category === 'model') return getModelFormat(file.name) === 'SKP'
    ? [ConversionTarget.STL, ConversionTarget.OBJ, ConversionTarget.GLB]
    : [ConversionTarget.STL, ConversionTarget.OBJ, ConversionTarget.GLTF, ConversionTarget.GLB];
  return [];
};

const getSourceExtension = (file: File): string => file.name.split('.').pop()?.toLowerCase() || '';
const sourceExtensionsByTarget: Partial<Record<ConversionTarget, string[]>> = {
  [ConversionTarget.JPG]: ['jpg', 'jpeg'],
  [ConversionTarget.WEBP]: ['webp'],
  [ConversionTarget.HEIC]: ['heic'],
  [ConversionTarget.AVIF]: ['avif'],
  [ConversionTarget.PDF]: ['pdf'],
  [ConversionTarget.PNG]: ['png'],
  [ConversionTarget.ICO]: ['ico'],
  [ConversionTarget.SVG]: ['svg'],
  [ConversionTarget.MP4]: ['mp4'],
  [ConversionTarget.WEBM]: ['webm'],
  [ConversionTarget.WMV]: ['wmv'],
  [ConversionTarget.MKV]: ['mkv'],
  [ConversionTarget.MP3]: ['mp3'],
  [ConversionTarget.WAV]: ['wav'],
  [ConversionTarget.FLAC]: ['flac'],
  [ConversionTarget.OGG]: ['ogg'],
  [ConversionTarget.TXT]: ['txt'],
  [ConversionTarget.SRT]: ['srt'],
  [ConversionTarget.STL]: ['stl'],
  [ConversionTarget.OBJ]: ['obj'],
  [ConversionTarget.GLTF]: ['gltf'],
  [ConversionTarget.GLB]: ['glb'],
};
const isSameSourceFormat = (file: File, targetFormat: ConversionTarget): boolean =>
  (sourceExtensionsByTarget[targetFormat] || []).includes(getSourceExtension(file));

const dropZoneFormatGroups: { category: ConversionCategory; formats: ConversionTarget[] }[] = [
  { category: 'image', formats: [ConversionTarget.JPG, ConversionTarget.PNG, ConversionTarget.WEBP, ConversionTarget.HEIC, ConversionTarget.AVIF, ConversionTarget.PDF, ConversionTarget.ICO, ConversionTarget.SVG] },
  { category: 'video', formats: [ConversionTarget.MP4, ConversionTarget.WEBM, ConversionTarget.WMV, ConversionTarget.MKV, ConversionTarget.MP3, ConversionTarget.WAV, ConversionTarget.FLAC, ConversionTarget.OGG] },
  { category: 'audio', formats: [ConversionTarget.MP3, ConversionTarget.WAV, ConversionTarget.FLAC, ConversionTarget.OGG, ConversionTarget.TXT, ConversionTarget.SRT] },
  { category: 'pdf', formats: [ConversionTarget.TXT] },
  { category: 'office', formats: [ConversionTarget.TXT, ConversionTarget.HTML, ConversionTarget.PDF, ConversionTarget.CSV, ConversionTarget.JSON] },
  { category: 'archive', formats: [ConversionTarget.EXTRACT] },
  { category: 'model', formats: [ConversionTarget.STL, ConversionTarget.OBJ, ConversionTarget.GLTF, ConversionTarget.GLB] },
];

const dropZoneCategoryTranslationKeys: Record<ConversionCategory, keyof typeof translations> = {
  image: 'conversion_category_image',
  video: 'conversion_category_video',
  audio: 'conversion_category_audio',
  pdf: 'conversion_category_pdf',
  office: 'conversion_category_office',
  archive: 'conversion_category_archive',
  model: 'conversion_category_model',
};

const getDropZonesForFiles = (files: File[]) => dropZoneFormatGroups.flatMap(group => {
  const categoryFiles = files.filter(file => getConversionCategory(file) === group.category);
  if (categoryFiles.length === 0) return [];

  return group.formats
    .filter(format => categoryFiles.some(file => getAvailableFormats(file).includes(format) && !isSameSourceFormat(file, format)))
    .map(format => ({ category: group.category, format }));
});

  const allDropZones = dropZoneFormatGroups.flatMap(group => group.formats.map(format => ({ category: group.category, format })));

const createZipFileWriter = (electronApi: any, filePath: string) => {
  const maxChunkBytes = 4 * 1024 * 1024;
  let chunks: Uint8Array[] = [];
  let queuedBytes = 0;

  const flush = async () => {
    if (!queuedBytes) return;
    const data = new Uint8Array(queuedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    chunks = [];
    queuedBytes = 0;
    await electronApi.appendZipFile(filePath, data);
  };

  return new WritableStream<Uint8Array>({
    async write(chunk) {
      chunks.push(chunk);
      queuedBytes += chunk.byteLength;
      if (queuedBytes >= maxChunkBytes) await flush();
    },
    close: flush,
    abort() {
      chunks = [];
      queuedBytes = 0;
    },
  });
};

// Helper function to recursively traverse directories and collect files with their relative paths
async function traverseDirectory(entry: FileSystemEntry, currentPath: string = ''): Promise<{ file: File; relativePath: string }[]> {
    if (!entry) return [];

    const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

    if (entry.isFile) {
        return new Promise<{ file: File; relativePath: string }[]>((resolve, reject) => {
            entry.file(
                (file: File) => {
                    if (isSupportedMedia(file)) {
                         resolve([{ file, relativePath: newPath }]);
                    } else {
                         resolve([]);
                    }
                },
                (err: any) => reject(err)
            );
        });
    }

    if (entry.isDirectory) {
        return new Promise<{ file: File; relativePath: string }[]>((resolve, reject) => {
            const dirReader = entry.createReader();
            const allEntries: FileSystemEntry[] = [];

            const readEntries = () => {
                dirReader.readEntries(
                    async (entries: FileSystemEntry[]) => {
                        if (entries.length === 0) {
                            // All entries for this directory have been read
                            const nestedFiles = await Promise.all(allEntries.map(e => traverseDirectory(e, newPath)));
                            resolve(nestedFiles.flat());
                        } else {
                            allEntries.push(...entries);
                            readEntries(); // Read the next batch of entries
                        }
                    },
                    (err: any) => reject(err)
                );
            };
            readEntries();
        });
    }
    return [];
}


function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const PasswordModal: React.FC<{ onConfirm: (password: string | null) => void; onCancel: () => void, lang: string }> = ({ onConfirm, onCancel, lang }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (password !== confirmPassword) {
            setError(t('passwords_dont_match', lang));
            return;
        }
        setError('');
        onConfirm(password ? password : null);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="bg-gray-200 dark:bg-gray-800 rounded-lg p-8 shadow-xl space-y-4 w-full max-w-sm transform transition-all duration-300 scale-95 animate-scale-in">
                <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{t('password_modal_title', lang)}</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{t('password_modal_info', lang)}</p>
                <div>
                    <label htmlFor="password-input" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('password_label', lang)}</label>
                    <input
                        id="password-input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        autoFocus
                    />
                </div>
                <div>
                    <label htmlFor="confirm-password-input" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('confirm_password_label', lang)}</label>
                    <input
                        id="confirm-password-input"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                </div>
                {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
                <div className="flex justify-end space-x-4 pt-4">
                    <button onClick={onCancel} className="bg-gray-500 dark:bg-gray-600 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 dark:hover:bg-gray-700 transition">{t('cancel', lang)}</button>
                    <button onClick={handleSubmit} className="bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600 transition">{t('confirm_download', lang)}</button>
                </div>
            </div>
        </div>
    );
};

const VaultSetupModal: React.FC<{ onConfirm: (password: string, quotaGb: number) => Promise<void>; onCancel: () => void }> = ({ onConfirm, onCancel }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [quotaGb, setQuotaGb] = useState('10');
  const [error, setError] = useState('');
  const submit = async () => {
    const quota = Number(quotaGb);
    if (password.length < 10) return setError('Gebruik minimaal 10 tekens voor het kluiswachtwoord.');
    if (password !== confirmPassword) return setError('De wachtwoorden komen niet overeen.');
    if (!Number.isFinite(quota) || quota <= 0 || quota > 1024) return setError('Kies een quota tussen 0,1 en 1024 GB.');
    setError('');
    await onConfirm(password, quota);
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
    <div className="w-full max-w-md space-y-4 rounded-lg bg-gray-200 p-8 shadow-xl dark:bg-gray-800">
      <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">Kluis instellen</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">Bestanden worden in het doelpad versleuteld opgeslagen. Windows Verkenner kan de inhoud niet openen.</p>
      <label className="block text-sm font-medium">Kluiswachtwoord<input type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-md border p-2 text-gray-900" autoFocus /></label>
      <label className="block text-sm font-medium">Wachtwoord bevestigen<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-md border p-2 text-gray-900" /></label>
      <label className="block text-sm font-medium">Maximale opslag (GB)<input type="number" min="0.1" max="1024" step="0.1" value={quotaGb} onChange={event => setQuotaGb(event.target.value)} className="mt-1 w-full rounded-md border p-2 text-gray-900" /></label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 pt-2"><button onClick={onCancel} className="rounded bg-gray-500 px-4 py-2 font-bold text-white">Annuleren</button><button onClick={submit} className="rounded bg-cyan-500 px-4 py-2 font-bold text-white">Kluis opslaan</button></div>
    </div>
  </div>;
};

const VaultPasswordModal: React.FC<{ onConfirm: (password: string) => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => {
  const [password, setPassword] = useState('');
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
    <div className="w-full max-w-sm space-y-4 rounded-lg bg-gray-200 p-8 shadow-xl dark:bg-gray-800">
      <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">Kluis ontgrendelen</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">Voer het kluiswachtwoord in om deze zip versleuteld op te slaan.</p>
      <input type="password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => event.key === 'Enter' && onConfirm(password)} className="w-full rounded-md border p-2 text-gray-900" autoFocus />
      <div className="flex justify-end gap-3"><button onClick={onCancel} className="rounded bg-gray-500 px-4 py-2 font-bold text-white">Annuleren</button><button onClick={() => onConfirm(password)} className="rounded bg-cyan-500 px-4 py-2 font-bold text-white">Opslaan</button></div>
    </div>
  </div>;
};

const EncryptionInfoAlert: React.FC<{ onClose: () => void; lang: string }> = ({ onClose, lang }) => {
    return (
        <div className="fixed bottom-4 right-4 max-w-md w-full bg-gray-200 dark:bg-gray-800 border border-blue-500 rounded-lg shadow-lg p-4 z-50 animate-fade-in-up">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="ml-3 w-0 flex-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        {t('zip_error_modal_title', lang)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {t('zip_error_modal_text', lang).split('7-Zip')[0]}
                        <a href="https://www.7-zip.org/" target="_blank" rel="noopener noreferrer" className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline">7-Zip</a>
                        {t('zip_error_modal_text', lang).split('7-Zip')[1]}
                    </p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                    <button onClick={onClose} className="bg-transparent rounded-md inline-flex text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500">
                        <span className="sr-only">Close</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

type AvailableUpdate = { version: string; releaseUrl: string; downloadUrl: string; fileName: string };

const UpdateModal: React.FC<{ update: AvailableUpdate; lang: string; onUpdate: () => void; onLater: () => void; isInstalling: boolean }> = ({ update, lang, onUpdate, onLater, isInstalling }) => (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-lg bg-white p-6 text-gray-900 shadow-2xl dark:bg-gray-800 dark:text-white">
      <h2 className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{t('update_available', lang)}</h2>
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{t('update_message', lang)}</p>
      <p className="mt-2 text-sm font-semibold">Version {update.version}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onLater} disabled={isInstalling} className="rounded-md bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-600 disabled:opacity-50">{t('update_later', lang)}</button>
        <button onClick={onUpdate} disabled={isInstalling} className="rounded-md bg-cyan-500 px-4 py-2 font-bold text-white hover:bg-cyan-600 disabled:opacity-50">{isInstalling ? t('processing', lang) : t('update_now', lang)}</button>
      </div>
    </div>
  </div>
);

const appLanguages: { code: string; name: string; flag: string }[] = [
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

type WallpaperState = {
  enabled: boolean;
  path: string | null;
  dataUrl: string | null;
  mediaType?: 'image' | 'video' | null;
  mimeType?: string;
  data?: Uint8Array;
  url?: string | null;
};

const OnboardingModal: React.FC<{
  language: string;
  onLanguageChange: (language: string) => void;
  onComplete: () => void;
}> = ({ language, onLanguageChange, onComplete }) => {
  const [step, setStep] = useState<'language' | 'guide'>('language');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-7 text-gray-900 shadow-2xl dark:bg-gray-800 dark:text-white sm:p-9">
        {step === 'language' ? (
          <>
            <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{t('onboarding_language_title', language)}</h2>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{t('onboarding_language_text', language)}</p>
            <label htmlFor="onboarding-language" className="mt-6 block text-sm font-semibold">{t('language_label', language)}</label>
            <select
              id="onboarding-language"
              value={language}
              onChange={event => onLanguageChange(event.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-3 dark:border-gray-600 dark:bg-gray-900"
            >
              {appLanguages.map(item => <option key={item.code} value={item.code}>{item.flag} {item.name}</option>)}
            </select>
            <button onClick={() => setStep('guide')} className="mt-7 w-full rounded-md bg-cyan-500 px-4 py-3 font-bold text-white transition hover:bg-cyan-600">
              {t('onboarding_continue', language)}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{t('onboarding_title', language)}</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">{t('onboarding_intro', language)}</p>
            <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">{t('onboarding_steps', language)}</p>
            <p className="mt-5 font-semibold text-cyan-700 dark:text-cyan-300">{t('onboarding_ready', language)}</p>
            <button onClick={onComplete} className="mt-7 w-full rounded-md bg-cyan-500 px-4 py-3 font-bold text-white transition hover:bg-cyan-600">
              {t('onboarding_start', language)}
            </button>
          </>
        )}
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [files, setFiles] = useState<ConversionFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedCount, setConvertedCount] = useState(0);
  const [totalToConvert, setTotalToConvert] = useState(0);
  const [batchEtaSeconds, setBatchEtaSeconds] = useState<number | null>(null);
  const [isFfmpegReady, setIsFfmpegReady] = useState(false);
  const [isHeifReady, setIsHeifReady] = useState(false);
  const [isPdfReady, setIsPdfReady] = useState(false);
  const [isSvgReady, setIsSvgReady] = useState(false);
  const [zipFileName, setZipFileName] = useState('converted-files');
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState({ completed: 0, total: 0, currentFile: '' });
  const [bulkImageFormat, setBulkImageFormat] = useState('');
  const [bulkVideoFormat, setBulkVideoFormat] = useState('');
  const [bulkAudioFormat, setBulkAudioFormat] = useState('');
  const [isTraversing, setIsTraversing] = useState(false);
  const [dragPreviewFiles, setDragPreviewFiles] = useState<File[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isVaultPasswordModalOpen, setIsVaultPasswordModalOpen] = useState(false);
  const [vaultPasswordAction, setVaultPasswordAction] = useState<'save' | 'browse'>('save');
  const [isVaultSetupModalOpen, setIsVaultSetupModalOpen] = useState(false);
  const [showEncryptionInfo, setShowEncryptionInfo] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'en');
  const [uiTransparency, setUiTransparency] = useState(() => {
    const savedValue = Number(localStorage.getItem('ui-transparency'));
    if (!Number.isFinite(savedValue)) return 0.9;
    return Math.min(1, Math.max(0.55, savedValue));
  });
  const [currentView, setCurrentView] = useState<'home' | 'settings'>('home');
  const [conversionMode, setConversionMode] = useState<'media' | 'model'>('media');
  const [modelUnitScale, setModelUnitScale] = useState(1);
  const [outputDirectory, setOutputDirectory] = useState(() => localStorage.getItem('output-directory') || '');
  const [vaultStatus, setVaultStatus] = useState<{ enabled: boolean; outputDirectory?: string; quotaBytes?: number }>({ enabled: false });
  const [vaultFiles, setVaultFiles] = useState<Array<{ storageName: string; fileName: string; bytes: number; modifiedAt: number }>>([]);
  const [vaultPassword, setVaultPassword] = useState<string | null>(null);
  const [isVaultBrowserOpen, setIsVaultBrowserOpen] = useState(false);
  const [zipDestination, setZipDestination] = useState<'folder' | 'vault'>('folder');
  const [deleteSources, setDeleteSources] = useState(() => localStorage.getItem('delete-sources') === 'true');
  const pendingSourceDeletionsRef = useRef<string[]>([]);
  const [wallpaper, setWallpaper] = useState<WallpaperState>({ enabled: false, path: null, dataUrl: null });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [combineToPdf, setCombineToPdf] = useState(false);
  const [gpuToast, setGpuToast] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [isStalled, setIsStalled] = useState(false);
  const ffmpegRef = useRef<any>(null);
  const ffmpegLoadingRef = useRef<boolean>(false);
  const wallpaperObjectUrlRef = useRef<string | null>(null);
  const dragPreviewSignatureRef = useRef('');
  const dragEnterDepthRef = useRef(0);
  const lastProgressAtRef = useRef<number>(Date.now());
  const batchStartedAtRef = useRef<number | null>(null);
  const MAX_CONCURRENT_CONVERSIONS = 4;

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const listRef = useRef<HTMLDivElement>(null);

  const applyWallpaper = (nextWallpaper: WallpaperState) => {
    if (wallpaperObjectUrlRef.current) URL.revokeObjectURL(wallpaperObjectUrlRef.current);
    let videoUrl: string | null = null;
    if (nextWallpaper.mediaType === 'video' && nextWallpaper.data) {
      const videoBuffer = new ArrayBuffer(nextWallpaper.data.byteLength);
      new Uint8Array(videoBuffer).set(nextWallpaper.data);
      videoUrl = URL.createObjectURL(new Blob([videoBuffer], { type: nextWallpaper.mimeType || 'video/mp4' }));
    }
    wallpaperObjectUrlRef.current = videoUrl;
    const { data: _data, ...wallpaperState } = nextWallpaper;
    setWallpaper({ ...wallpaperState, url: videoUrl });
  };

  useEffect(() => {
    let isMounted = true;
    const electronApi = (window as any).electronAPI;
    const loadOnboardingState = async () => {
      try {
        const isComplete = electronApi?.getOnboardingComplete
          ? await electronApi.getOnboardingComplete()
          : localStorage.getItem('onboarding-complete') === 'true';
        if (isMounted) setShowOnboarding(!isComplete);
      } catch (error) {
        console.error('Failed to load onboarding state:', error);
        if (isMounted) setShowOnboarding(localStorage.getItem('onboarding-complete') !== 'true');
      }
    };
    void loadOnboardingState();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    // Also update the class on the html element immediately for better responsiveness
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('ui-transparency', String(uiTransparency));
  }, [uiTransparency]);

  useEffect(() => {
    localStorage.setItem('output-directory', outputDirectory);
  }, [outputDirectory]);

  useEffect(() => {
    (window as any).electronAPI?.getVaultStatus?.().then(setVaultStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem('delete-sources', String(deleteSources));
  }, [deleteSources]);

  useEffect(() => {
    let isMounted = true;
    (window as any).electronAPI?.getWallpaper?.().then((nextWallpaper: WallpaperState) => {
      if (isMounted) applyWallpaper(nextWallpaper);
    }).catch((error: unknown) => console.error('Failed to load wallpaper', error));
    return () => {
      isMounted = false;
      if (wallpaperObjectUrlRef.current) URL.revokeObjectURL(wallpaperObjectUrlRef.current);
      wallpaperObjectUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (showOnboarding) return;
    (window as any).electronAPI?.checkForUpdate?.().then((update: AvailableUpdate | null) => {
      if (update) setAvailableUpdate(update);
    }).catch(() => undefined);
  }, [showOnboarding]);

  const installUpdate = async () => {
    if (!availableUpdate) return;
    setIsInstallingUpdate(true);
    try {
      await (window as any).electronAPI.downloadAndInstallUpdate(availableUpdate);
    } catch (error) {
      console.error('Failed to install update', error);
      setIsInstallingUpdate(false);
    }
  };

  useEffect(() => {
    if (!isConverting) {
      setIsStalled(false);
      setBatchEtaSeconds(null);
      return;
    }

    const timer = window.setInterval(() => {
      setIsStalled(Date.now() - lastProgressAtRef.current > 60000);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [isConverting]);

  useEffect(() => {
    if (!isConverting || !batchStartedAtRef.current || convertedCount <= 0 || totalToConvert <= convertedCount) {
      if (!isConverting || convertedCount <= 0) setBatchEtaSeconds(null);
      return;
    }

    const updateEta = () => {
      const elapsedSeconds = (Date.now() - batchStartedAtRef.current!) / 1000;
      setBatchEtaSeconds(Math.max(0, Math.ceil((elapsedSeconds / convertedCount) * (totalToConvert - convertedCount))));
    };

    updateEta();
    const timer = window.setInterval(updateEta, 1000);
    return () => window.clearInterval(timer);
  }, [convertedCount, isConverting, totalToConvert]);

  useEffect(() => {
    if (showOnboarding) return;

    let isMounted = true;
    const loadGpuInfo = async () => {
      try {
        const api = (window as any).electronAPI;
        if (!api?.getGpuInfo) return;
        const info = await api.getGpuInfo();
        if (!isMounted || !info?.hasDedicatedGpu) return;
        setGpuToast(info.name || 'Dedicated GPU');
      } catch (error) {
        console.error('Failed to load GPU info', error);
      }
    };

    loadGpuInfo();
    return () => {
      isMounted = false;
    };
  }, [showOnboarding]);

  useEffect(() => {
    if (!gpuToast) return;

    const timer = window.setTimeout(() => setGpuToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [gpuToast]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  const chooseWallpaper = async () => {
    const nextWallpaper = await (window as any).electronAPI.chooseWallpaper();
    applyWallpaper(nextWallpaper);
  };

  const completeOnboarding = async () => {
    try {
      const electronApi = (window as any).electronAPI;
      if (electronApi?.setOnboardingComplete) await electronApi.setOnboardingComplete();
      else localStorage.setItem('onboarding-complete', 'true');
      setShowOnboarding(false);
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
      alert('The introduction could not be saved. Please try again.');
    }
  };

  const disableWallpaper = async () => {
    const nextWallpaper = await (window as any).electronAPI.disableWallpaper();
    applyWallpaper(nextWallpaper);
  };

  const chooseOutputDirectory = async () => {
    const selectedPath = await (window as any).electronAPI?.chooseOutputDirectory?.();
    if (selectedPath) setOutputDirectory(selectedPath);
  };

  const createVault = async (password: string, quotaGb: number) => {
    try {
      const status = await (window as any).electronAPI.createVault({ outputDirectory, password, quotaGb });
      setVaultStatus(status);
      setIsVaultSetupModalOpen(false);
      setZipDestination('vault');
    } catch (error: any) {
      alert(error?.message || 'De kluis kon niet worden ingesteld.');
    }
  };

  const clearOutputDirectory = async () => {
    if (vaultStatus.enabled) {
      await (window as any).electronAPI.disableVault();
      setVaultStatus({ enabled: false });
    }
    setOutputDirectory('');
    setZipDestination('folder');
    setVaultFiles([]);
    setVaultPassword(null);
  };

  const unlockVault = async (password: string) => {
    try {
      const files = await (window as any).electronAPI.listVaultFiles({ password });
      setVaultPassword(password);
      setVaultFiles(files);
      setIsVaultBrowserOpen(true);
    } catch (error: any) {
      alert(error?.message || 'Het kluiswachtwoord is onjuist of de kluis is beschadigd.');
    }
  };

  const downloadVaultFile = async (file: { storageName: string; fileName: string }) => {
    if (!vaultPassword) return;
    try {
      const result = await (window as any).electronAPI.readVaultFile({ storageName: file.storageName, password: vaultPassword });
      await (window as any).electronAPI.saveFile({ data: result.data, fileName: result.fileName });
    } catch (error: any) {
      alert(error?.message || 'Het bestand kon niet uit de kluis worden gelezen.');
    }
  };

  const deleteVaultFile = async (file: { storageName: string }) => {
    if (!vaultPassword || !window.confirm('Dit bestand permanent uit de kluis verwijderen?')) return;
    try {
      await (window as any).electronAPI.deleteVaultFile({ storageName: file.storageName, password: vaultPassword });
      setVaultFiles(previous => previous.filter(item => item.storageName !== file.storageName));
    } catch (error: any) {
      alert(error?.message || 'Het bestand kon niet uit de kluis worden verwijderd.');
    }
  };

  // Preload Everything on mount (Desktop App Mode)
  useEffect(() => {
    if (isFfmpegReady || ffmpegLoadingRef.current) return;

    const loadFfmpeg = async () => {
      if (ffmpegLoadingRef.current) return;
      ffmpegLoadingRef.current = true;
      try {
        const ffmpeg = new FFmpeg();
        await ffmpeg.load({ coreURL, wasmURL, workerURL });
        ffmpegRef.current = ffmpeg;
        setIsFfmpegReady(true);
      } catch (e) {
        console.error("Failed to load FFmpeg", e);
        ffmpegLoadingRef.current = false;
      }
    };
    
    // Start loading immediately
    loadFfmpeg();

    setIsPdfReady(true);
    setIsSvgReady(true);

    return () => {
    };
  }, []);

  useEffect(() => {
    setIsHeifReady(isFfmpegReady);
  }, [isFfmpegReady]);

  const hasVideoInQueue = useMemo(() => files.some(f => {
      const { isVideo } = getMediaType(f.file);
      return isVideo;
  }), [files]);

  const hasImageInQueue = useMemo(() => files.some(f => {
      const { isImage } = getMediaType(f.file);
      return isImage;
  }), [files]);

  const hasAudioInQueue = useMemo(() => files.some(f => {
      const { isAudio } = getMediaType(f.file);
      return isAudio;
  }), [files]);

  const hasPdfInQueue = useMemo(() => files.some(f => {
    const { isPdf } = getMediaType(f.file);
    return isPdf;
  }), [files]);
  
  const updateFileState = useCallback((id: string, newProps: Partial<ConversionFile>) => {
    lastProgressAtRef.current = Date.now();
    setFiles(prevFiles =>
      prevFiles.map(f => (f.id === id ? { ...f, ...newProps } : f))
    );
  }, []);

  const getBatchDirectoryName = useCallback(() => {
    const today = new Date();
    const dayKey = today.toISOString().slice(0, 10);
    const savedBatches = (() => {
      try {
        const stored = localStorage.getItem('fcp-batch-counts');
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    })();

    const nextBatchNumber = Number(savedBatches[dayKey] || 0) + 1;
    savedBatches[dayKey] = nextBatchNumber;
    localStorage.setItem('fcp-batch-counts', JSON.stringify(savedBatches));
    return `${dayKey}-batch-${nextBatchNumber}`;
  }, []);

  const handlePendingSourceDeletion = useCallback(async () => {
    const pathsToDelete = pendingSourceDeletionsRef.current;

    if (!deleteSources || pathsToDelete.length === 0) {
      pendingSourceDeletionsRef.current = [];
      return;
    }

    const shouldDelete = window.confirm(t('delete_sources_warning', language));
    if (!shouldDelete) {
      pendingSourceDeletionsRef.current = [];
      return;
    }

    const electronApi = (window as any).electronAPI;
    const failedPaths: string[] = [];

    for (const sourcePath of pathsToDelete) {
      try {
        if (sourcePath) await electronApi?.deleteSourceFile?.(sourcePath);
      } catch (error) {
        console.warn('Failed to delete source file after confirmation.', error);
        failedPaths.push(sourcePath);
      }
    }

    if (failedPaths.length > 0) {
      alert(`Kon ${failedPaths.length} bronbestand(en) niet verwijderen. Controleer ze handmatig.`);
    }

    pendingSourceDeletionsRef.current = [];
  }, [deleteSources, language]);

  const addFiles = useCallback((newFiles: { file: File, relativePath: string }[], targetFormat?: ConversionTarget) => {
    const filesToAdd: ConversionFile[] = newFiles
    .filter(item => isSupportedMedia(item.file))
    .map(item => {
      const { file, relativePath } = item;
      const { isImage, isVideo, isAudio, isPdf, isModel, isOffice, isArchive } = getMediaType(file);

      const canUseTarget = targetFormat && getAvailableFormats(file).includes(targetFormat) && !isSameSourceFormat(file, targetFormat);
      let defaultFormat: ConversionTarget | null = canUseTarget ? targetFormat : null;
      if (!defaultFormat && isVideo) defaultFormat = ConversionTarget.MP4;
      else if (!defaultFormat && isImage) defaultFormat = ConversionTarget.PNG;
      else if (!defaultFormat && isAudio) defaultFormat = ConversionTarget.MP3;
      else if (!defaultFormat && isPdf) defaultFormat = ConversionTarget.TXT;
      else if (!defaultFormat && isOffice) defaultFormat = getOfficeFormats(file.name)[0] ?? null;
      else if (!defaultFormat && isArchive) defaultFormat = ConversionTarget.EXTRACT;
      else if (!defaultFormat && isModel) {
        const sourceFormat = getModelFormat(file.name);
        defaultFormat = sourceFormat === 'STL' ? ConversionTarget.OBJ
          : sourceFormat === 'OBJ' ? ConversionTarget.GLB
          : sourceFormat === 'FBX' ? ConversionTarget.GLTF
          : sourceFormat === 'GLTF' ? ConversionTarget.GLB
          : sourceFormat === 'SKP' ? ConversionTarget.GLB
          : ConversionTarget.GLTF;
      }

      return {
        id: crypto.randomUUID(),
        file,
        status: 'pending',
        targetFormat: defaultFormat,
        readProgress: 0,
        progress: 0,
        convertedFileUrl: null,
        error: null,
        relativePath: relativePath,
      };
    });
    setFiles(prev => [...prev, ...filesToAdd]);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const isFolderInput = e.target.id === 'folder-upload' || e.target.id === 'folder-upload-more';

      const filesWithPaths = filesArray.map(file => ({
        file,
        relativePath: isFolderInput && (file as any).webkitRelativePath ? (file as any).webkitRelativePath : (file as any).name
      }));
      
      addFiles(filesWithPaths);
      e.target.value = '';
    }
  };

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);
  
  const handleCancelConversion = useCallback(() => {
    if (!isConverting) return;

    setFiles(prevFiles => prevFiles.map(file => (
      file.status === 'reading' || file.status === 'converting'
        ? { ...file, status: 'error', error: 'Conversion cancelled by the user.' }
        : file
    )));

    (window as any).electronAPI?.cancelConversion?.().catch(() => undefined);
    setIsConverting(false);
    setIsStalled(false);
    lastProgressAtRef.current = Date.now();
  }, [isConverting]);

  const handleConvertAll = async () => {
    if (isConverting) return;
    pendingSourceDeletionsRef.current = [];
    setIsConverting(true);
    setConvertedCount(0);
    setBatchEtaSeconds(null);
    setIsStalled(false);
    lastProgressAtRef.current = Date.now();
    batchStartedAtRef.current = Date.now();

    const electronApi = (window as any).electronAPI;
  
    // Special handling for combining images into a single PDF
    const pdfImageFiles = files.filter(f => {
        const { isImage } = getMediaType(f.file);
        return isImage && f.targetFormat === ConversionTarget.PDF && f.status === 'pending';
    });

    const filesToConvert = files.filter(f => f.status === 'pending' && f.targetFormat && !(combineToPdf && pdfImageFiles.includes(f)));
    const total = (combineToPdf && pdfImageFiles.length > 1 ? 1 : 0) + filesToConvert.length;
    setTotalToConvert(total);
    let currentConverted = 0;
    const conversionTimings: Array<{ fileName: string; seconds: number; status: 'success' | 'error' }> = [];
    const combinedConversionStartedAt = performance.now();
    let combinedConversionSucceeded = false;

    if (combineToPdf && pdfImageFiles.length > 1) {
      try {
        const doc = new jsPDF();
        pdfImageFiles.forEach(() => doc.deletePage(1)); // Clear initial page
  
        for (let i = 0; i < pdfImageFiles.length; i++) {
          const fileItem = pdfImageFiles[i];
          updateFileState(fileItem.id, { status: 'converting', progress: Math.round((i / pdfImageFiles.length) * 100) });
          
          let imageUrl: string;
          try {
            imageUrl = URL.createObjectURL(fileItem.file);
          } catch (err: any) {
            throw new Error(`Failed to access file "${fileItem.file.name}": ${err.message || 'File might have been moved or deleted.'}`);
          }

          const img = new Image();
          img.src = imageUrl;
          
          try {
            await new Promise<void>((resolve, reject) => { 
              img.onload = () => resolve(); 
              img.onerror = () => reject(new Error(`Failed to load image "${fileItem.file.name}".`));
            });
    
            const orientation = img.width > img.height ? 'l' : 'p';
            doc.addPage([img.width, img.height], orientation);
            doc.addImage(img, 'JPEG', 0, 0, img.width, img.height);
          } finally {
            URL.revokeObjectURL(imageUrl);
          }
        }
  
        const combinedPdfBlob = doc.output('blob');
        const url = URL.createObjectURL(combinedPdfBlob);
  
        // Create a virtual file to represent the combined PDF
        const combinedFileEntry: ConversionFile = {
            id: 'combined-pdf-' + crypto.randomUUID(),
            file: new File([combinedPdfBlob], "combined_document.pdf", { type: "application/pdf" }),
            status: 'success',
            targetFormat: ConversionTarget.PDF,
            convertedFileUrl: url,
            progress: 100, readProgress: 100, error: null,
        };
        setFiles(prev => [combinedFileEntry, ...prev]);

        // Mark original files as success
        pdfImageFiles.forEach(f => updateFileState(f.id, { status: 'success', progress: 100, convertedFileUrl: '#' })); // Use # to indicate it's part of a combo
        combinedConversionSucceeded = true;
        currentConverted++;
        setConvertedCount(currentConverted);
      } catch(err: any) {
         pdfImageFiles.forEach(f => updateFileState(f.id, { status: 'error', error: String(err) }));
         currentConverted++;
         setConvertedCount(currentConverted);
      }
    }
    if (combineToPdf && pdfImageFiles.length > 1) {
      conversionTimings.push({ fileName: 'combined_document.pdf', seconds: (performance.now() - combinedConversionStartedAt) / 1000, status: combinedConversionSucceeded ? 'success' : 'error' });
    }
  
    let completedCount = currentConverted;
    const queue = [...filesToConvert];

    const convertSingleFile = async (fileItem: ConversionFile) => {
      const conversionStartedAt = performance.now();
      updateFileState(fileItem.id, { status: 'reading', readProgress: 0, progress: 0, error: null });

      const { id, file, targetFormat } = fileItem;
      const { isImage, isVideo, isAudio, isPdf, isModel, isOffice, isArchive } = getMediaType(file);
      const electronApi = (window as any).electronAPI;
      const sourcePath = electronApi?.getFilePath?.(file);
      let stagedPath: string | undefined;
      let conversionFile = file;

      try {
        if (electronApi?.stageFile) {
          try {
            stagedPath = await electronApi.stageFile(sourcePath || await file.arrayBuffer(), file.name);
            if (!isVideo && !isAudio && !isArchive && !isOffice && electronApi.readFile) {
              conversionFile = new File([await electronApi.readFile(stagedPath)], file.name, { type: file.type });
            }
          } catch (stageError) {
            console.warn(`Could not stage ${file.name}; using the selected file instead.`, stageError);
          }
        }
        if (isArchive && targetFormat === ConversionTarget.EXTRACT) {
          if (!stagedPath || !electronApi?.extractArchive) throw new Error('Archive extraction is unavailable in this app build.');
          updateFileState(id, { status: 'converting', progress: 5 });
          const extractionPath = await electronApi.extractArchive(stagedPath, vaultStatus.enabled ? undefined : outputDirectory || undefined, file.name);
          updateFileState(id, { convertedFileUrl: '#', outputPath: extractionPath, status: 'success', progress: 100 });
          if (deleteSources && sourcePath && !pendingSourceDeletionsRef.current.includes(sourcePath)) {
            pendingSourceDeletionsRef.current.push(sourcePath);
          }
          conversionTimings.push({ fileName: file.name, seconds: (performance.now() - conversionStartedAt) / 1000, status: 'success' });
          return;
        }
        let convertedBlob: Blob;
        const isHeifOrAvifSource = /\.(heic|heif|avif)$/i.test(file.name);
        const needsNativeImageConversion = targetFormat === ConversionTarget.HEIC || targetFormat === ConversionTarget.AVIF || isHeifOrAvifSource;

        if (isModel && [ConversionTarget.STL, ConversionTarget.OBJ, ConversionTarget.FBX, ConversionTarget.GLTF, ConversionTarget.GLB].includes(targetFormat as any)) {
          const modelTarget = targetFormat as ModelFormat;
          convertedBlob = await convertModel(conversionFile, modelTarget, p => updateFileState(id, { progress: p }), modelUnitScale);
          updateFileState(id, { status: 'converting' });
        } else if (isImage && needsNativeImageConversion && [ConversionTarget.JPG, ConversionTarget.PNG, ConversionTarget.WEBP, ConversionTarget.HEIC, ConversionTarget.AVIF].includes(targetFormat as any)) {
          convertedBlob = await convertMedia(ffmpegRef.current, file, targetFormat as any,
            (p, etaSeconds) => updateFileState(id, { progress: p, etaSeconds }),
            p => updateFileState(id, { readProgress: p })
            , stagedPath
          );
          updateFileState(id, { status: 'converting' });
        } else if (isImage && [ConversionTarget.JPG, ConversionTarget.PNG, ConversionTarget.WEBP, ConversionTarget.HEIC, ConversionTarget.AVIF, ConversionTarget.PDF, ConversionTarget.ICO, ConversionTarget.SVG].includes(targetFormat as any)) {
          if (targetFormat === ConversionTarget.SVG) {
            if (!isSvgReady) setIsSvgReady(true);
          }
          convertedBlob = await convertImage(conversionFile, targetFormat as any, p => updateFileState(id, { readProgress: p }));
          updateFileState(id, { status: 'converting' });
        } else if ((isVideo || isAudio) && [ConversionTarget.MP4, ConversionTarget.WEBM, ConversionTarget.WMV, ConversionTarget.MKV, ConversionTarget.MP3, ConversionTarget.WAV, ConversionTarget.FLAC, ConversionTarget.OGG].includes(targetFormat as any)) {
          if (!ffmpegRef.current) {
            throw new Error('Media Engine not loaded yet.');
          }
          convertedBlob = await convertMedia(ffmpegRef.current, file, targetFormat as any,
            (p, etaSeconds) => updateFileState(id, { progress: p, etaSeconds }),
            p => {
              updateFileState(id, { readProgress: p });
              if (p >= 99) {
                setTimeout(() => updateFileState(id, { status: 'converting' }), 100);
              }
            }
            , stagedPath
          );
        } else if (isPdf && targetFormat === ConversionTarget.TXT) {
          convertedBlob = await convertPdfToText(conversionFile, p => updateFileState(id, { progress: p }));
          updateFileState(id, { status: 'converting' });
        } else if (isOffice && [ConversionTarget.TXT, ConversionTarget.HTML, ConversionTarget.PDF, ConversionTarget.CSV, ConversionTarget.JSON].includes(targetFormat as any)) {
          const { convertOfficeDocument } = await import('./services/documentConverter');
          convertedBlob = await convertOfficeDocument(conversionFile, targetFormat as any, p => updateFileState(id, { progress: p }));
          updateFileState(id, { status: 'converting' });
        } else if (isAudio && (targetFormat === ConversionTarget.TXT || targetFormat === ConversionTarget.SRT)) {
          convertedBlob = await convertAudioToText(
            conversionFile,
            p => updateFileState(id, { progress: p }),
            targetFormat as ConversionTarget.TXT | ConversionTarget.SRT
          );
          updateFileState(id, { status: 'converting' });
        } else {
          throw new Error('Unsupported file type or target format.');
        }

        const url = URL.createObjectURL(convertedBlob);
        updateFileState(id, { convertedFileUrl: url, status: 'success', progress: 100 });

        if (deleteSources && sourcePath && !pendingSourceDeletionsRef.current.includes(sourcePath)) {
          pendingSourceDeletionsRef.current.push(sourcePath);
        }

        conversionTimings.push({ fileName: file.name, seconds: (performance.now() - conversionStartedAt) / 1000, status: 'success' });
      } catch (err: any) {
        const message = String(err);
        updateFileState(id, { error: message, status: 'error' });
        conversionTimings.push({ fileName: file.name, seconds: (performance.now() - conversionStartedAt) / 1000, status: 'error' });
      } finally {
        if (stagedPath) await electronApi.cleanupStagedFile(stagedPath).catch(() => undefined);
        completedCount += 1;
        setConvertedCount(completedCount);
      }
    };

    const workers = Array.from({ length: Math.min(MAX_CONCURRENT_CONVERSIONS, queue.length) }, async () => {
      while (queue.length > 0) {
        const nextFile = queue.shift();
        if (!nextFile) break;
        await convertSingleFile(nextFile);
      }
    });

    await Promise.all(workers);

    const finishedAt = new Date();
    const totalSeconds = conversionTimings.reduce((sum, item) => sum + item.seconds, 0);
    const successfulTimings = conversionTimings.filter(item => item.status === 'success');
    const report = [
      'File Converter Pro performance report',
      `Started: ${new Date(batchStartedAtRef.current || Date.now()).toISOString()}`,
      `Finished: ${finishedAt.toISOString()}`,
      `Files: ${conversionTimings.length}`,
      `Successful: ${successfulTimings.length}`,
      `Failed: ${conversionTimings.length - successfulTimings.length}`,
      `Average seconds per file: ${conversionTimings.length ? (totalSeconds / conversionTimings.length).toFixed(3) : '0.000'}`,
      '',
      ...conversionTimings.map(item => `${item.status}\t${item.seconds.toFixed(3)} s\t${item.fileName}`),
      ''
    ].join('\n');
    try {
      await (window as any).electronAPI?.writeDebugReport?.({ outputDirectory, report });
    } catch (error) {
      console.warn('Could not write debug.txt', error);
    }
    setIsConverting(false);
    batchStartedAtRef.current = null;
  };

  const retryFile = useCallback((id: string) => {
    if (isConverting) return;
    setFiles(prev => prev.map(file => file.id === id
      ? { ...file, status: 'pending', progress: 0, readProgress: 0, error: null, convertedFileUrl: null }
      : file));
  }, [isConverting]);

  const retryFailed = useCallback(() => {
    if (isConverting) return;
    setFiles(prev => prev.map(file => file.status === 'error'
      ? { ...file, status: 'pending', progress: 0, readProgress: 0, error: null, convertedFileUrl: null }
      : file));
  }, [isConverting]);
  
  
  const reset = () => {
    files.forEach(f => {
      if (f.convertedFileUrl) URL.revokeObjectURL(f.convertedFileUrl);
    });
    setFiles([]);
    setIsConverting(false);
    setShowEncryptionInfo(false);
    setCurrentPage(1);
  };

  const onDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>, targetFormat?: ConversionTarget) => {
    event.preventDefault();
    event.stopPropagation();
    dragPreviewSignatureRef.current = '';
    dragEnterDepthRef.current = 0;
    setDragPreviewFiles([]);
    setIsDraggingFiles(false);

    const queuedFileId = targetFormat && event.dataTransfer.getData('application/x-fcp-file-id');
    if (queuedFileId) {
        const queuedFile = files.find(file => file.id === queuedFileId);
        if (queuedFile && queuedFile.status === 'pending' && getAvailableFormats(queuedFile.file).includes(targetFormat) && !isSameSourceFormat(queuedFile.file, targetFormat)) {
            updateFileState(queuedFileId, { targetFormat });
        }
        return;
    }

    setIsTraversing(true);
    setShowEncryptionInfo(false);

    const fallbackFiles = getDraggedFiles(event.dataTransfer)
      .filter(isSupportedMedia)
      .map(file => ({ file, relativePath: file.name }));
    const items = event.dataTransfer.items;
    let droppedFiles: { file: File, relativePath: string }[] = [];

    try {
      if (items && items.length > 0 && (items[0] as any).webkitGetAsEntry) {
        const promises = Array.from(items).map(item => {
          const entry = (item as any).webkitGetAsEntry() as FileSystemEntry;
          return entry ? traverseDirectory(entry) : Promise.resolve([]);
        });
            const fileArrays = await Promise.all(promises);
            droppedFiles = fileArrays.flat();
      } else {
        droppedFiles = fallbackFiles;
        }

      if (droppedFiles.length === 0) droppedFiles = fallbackFiles;
      if (droppedFiles.length > 0) addFiles(droppedFiles, targetFormat);
    } catch (error) {
      console.error('Error processing dropped files:', error);
      if (fallbackFiles.length > 0) addFiles(fallbackFiles, targetFormat);
    } finally {
      setIsTraversing(false);
    }
  }, [addFiles, files, updateFileState]);

  const updateDragPreview = useCallback((dataTransfer: DataTransfer) => {
    const supportedFiles = getDraggedFiles(dataTransfer).filter(isSupportedMedia);
    if (supportedFiles.length === 0) return;
    const signature = supportedFiles.map(file => `${file.name}:${file.type}:${file.size}`).join('|');
    if (signature !== dragPreviewSignatureRef.current) {
        dragPreviewSignatureRef.current = signature;
        setDragPreviewFiles(supportedFiles);
    }
  }, []);

  const onDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    dragEnterDepthRef.current += 1;
    setIsDraggingFiles(true);
    updateDragPreview(event.dataTransfer);
  }, [updateDragPreview]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isFileDrag(event.dataTransfer)) return;
    setIsDraggingFiles(true);
    updateDragPreview(event.dataTransfer);
  }, [updateDragPreview]);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!isDraggingFiles) return;
    dragEnterDepthRef.current = Math.max(0, dragEnterDepthRef.current - 1);
    if (dragEnterDepthRef.current > 0) return;
    dragPreviewSignatureRef.current = '';
    setDragPreviewFiles([]);
    setIsDraggingFiles(false);
  }, [isDraggingFiles]);

  const successfulConversions = useMemo(() => files.filter(f => f.status === 'success' && f.convertedFileUrl && f.convertedFileUrl !== '#'), [files]);

  const outputDropZones = useMemo(() => getDropZonesForFiles(
    files.filter(file => file.status === 'pending').map(file => file.file)
  ), [files]);
  const dragPreviewDropZones = useMemo(() => getDropZonesForFiles(dragPreviewFiles), [dragPreviewFiles]);
  const activeDragDropZones = isDraggingFiles
    ? (dragPreviewDropZones.length > 0 ? dragPreviewDropZones : allDropZones)
    : [];
  const visibleDropZones = useMemo(() => {
    const zones = [...outputDropZones, ...activeDragDropZones];
    return zones.filter((zone, index) => zones.findIndex(candidate => candidate.category === zone.category && candidate.format === zone.format) === index);
  }, [activeDragDropZones, outputDropZones]);

  const saveDownload = useCallback(async (blob: Blob, fileName: string) => {
    const electronApi = (window as any).electronAPI;
    if (!electronApi?.saveFile) return false;
    await electronApi.saveFile({
      data: await blob.arrayBuffer(),
      fileName,
      outputDirectory: outputDirectory || undefined,
    });
    return true;
  }, [outputDirectory]);

  const openPasswordModal = () => {
    if (successfulConversions.length < 1) return;
    setIsPasswordModalOpen(true);
  };

  const createAndDownloadZip = async (password: string | null, destination: 'folder' | 'vault' = 'folder') => {
    setIsPasswordModalOpen(false);
    if (successfulConversions.length < 1) return;

    setIsDownloadingZip(true);
    setZipProgress({ completed: 0, total: successfulConversions.length, currentFile: '' });
    setShowEncryptionInfo(false);

    let zipWriter: any = null;
    let zipFilePath = '';

    try {
        const electronApi = (window as any).electronAPI;
        if (!electronApi?.createZipFile || !electronApi?.appendZipFile) {
          throw new Error('Disk-based ZIP export is unavailable. Restart the app and try again.');
        }
        zipFilePath = await electronApi.createZipFile();
        zipWriter = new ZipWriter(createZipFileWriter(electronApi, zipFilePath));
        const usedPaths = new Set<string>();

        for (let fileIndex = 0; fileIndex < successfulConversions.length; fileIndex++) {
          const fileItem = successfulConversions[fileIndex];
            const path = fileItem.relativePath || fileItem.file.name;
            const normalizedPath = path.replace(/\\/g, '/');
          setZipProgress({ completed: fileIndex, total: successfulConversions.length, currentFile: fileItem.file.name });
            
            const lastDotIndex = normalizedPath.lastIndexOf('.');
            const pathWithoutExt = lastDotIndex === -1 ? normalizedPath : normalizedPath.substring(0, lastDotIndex);
            const targetExt = fileItem.targetFormat?.toLowerCase() || 'dat';
            const baseFileName = `${pathWithoutExt}.${targetExt}`;
            
            let finalFileName = baseFileName;
            let counter = 1;

            // Ensure uniqueness in our own tracking set
            while (usedPaths.has(finalFileName)) {
                 const dotIndex = baseFileName.lastIndexOf('.');
                 if (dotIndex !== -1) {
                     finalFileName = `${baseFileName.substring(0, dotIndex)} (${counter})${baseFileName.substring(dotIndex)}`;
                 } else {
                     finalFileName = `${baseFileName} (${counter})`;
                 }
                 counter++;
            }

            try {
              const res = await fetch(fileItem.convertedFileUrl!);
              if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
              const blob = await res.blob();
              const blobReader = new BlobReader(blob);

              const options: any = {
                onprogress: (loaded: number, total: number) => {
                  if (!total) return;
                  setZipProgress({
                    completed: fileIndex + loaded / total,
                    total: successfulConversions.length,
                    currentFile: fileItem.file.name,
                  });
                },
              };
              if (password) {
                options.password = password;
                options.encryption = "AES-256";
              }

              await zipWriter.add(finalFileName, blobReader, options);
              usedPaths.add(finalFileName);
            } catch (error: any) {
              console.error(`Failed to add ${fileItem.file.name} to zip:`, error);
              throw new Error(`Could not add "${fileItem.file.name}" to the ZIP: ${error?.message || String(error)}`);
            }
            setZipProgress({ completed: fileIndex + 1, total: successfulConversions.length, currentFile: fileItem.file.name });
        }

        setZipProgress({ completed: successfulConversions.length, total: successfulConversions.length, currentFile: 'ZIP afronden...' });
        await zipWriter.close();
        zipWriter = null; 
        setZipProgress({ completed: successfulConversions.length, total: successfulConversions.length, currentFile: '' });
        const zipFileNameToSave = `${zipFileName || 'converted-files'}.zip`;
        
        if (destination === 'vault') {
          await electronApi.saveVaultFile({ filePath: zipFilePath, fileName: zipFileNameToSave, password: password || '' });
        } else {
          await electronApi.saveFile({ filePath: zipFilePath, fileName: zipFileNameToSave, outputDirectory: outputDirectory || undefined });
        }

        if (deleteSources && pendingSourceDeletionsRef.current.length > 0) {
          await handlePendingSourceDeletion();
        }

        if (password) {
            setShowEncryptionInfo(true);
        }

    } catch (err: any) {
        console.error("Error creating ZIP file", err);
      alert(`An error occurred while creating the ZIP file: ${err?.message || String(err)}`);
    } finally {
        if (zipWriter) {
             try { await zipWriter.close(); } catch(e: any) { /* ignore */ }
        }
        setIsDownloadingZip(false);
        setZipProgress({ completed: 0, total: 0, currentFile: '' });
        if (zipFilePath) {
          try { await (window as any).electronAPI.cleanupZipFile(zipFilePath); } catch (error) {
            console.warn('Could not clean up temporary ZIP file:', error);
          }
        }
    }
  };

    const startZipExport = () => {
        if (zipDestination === 'vault') {
          setVaultPasswordAction('save');
          setIsVaultPasswordModalOpen(true);
        }
      else openPasswordModal();
    };

    const openVaultBrowser = () => {
      setVaultPasswordAction('browse');
      setIsVaultPasswordModalOpen(true);
    };

  const isAnyHeicOrAvif = useMemo(() => files.some(f => (f.targetFormat === ConversionTarget.HEIC || f.targetFormat === ConversionTarget.AVIF) && f.status === 'pending'), [files]);
  const isAnyPdf = useMemo(() => files.some(f => f.targetFormat === ConversionTarget.PDF && f.status === 'pending'), [files]);
  const isReadyToConvert = useMemo(() => files.some(f => f.status === 'pending'), [files]);

  // Removed isFfmpegReady check from disabled state to allow immediate interaction on fast PCs
  const convertAllDisabled = isConverting || !isReadyToConvert || isTraversing;
  
  const getConvertAllButtonText = () => {
    if (isConverting) {
      const eta = batchEtaSeconds === null ? '' : ` - ${formatEta(batchEtaSeconds)} remaining`;
      return `${t('converting_status', language)} (${convertedCount}/${totalToConvert})${eta}`;
    }
    return t('convert_all', language);
  };
  
  const handleApplyBulkImageFormat = () => {
    if (!bulkImageFormat) return;
    setFiles(prevFiles =>
      prevFiles.map(f => {
        const { isImage } = getMediaType(f.file);
        if (isImage) {
          return { ...f, targetFormat: bulkImageFormat as ConversionTarget };
        }
        return f;
      })
    );
  };

  const handleApplyBulkVideoFormat = () => {
    if (!bulkVideoFormat) return;
    setFiles(prevFiles =>
      prevFiles.map(f => {
        const { isVideo } = getMediaType(f.file);
        if (isVideo) {
          return { ...f, targetFormat: bulkVideoFormat as ConversionTarget };
        }
        return f;
      })
    );
  };

  const handleApplyBulkAudioFormat = () => {
    if (!bulkAudioFormat) return;
    setFiles(prevFiles =>
      prevFiles.map(f => {
        const { isAudio } = getMediaType(f.file);
        if (isAudio) {
          return { ...f, targetFormat: bulkAudioFormat as ConversionTarget };
        }
        return f;
      })
    );
  };

  // Pagination Calculation
  const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE);
  
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (listRef.current) {
        listRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return files.slice(start, start + ITEMS_PER_PAGE);
  }, [files, currentPage]);


  const UploadArea = () => {
    if (isTraversing) {
        return (
            <div className="border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg p-12 text-center">
                <div className="flex justify-center items-center space-x-2 text-gray-600 dark:text-gray-400">
                    <svg className="animate-spin h-5 w-5 text-cyan-600 dark:text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('processing_folders', language)}</span>
                </div>
            </div>
        );
    }

    return (
        <div 
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-cyan-500 dark:hover:border-cyan-400 transition"
        >
              <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
                accept={conversionMode === 'model' ? '.stl,.obj,.fbx,.gltf,.glb,.skp' : 'image/*,video/*,audio/*,application/pdf'}
            />
            <input
                id="folder-upload"
                type="file"
                multiple
                {...{ webkitdirectory: "" }}
                className="hidden"
                onChange={handleFileChange}
            />
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-1 dark:border-gray-600 dark:bg-gray-800" role="tablist" aria-label="Conversion type">
                <button onClick={() => setConversionMode('media')} className={`rounded-md px-4 py-2 text-sm font-semibold transition ${conversionMode === 'media' ? 'bg-cyan-500 text-white' : 'text-gray-600 dark:text-gray-300'}`} role="tab" aria-selected={conversionMode === 'media'}>Media & bestanden</button>
                <button onClick={() => setConversionMode('model')} className={`rounded-md px-4 py-2 text-sm font-semibold transition ${conversionMode === 'model' ? 'bg-cyan-500 text-white' : 'text-gray-600 dark:text-gray-300'}`} role="tab" aria-selected={conversionMode === 'model'}>3D Model Conversion</button>
              </div>
                {conversionMode === 'model' && <div className="max-w-xl rounded-lg border border-cyan-400/40 bg-cyan-50/70 px-4 py-3 text-left text-sm text-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100"><strong>3D-engine v1.1.0</strong><span className="ml-2">STL, OBJ, FBX, GLTF, GLB en SKP. SKP kan naar GLB, OBJ en STL met mesh, materialen, UV's, normals, triangulatie en schaalbehoud.</span></div>}
                {conversionMode === 'model' && <label className="flex items-center gap-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Unit scaling<select value={modelUnitScale} onChange={event => setModelUnitScale(Number(event.target.value))} className="rounded-md border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value={1}>1x - behouden</option><option value={0.001}>0.001x - mm naar m</option><option value={0.01}>0.01x - cm naar m</option><option value={1000}>1000x - m naar mm</option></select></label>}
                <p className="text-gray-600 dark:text-gray-400">{t('drop_files_here', language)}</p>
                <p className="text-gray-500 text-sm">{t('or', language)}</p>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <label htmlFor="file-upload" className="cursor-pointer bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600 transition">
                        {t('browse_files', language)}
                    </label>
                    <label htmlFor="folder-upload" className="cursor-pointer bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600 transition">
                        {t('browse_folder', language)}
                    </label>
                </div>
            </div>
        </div>
    );
  }

  const renderConversionDropZones = (zones: { category: ConversionCategory; format: ConversionTarget }[]) => (
    <section className="space-y-4" aria-label="Conversion targets">
      {dropZoneFormatGroups.filter(group => zones.some(zone => zone.category === group.category)).map(group => (
        <div key={group.category} className="space-y-2">
          <h3 className="text-center text-lg font-semibold text-cyan-700 dark:text-cyan-300">
            {t(dropZoneCategoryTranslationKeys[group.category], language)}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {zones.filter(zone => zone.category === group.category).map(zone => (
              <div
                key={`${zone.category}-${zone.format}`}
                onDrop={event => void onDrop(event, zone.format)}
                onDragOver={onDragOver}
                role="group"
                aria-label={`${t('drop_to_convert', language)} ${zone.format}`}
                className="flex min-h-28 cursor-copy flex-col items-center justify-center rounded-lg border border-cyan-950 bg-cyan-800 px-3 py-5 text-center text-white transition hover:bg-cyan-700 dark:border-cyan-950 dark:bg-cyan-800 dark:hover:bg-cyan-700"
              >
                <span className="text-sm font-medium">{t('drop_to_convert', language)}</span>
                <span className="text-xl font-semibold">{zone.format === ConversionTarget.EXTRACT ? t('extract_archive', language) : zone.format}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );

  return (
    <div
      onDrop={event => void onDrop(event)}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`relative isolate text-gray-900 dark:text-white h-screen overflow-y-auto flex flex-col items-center p-4 transition-colors duration-300 bg-cover bg-center bg-fixed overscroll-none ${wallpaper.mediaType === 'video' ? 'bg-transparent' : 'bg-gray-100 dark:bg-gray-900'}`}
      style={wallpaper.enabled && wallpaper.dataUrl ? { backgroundImage: `url(${wallpaper.dataUrl})` } : undefined}
    >
      {wallpaper.mediaType === 'video' && wallpaper.url && (
        <video
          src={wallpaper.url}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          onError={() => console.error('Failed to play the selected video background.')}
        />
      )}
      {showOnboarding && <OnboardingModal language={language} onLanguageChange={setLanguage} onComplete={() => void completeOnboarding()} />}
      {availableUpdate && !showOnboarding && <UpdateModal update={availableUpdate} lang={language} onUpdate={installUpdate} onLater={() => setAvailableUpdate(null)} isInstalling={isInstallingUpdate} />}
      {gpuToast && !showOnboarding && (
        <div className="fixed left-4 top-4 z-40 max-w-xs rounded-lg border border-green-500/40 bg-gray-900/90 px-3 py-2 text-sm text-white shadow-lg backdrop-blur-sm">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-green-400" />
            <div>
              <div className="font-semibold text-green-300">{t('gpu_detected', language)}</div>
              <div className="text-xs text-gray-200">{gpuToast}</div>
            </div>
          </div>
        </div>
      )}
      {isPasswordModalOpen && <PasswordModal onConfirm={password => createAndDownloadZip(password, 'folder')} onCancel={() => setIsPasswordModalOpen(false)} lang={language} />}
      {isVaultSetupModalOpen && <VaultSetupModal onConfirm={createVault} onCancel={() => setIsVaultSetupModalOpen(false)} />}
      {isVaultPasswordModalOpen && <VaultPasswordModal onConfirm={password => { setIsVaultPasswordModalOpen(false); if (vaultPasswordAction === 'browse') unlockVault(password); else createAndDownloadZip(password, 'vault').catch(error => alert(error?.message || 'Opslaan in de kluis is mislukt.')); }} onCancel={() => setIsVaultPasswordModalOpen(false)} />}
      {showEncryptionInfo && <EncryptionInfoAlert onClose={() => setShowEncryptionInfo(false)} lang={language} />}
      <div
        className="relative z-10 w-full max-w-4xl rounded-lg shadow-xl p-6 sm:p-8 space-y-6 border border-white/20 backdrop-blur-sm transition-all duration-200"
        style={{
          backgroundColor: theme === 'dark' ? `rgba(31, 41, 55, ${uiTransparency})` : `rgba(255, 255, 255, ${uiTransparency})`,
        }}
      >
        <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-cyan-600 dark:text-cyan-400">{t('app_title', language)}</h1>
            <div className="flex items-center space-x-4">
                <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    {theme === 'dark' ? 
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> :
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    }
                </button>
                <button onClick={() => setCurrentView(currentView === 'home' ? 'settings' : 'home')} title={t('settings', language)} aria-label={t('settings', language)} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700 dark:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 pl-3 pr-8 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    {appLanguages.map(lang => <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>)}
                </select>
            </div>
        </div>
        
        {currentView === 'settings' ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between"><h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{t('settings', language)}</h2><button onClick={() => setCurrentView('home')} className="rounded-md bg-gray-200 px-4 py-2 font-semibold dark:bg-gray-700">{t('back', language)}</button></div>
            <div className="rounded-lg border border-gray-300 bg-gray-100 p-5 dark:border-gray-600 dark:bg-gray-700/50">
              <h3 className="text-lg font-semibold">{t('output_folder', language)}</h3>
              <p className="mt-1 break-all text-sm text-gray-600 dark:text-gray-300">{outputDirectory || t('output_folder_help', language)}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={chooseOutputDirectory} className="rounded-md bg-cyan-500 px-4 py-2 font-bold text-white hover:bg-cyan-600">{t('choose_output_folder', language)}</button>
                {outputDirectory && <button onClick={clearOutputDirectory} className="rounded-md bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-600">{t('clear_all', language)}</button>}
              </div>
              {outputDirectory && <label className="mt-5 flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={vaultStatus.enabled} onChange={event => event.target.checked ? setIsVaultSetupModalOpen(true) : clearOutputDirectory()} className="mt-1 h-4 w-4 accent-cyan-500" /><span><span className="font-semibold">{t('set_output_folder_as_vault', language)}</span><span className="mt-1 block text-xs text-gray-600 dark:text-gray-300">{t('vault_only_from_app', language)}</span></span></label>}
              {vaultStatus.enabled && <div className="mt-5 rounded-md border border-cyan-400/50 bg-cyan-50 p-4 dark:bg-cyan-950/30"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold text-cyan-800 dark:text-cyan-200">{t('vault_files', language)}</h4><p className="text-xs text-gray-600 dark:text-gray-300">{t('vault_files_help', language)}</p></div><button onClick={openVaultBrowser} className="rounded-md bg-cyan-600 px-4 py-2 font-bold text-white hover:bg-cyan-700">{t('open_vault', language)}</button></div></div>}
              {isVaultBrowserOpen && vaultPassword && <div className="mt-4 space-y-2 rounded-md border border-gray-300 bg-white/70 p-3 dark:border-gray-600 dark:bg-gray-900/30"><div className="flex items-center justify-between"><h4 className="font-semibold">{t('vault_unlocked', language)}</h4><button onClick={() => { setIsVaultBrowserOpen(false); setVaultPassword(null); setVaultFiles([]); }} className="rounded bg-gray-500 px-3 py-1 text-sm font-bold text-white">{t('close', language)}</button></div>{vaultFiles.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-300">{t('vault_empty', language)}</p> : vaultFiles.map(file => <div key={file.storageName} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-2 dark:border-gray-700"><div><div className="font-medium">{file.fileName}</div><div className="text-xs text-gray-500">{formatBytes(file.bytes)}</div></div><div className="flex gap-2"><button onClick={() => downloadVaultFile(file)} className="rounded bg-cyan-600 px-3 py-1 text-sm font-bold text-white">{t('export', language)}</button><button onClick={() => deleteVaultFile(file)} className="rounded bg-red-600 px-3 py-1 text-sm font-bold text-white">{t('delete', language)}</button></div></div>)}</div>}
              <label className="mt-5 flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" checked={deleteSources} onChange={event => setDeleteSources(event.target.checked)} className="mt-1 h-4 w-4 accent-cyan-500" />
                <span><span className="font-semibold">{t('delete_sources', language)}</span><span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">{t('delete_sources_warning', language)}</span></span>
              </label>
            </div>
            <div className="rounded-lg border border-gray-300 bg-gray-100 p-5 dark:border-gray-600 dark:bg-gray-700/50">
              <h3 className="text-lg font-semibold">{t('background', language)}</h3>
              <p className="mt-1 break-all text-sm text-gray-600 dark:text-gray-300">{wallpaper.enabled ? wallpaper.path : t('default_wallpaper', language)}</p>
              <p className="mt-3 rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{t('wallpaper_notice', language)}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={chooseWallpaper} className="rounded-md bg-cyan-500 px-4 py-2 font-bold text-white hover:bg-cyan-600">{wallpaper.enabled ? t('change_background', language) : t('add_background', language)}</button>
                <button onClick={disableWallpaper} disabled={!wallpaper.enabled} className="rounded-md bg-gray-500 px-4 py-2 font-bold text-white disabled:opacity-50">{t('turn_background_off', language)}</button>
              </div>
              <div className="mt-6 rounded-md border border-gray-300 bg-white/60 p-4 dark:border-gray-600 dark:bg-gray-900/30">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">{t('ui_transparency', language)}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t('ui_transparency_help', language)}</p>
                  </div>
                  <span className="min-w-12 text-right text-sm font-semibold text-cyan-600 dark:text-cyan-400">{uiTransparency.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.55}
                  max={1}
                  step={0.01}
                  value={uiTransparency}
                  onChange={event => setUiTransparency(Number(event.target.value))}
                  className="mt-4 h-2 w-full cursor-pointer accent-cyan-500"
                  aria-label="User interface transparency"
                />
              </div>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="space-y-6">
            {activeDragDropZones.length > 0 && renderConversionDropZones(activeDragDropZones)}
            <UploadArea />
          </div>
        ) : (
          <div className="space-y-6">
            {visibleDropZones.length > 0 && renderConversionDropZones(visibleDropZones)}
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
              <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{t('queue_title', language)} ({files.length})</h2>
              <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={handleConvertAll} disabled={convertAllDisabled} className="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition">
                  {getConvertAllButtonText()}
                </button>
                {isConverting && isStalled && (
                  <button onClick={handleCancelConversion} className="bg-red-500 text-white font-bold py-2 px-4 rounded hover:bg-red-600 transition">
                    {t('cancel_conversion', language)}
                  </button>
                )}
                <button onClick={reset} disabled={isConverting || isTraversing} className="bg-red-500 text-white font-bold py-2 px-4 rounded hover:bg-red-600 disabled:bg-gray-500 transition">
                  {t('clear_all', language)}
                </button>
                {files.some(file => file.status === 'error') && (
                  <button onClick={retryFailed} disabled={isConverting} className="bg-amber-500 text-white font-bold py-2 px-4 rounded hover:bg-amber-600 disabled:bg-gray-500 transition">
                    {t('retry_failed', language)}
                  </button>
                )}
              </div>
            </div>

            {files.length > 1 && (
              <div className="bg-gray-200 dark:bg-gray-700/50 p-4 rounded-lg space-y-4 border border-gray-300 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-cyan-700 dark:text-cyan-300">
                  {t('bulk_actions', language)}
                  {isConverting && <span className="ml-2 text-sm font-normal text-gray-500">({convertedCount}/{totalToConvert}{batchEtaSeconds !== null ? ` - ~${formatEta(batchEtaSeconds)} remaining` : ''})</span>}
                </h3>
                <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hasImageInQueue && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-end gap-2">
                            <div className="flex-grow">
                                <label htmlFor="bulk-image-format" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('apply_format_images', language)}</label>
                                <select
                                id="bulk-image-format"
                                value={bulkImageFormat}
                                onChange={(e) => setBulkImageFormat(e.target.value)}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                <option value="">{t('select_format', language)}</option>
                                {[ConversionTarget.JPG, ConversionTarget.PNG, ConversionTarget.WEBP, ConversionTarget.HEIC, ConversionTarget.AVIF, ConversionTarget.PDF, ConversionTarget.ICO, ConversionTarget.SVG].map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            <button onClick={handleApplyBulkImageFormat} disabled={!bulkImageFormat || isConverting} className="bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600 disabled:bg-gray-500 transition h-[42px]">{t('apply', language)}</button>
                        </div>
                        {bulkImageFormat === ConversionTarget.PDF && (
                            <div className="flex items-center space-x-2 mt-2">
                                <input type="checkbox" id="combine-pdf-checkbox" checked={combineToPdf} onChange={e => setCombineToPdf(e.target.checked)} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500 bg-gray-100 dark:bg-gray-900" />
                                <label htmlFor="combine-pdf-checkbox" className="text-sm text-gray-700 dark:text-gray-300">{t('combine_to_pdf', language)}</label>
                            </div>
                        )}
                    </div>
                  )}
                  {hasVideoInQueue && (
                    <div className="flex items-end gap-2">
                      <div className="flex-grow">
                        <label htmlFor="bulk-video-format" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('apply_format_videos', language)}</label>
                        <select
                          id="bulk-video-format"
                          value={bulkVideoFormat}
                          onChange={(e) => setBulkVideoFormat(e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="">{t('select_format', language)}</option>
                          {[ConversionTarget.MP4, ConversionTarget.WEBM, ConversionTarget.WMV, ConversionTarget.MKV, ConversionTarget.MP3, ConversionTarget.WAV, ConversionTarget.FLAC, ConversionTarget.OGG].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <button onClick={handleApplyBulkVideoFormat} disabled={!bulkVideoFormat || isConverting} className="bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600 disabled:bg-gray-500 transition h-[42px]">{t('apply', language)}</button>
                    </div>
                  )}
                  {hasAudioInQueue && (
                    <div className="flex items-end gap-2">
                      <div className="flex-grow">
                        <label htmlFor="bulk-audio-format" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('apply_format_audio', language)}</label>
                        <select
                          id="bulk-audio-format"
                          value={bulkAudioFormat}
                          onChange={(e) => setBulkAudioFormat(e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="">{t('select_format', language)}</option>
                          {[ConversionTarget.MP3, ConversionTarget.WAV, ConversionTarget.FLAC, ConversionTarget.OGG, ConversionTarget.TXT, ConversionTarget.SRT].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <button onClick={handleApplyBulkAudioFormat} disabled={!bulkAudioFormat || isConverting} className="bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600 disabled:bg-gray-500 transition h-[42px]">{t('apply', language)}</button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* ZIP Export Paneel */}
            {successfulConversions.length > 0 && (
              <div className="bg-gray-200 dark:bg-gray-700/50 p-4 rounded-lg space-y-4 border border-gray-300 dark:border-gray-600 animate-scale-in">
                <h3 className="text-lg font-semibold text-cyan-700 dark:text-cyan-300">{t('download_all_zip', language)}</h3>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-grow w-full">
                    <label htmlFor="zip-name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('zip_filename', language)}</label>
                    <input
                      id="zip-name"
                      type="text"
                      value={zipFileName}
                      onChange={(e) => setZipFileName(e.target.value)}
                      placeholder="converted-files"
                      className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  {vaultStatus.enabled && <select value={zipDestination} onChange={event => setZipDestination(event.target.value as 'folder' | 'vault')} className="h-[42px] rounded-md border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="vault">Opslaan in kluis</option><option value="folder">Opslaan in doelmap</option></select>}
                  <button 
                    onClick={startZipExport} 
                    disabled={isDownloadingZip} 
                    className="w-full sm:w-auto bg-blue-500 text-white font-bold py-2 px-6 rounded hover:bg-blue-600 disabled:bg-gray-500 transition h-[42px] flex items-center justify-center space-x-2"
                  >
                    {isDownloadingZip ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{t('zipping', language)}</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>{t('download_all_zip', language)}</span>
                      </>
                    )}
                  </button>
                </div>
                {isDownloadingZip && (
                  <div className="space-y-1" aria-live="polite">
                    <div className="flex justify-between gap-3 text-xs text-gray-600 dark:text-gray-300">
                      <span>Bestanden toevoegen aan ZIP: {Math.floor(zipProgress.completed)}/{zipProgress.total}</span>
                      <span>{zipProgress.total > 0 ? `${Math.round((zipProgress.completed / zipProgress.total) * 100)}%` : '0%'}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-300 dark:bg-gray-600">
                      <div className="h-2 rounded-full bg-blue-500 transition-all duration-200" style={{ width: `${zipProgress.total > 0 ? Math.min(100, (zipProgress.completed / zipProgress.total) * 100) : 0}%` }} />
                    </div>
                    {zipProgress.currentFile && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{zipProgress.currentFile}</p>}
                  </div>
                )}
              </div>
            )}
            
            {/* Pagination Controls Top */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 text-sm">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1 px-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                         &laquo;
                    </button>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 px-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                        &lsaquo;
                    </button>
                    <span className="text-gray-700 dark:text-gray-300 mx-2">
                        {t('page', language)} {currentPage} {t('of', language)} {totalPages}
                    </span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 px-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                        &rsaquo;
                    </button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1 px-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                        &raquo;
                    </button>
                </div>
            )}

            <div className="space-y-4 max-h-[50vh] overflow-y-auto overscroll-contain pr-2" ref={listRef}>
              {paginatedFiles.map(fileItem => <FileItemMemo key={fileItem.id} fileItem={fileItem} isConverting={isConverting} updateFileState={updateFileState} removeFile={removeFile} onRetry={retryFile} onDownload={saveDownload} lang={language} />)}
            </div>

            {/* Pagination Controls Bottom */}
             {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 text-sm pt-2">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <span className="text-gray-700 dark:text-gray-300 font-medium px-2">
                        {t('page', language)} {currentPage} {t('of', language)} {totalPages}
                    </span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 15.707a1 1 0 001.414 0l5-5a1 1 0 000-1.414l-5-5a1 1 0 00-1.414 1.414L8.586 10l-4.293 4.293a1 1 0 000 1.414zm6 0a1 1 0 001.414 0l5-5a1 1 0 000-1.414l-5-5a1 1 0 00-1.414 1.414L14.586 10l-4.293 4.293a1 1 0 000 1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            )}
            
            <div 
              onDrop={onDrop}
              onDragOver={onDragOver}
              className="border-2 border-dashed border-gray-400 dark:border-gray-700 rounded-lg p-6 text-center hover:border-cyan-500 dark:hover:border-cyan-400 transition"
            >
              <input id="file-upload-more" type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*,video/*,audio/*,application/pdf" />
              <input
                id="folder-upload-more"
                type="file"
                multiple
                {...{ webkitdirectory: "" }}
                className="hidden"
                onChange={handleFileChange}
              />
              {isTraversing ? (
                  <div className="flex justify-center items-center space-x-2 text-gray-600 dark:text-gray-400">
                    <svg className="animate-spin h-5 w-5 text-cyan-600 dark:text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('processing', language)}</span>
                  </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {t('add_more_files_prompt', language)}
                  <label htmlFor="file-upload-more" className="cursor-pointer text-cyan-600 dark:text-cyan-400 hover:underline px-1">
                      {t('add_files_link', language)}
                  </label>
                  {t('or', language)}
                  <label htmlFor="folder-upload-more" className="cursor-pointer text-cyan-600 dark:text-cyan-400 hover:underline pl-1">
                      {t('add_folder_link', language)}
                  </label>.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Engine Status Footer */}
      <div className="mt-6 flex flex-wrap justify-center gap-4 text-[10px] uppercase tracking-widest font-bold opacity-50">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isFfmpegReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
          <span>{t('media_engine', language)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isHeifReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
          <span>{t('heif_avif_engine', language)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isPdfReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
          <span>{t('pdf_engine', language)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isSvgReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
          <span>{t('svg_engine', language)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>3D Model Engine</span>
        </div>
      </div>
    </div>
  );
};

interface FileItemProps {
  fileItem: ConversionFile;
  isConverting: boolean;
  updateFileState: (id: string, newProps: Partial<ConversionFile>) => void;
  removeFile: (id: string) => void;
  onRetry: (id: string) => void;
  onDownload: (blob: Blob, fileName: string) => Promise<boolean>;
  lang: string;
}

const FileItem = memo<FileItemProps>(({ fileItem, isConverting, updateFileState, removeFile, onRetry, onDownload, lang }) => {
  const { id, file, status, targetFormat, readProgress, progress, etaSeconds, convertedFileUrl, outputPath, error } = fileItem;

  const { isImage, isVideo, isAudio, isPdf, isModel, isOffice, isArchive } = getMediaType(file);
  const isProcessing = status === 'reading' || status === 'converting';

  const availableFormats = getAvailableFormats(file);

  return (
    <div
      draggable={status === 'pending'}
      onDragStart={event => {
        if (status !== 'pending') return;
        event.dataTransfer.setData('application/x-fcp-file-id', id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      className={`bg-gray-200 dark:bg-gray-700/50 p-4 rounded-lg space-y-3 ${status === 'pending' ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-3 overflow-hidden">
          <FileIcon type={file.type} name={file.name} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-gray-900 dark:text-white">{file.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(file.size)}</p>
          </div>
        </div>
        <button onClick={() => removeFile(id)} disabled={isConverting} className="text-gray-500 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 ml-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {status === 'pending' && (
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label htmlFor={`format-${id}`} className="sr-only">{t('select_format', lang)}</label>
            <select
              id={`format-${id}`}
              value={targetFormat ?? ''}
              onChange={e => updateFileState(id, { targetFormat: e.target.value as ConversionTarget })}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              disabled={isConverting}
            >
              <option value="" disabled>{t('select_format', lang)}</option>
              {availableFormats.map(format => <option key={format} value={format}>{format === ConversionTarget.EXTRACT ? t('extract_archive', lang) : format}</option>)}
            </select>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="space-y-2">
          {status === 'reading' && <ProgressBar label={t('loading', lang)} progress={readProgress} color="cyan" />}
          {status === 'converting' && <ProgressBar label={t('converting', lang)} progress={progress} etaSeconds={etaSeconds} color="green" />}
        </div>
      )}

      {status === 'success' && convertedFileUrl && (
        <div className="space-y-3">
            {targetFormat === ConversionTarget.EXTRACT && outputPath ? (
              <div className="text-center p-4 bg-green-100 dark:bg-green-900/50 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-300">{t('archive_extracted_to', lang)}</p>
                <p className="mt-1 break-all text-xs text-green-700 dark:text-green-400">{outputPath}</p>
              </div>
            ) : convertedFileUrl === '#' ? (
                <div className="text-center p-4 bg-green-100 dark:bg-green-900/50 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-300">✅ {t('combine_to_pdf', lang)}</p>
                </div>
            ) : targetFormat === ConversionTarget.HEIC || targetFormat === ConversionTarget.AVIF || targetFormat === ConversionTarget.PDF ? (
               <div className="bg-gray-300 dark:bg-gray-700 p-4 rounded-lg text-center max-w-xs mx-auto">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{targetFormat} {t('preview_not_supported', lang)}</p>
               </div>
            ) : isModel ? (
                <div className="mx-auto max-w-xs rounded-lg bg-gray-300 p-4 text-center dark:bg-gray-700">
                  <div className="text-4xl" aria-hidden="true">3D</div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{targetFormat} model klaar voor download</p>
                </div>
            ) : isOffice ? (
                <div className="bg-gray-300 dark:bg-gray-700 p-4 text-center max-w-xs mx-auto rounded-lg">
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{targetFormat}</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{t('document_ready', lang)}</p>
                </div>
            ) : isVideo ? (
                <video src={convertedFileUrl} controls loop className="max-w-full max-h-48 mx-auto rounded-lg" />
            ) : isAudio ? (
                <audio src={convertedFileUrl} controls className="w-full" />
            ) : isPdf ? (
                <div className="bg-gray-300 dark:bg-gray-700 p-4 rounded-lg text-center max-w-xs mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Text Extracted</p>
                </div>
            ) : (
                <img src={convertedFileUrl} alt="Converted preview" className="max-w-xs max-h-48 mx-auto rounded-lg" />
            )}
          {convertedFileUrl !== '#' && <a href={convertedFileUrl} onClick={async event => {
            event.preventDefault();
            const response = await fetch(convertedFileUrl);
            if (response.ok) {
              await onDownload(await response.blob(), `${file.name.split('.').slice(0, -1).join('.')}.${targetFormat?.toLowerCase()}`);
            }
          }}
            className="block w-full text-center bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600 transition"
          >
            {t('download', lang)}
          </a>}
        </div>
      )}
      
      {status === 'error' && (
        <div className="text-center bg-red-200 dark:bg-red-900/50 border border-red-400 dark:border-red-700 p-2 rounded-lg">
          <p className="text-red-700 dark:text-red-400 text-sm font-semibold">{t('conversion_failed', lang)}</p>
          {error && <p className="text-red-600 dark:text-red-500 text-xs mt-1">{error}</p>}
          <button onClick={() => onRetry(id)} disabled={isConverting} className="mt-2 rounded bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50">{t('retry', lang)}</button>
        </div>
      )}
    </div>
  );
});

const FileItemMemo = FileItem;

const formatEta = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
};

const ProgressBar: React.FC<{label: string; progress: number, etaSeconds?: number | null, color: 'cyan' | 'green'}> = ({label, progress, etaSeconds, color}) => {
    const progressColor = color === 'cyan' ? 'bg-cyan-500' : 'bg-green-500';
    const textColor = color === 'cyan' ? 'text-cyan-600 dark:text-cyan-400' : 'text-green-600 dark:text-green-400';
    
    return (
        <div className="w-full space-y-1">
            <p className={`text-center text-xs font-semibold ${textColor}`}>{label} {progress >= 0 && progress <= 100 ? `${progress}%` : ''}{etaSeconds !== undefined && etaSeconds !== null && progress < 100 ? ` - ${formatEta(etaSeconds)} remaining` : ''}</p>
            <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2.5 relative overflow-hidden">
                <div
                className={`${progressColor} h-2.5 rounded-full transition-all duration-300`}
                style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
}

const FileIcon: React.FC<{ type: string; name: string }> = ({ type, name }) => {
    const { isImage, isVideo, isAudio, isPdf, isModel } = getMediaType(new File([], name, { type }));
    
    const icon = useMemo(() => {
        if (isImage) return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />;
        if (isVideo) return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2v8a2 2 0 002 2z" />;
        if (isAudio) return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 6l12-3" />;
        if (isPdf) return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />;
        if (isModel) return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 0v9m8-4.5l-8 4.5m-8-4.5l8 4.5" />;
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
    }, [isImage, isVideo, isAudio, isPdf, isModel]);

    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {icon}
        </svg>
    )
};

export default App;