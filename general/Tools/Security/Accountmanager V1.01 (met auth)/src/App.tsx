import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Plus, Trash2, Download, LogOut, Check, X, Eye, EyeOff, ShieldCheck, Upload, Search, ChevronRight, Globe, Edit, ArrowUpDown, ChevronDown, ShieldAlert, FileText, Copy, Smartphone, Folder as FolderIcon, FolderPlus, Move, ArrowLeft, RefreshCw, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { hashPassword, encryptData, decryptData, generateTOTPSecret, generateTOTPUri, verifyTOTP } from './utils/crypto';
import { db } from './utils/db';
import { Account, AppState, Folder } from './types';
import { Language, translations } from './translations';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { QRCodeSVG } from 'qrcode.react';

import { calculatePasswordStrength, generatePassword } from './utils/password';
import { copyToClipboard } from './utils/clipboard';

export default function App() {
  const [state, setState] = useState<AppState>('login');
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    if (saved && (['en', 'nl', 'de', 'tr', 'ja', 'zh'] as Language[]).includes(saved as Language)) {
      return saved as Language;
    }
    const browserLang = navigator.language.split('-')[0];
    return (['en', 'nl', 'de', 'tr', 'ja', 'zh'] as Language[]).includes(browserLang as Language) ? (browserLang as Language) : 'nl';
  });
  const [masterPassword, setMasterPassword] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isAuth, setIsAuth] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWebsite, setExpandedWebsite] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'az' | 'za' | 'most' | 'least'>('az');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [showSecurityScanModal, setShowSecurityScanModal] = useState(false);
  const [showSecurityReportModal, setShowSecurityReportModal] = useState(false);
  const [securityReportContent, setSecurityReportContent] = useState<string | null>(null);
  const [duplicatePasswords, setDuplicatePasswords] = useState<Record<string, Account[]>>({});
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [isMfaEnabled, setIsMfaEnabled] = useState(false);
  const [is3faEnabled, setIs3faEnabled] = useState(false);
  const [securityPin, setSecurityPin] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isFolderMode, setIsFolderMode] = useState(false);
  const [selectedWebsites, setSelectedWebsites] = useState<Set<string>>(new Set());
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [showMoveToFolderModal, setShowMoveToFolderModal] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [appIdentity, setAppIdentity] = useState<string | null>(null);

  const t = (key: string, params?: Record<string, any>) => {
    let text = translations[language][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  // Check if master password exists and load MFA status
  useEffect(() => {
    const init = async () => {
      let identity = await db.getIdentity();
      if (!identity) {
        identity = crypto.randomUUID();
        await db.saveIdentity(identity);
      }
      setAppIdentity(identity);

      const blob = await db.loadData();
      if (!blob) {
        setState('setup');
      } else {
        setState('login');
      }
    };
    init();
  }, []);

  const saveAppData = async (newAccounts?: Account[], newFolders?: Folder[], newMfaEnabled?: boolean, newMfaSecret?: string, new3faEnabled?: boolean, newPin?: string) => {
    if (!masterPassword) return;
    const data = {
      accounts: newAccounts ?? accounts,
      folders: newFolders ?? folders,
      mfaEnabled: newMfaEnabled ?? isMfaEnabled,
      mfaSecret: newMfaSecret ?? mfaSecret,
      threeFaEnabled: new3faEnabled ?? is3faEnabled,
      securityPin: newPin ?? securityPin,
      canary: 'VERIFIED'
    };
    // Use appIdentity for local storage too to link everything as requested
    const blob = await encryptData(JSON.stringify(data), masterPassword, appIdentity || '');
    await db.saveData(blob);
    if (newAccounts) setAccounts(newAccounts);
    if (newFolders) setFolders(newFolders);
    if (newMfaEnabled !== undefined) setIsMfaEnabled(newMfaEnabled);
    if (newMfaSecret) setMfaSecret(newMfaSecret);
    if (new3faEnabled !== undefined) setIs3faEnabled(new3faEnabled);
    if (newPin) setSecurityPin(newPin);
  };

  // Idle timer for automatic logout
  useEffect(() => {
    if (!isAuth) return;

    let timeout: any;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        handleLogout();
      }, 5 * 60 * 1000); // 5 minutes idle
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      clearTimeout(timeout);
    };
  }, [isAuth]);

  const handleSetup = async (password: string) => {
    const secret = generateTOTPSecret();
    const data = {
      accounts: [],
      mfaSecret: secret,
      mfaEnabled: false,
      canary: 'VERIFIED'
    };
    const blob = await encryptData(JSON.stringify(data), password, appIdentity || '');
    await db.saveData(blob);
    
    setMasterPassword(password);
    setMfaSecret(secret);
    setIsMfaEnabled(false);
    setAccounts([]);
    setState('mfa-setup');
  };

  const handleMfaSetup = async (token: string) => {
    if (mfaSecret && verifyTOTP(token, mfaSecret)) {
      setIsMfaEnabled(true);
      setState('pin-setup');
    } else {
      throw new Error(t('mfa_error'));
    }
  };

  const handlePinSetup = async (pin: string) => {
    const hashedPin = await hashPassword(pin);
    await saveAppData(accounts, folders, true, mfaSecret || undefined, true, hashedPin);
    setIsAuth(true);
    setState('dashboard');
  };

  const handleLogin = async (password: string) => {
    const blob = await db.loadData();
    if (!blob) return;

    try {
      // Try decrypting with appIdentity first
      let decrypted;
      try {
        decrypted = await decryptData(blob, password, appIdentity || '');
      } catch (e) {
        // Fallback for transition from legacy (no identity)
        decrypted = await decryptData(blob, password, '');
      }
      
      const data = JSON.parse(decrypted);
      
      setMasterPassword(password);
      setAccounts(data.accounts);
      setFolders(data.folders || []);
      setMfaSecret(data.mfaSecret);
      setIsMfaEnabled(data.mfaEnabled);
      setIs3faEnabled(data.threeFaEnabled || false);
      setSecurityPin(data.securityPin || null);

      if (data.mfaEnabled) {
        setState('mfa');
      } else if (data.threeFaEnabled) {
        setState('pin-login');
      } else {
        setIsAuth(true);
        setState('dashboard');
      }
    } catch (e) {
      throw new Error(t('error_wrong_password'));
    }
  };

  const handleMfaLogin = async (token: string) => {
    if (mfaSecret && verifyTOTP(token, mfaSecret)) {
      if (is3faEnabled) {
        setState('pin-login');
      } else {
        setIsAuth(true);
        setState('dashboard');
      }
    } else {
      throw new Error(t('mfa_error'));
    }
  };

  const handlePinLogin = async (pin: string) => {
    const hashed = await hashPassword(pin);
    if (hashed === securityPin) {
      setIsAuth(true);
      setState('dashboard');
    } else {
      throw new Error(t('error_invalid_pin'));
    }
  };

  const saveAccounts = async (newAccounts: Account[]) => {
    await saveAppData(newAccounts);
  };

  const addAccount = async (account: Omit<Account, 'id' | 'createdAt' | 'isDeleted' | 'deletedAt'>) => {
    const newAccount: Account = {
      ...account,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      isDeleted: false,
    };
    await saveAccounts([...accounts, newAccount]);
    setShowAddForm(false);
  };

  const deleteSelected = async () => {
    const updated = accounts.map(a => 
      selectedIds.has(a.id) 
        ? { ...a, isDeleted: true, deletedAt: Date.now() } 
        : a
    );
    await saveAccounts(updated);
    setSelectedIds(new Set());
    setIsDeleteMode(false);
  };

  const restoreAccount = async (id: string) => {
    const updated = accounts.map(a => 
      a.id === id ? { ...a, isDeleted: false, deletedAt: undefined } : a
    );
    await saveAccounts(updated);
  };

  const permanentlyDeleteAccount = async (id: string) => {
    const filtered = accounts.filter(a => a.id !== id);
    await saveAccounts(filtered);
  };

  const emptyTrash = async () => {
    const filtered = accounts.filter(a => !a.isDeleted);
    await saveAccounts(filtered);
    setShowTrashModal(false);
  };

  const handleLogout = () => {
    setMasterPassword('');
    setAccounts([]);
    setIsAuth(false);
    setState('login');
    setExpandedWebsite(null);
  };

  const handleFactoryReset = async () => {
    await db.deleteData();
    localStorage.removeItem('app_language');
    window.location.reload(); 
  };

  const exportData = async (zipPassword: string) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Account Overzicht', 20, 20);
    doc.setFontSize(12);
    
    accounts.forEach((acc, i) => {
      const y = 40 + (i * 45); // Increased spacing slightly
      doc.text(`Website/App: ${acc.website}`, 20, y);
      if (acc.url) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`URL: ${acc.url}`, 20, y + 5);
        doc.setFontSize(12);
        doc.setTextColor(0);
      }
      doc.text(`Gebruiker: ${acc.username}`, 20, y + 15);
      doc.text(`Wachtwoord: ${acc.password}`, 20, y + 25);
      doc.line(20, y + 30, 190, y + 30);
    });

    const pdfBlob = doc.output('blob');
    const zip = new JSZip();
    
    // Encrypt the PDF content
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Pdf = (reader.result as string).split(',')[1];
      const encryptedPdf = encryptData(base64Pdf, zipPassword, appIdentity || '');
      
      // Encrypt the raw data for importing later
      const rawData = JSON.stringify({ accounts, folders });
      const encryptedData = await encryptData(rawData, zipPassword, appIdentity || '');
      
      zip.file('accounts_report.txt', await encryptedPdf);
      zip.file('backup.dat', encryptedData);
      zip.file('README.txt', 'Dit bestand bevat uw geëncrypteerde accountgegevens.\n\n- accounts_report.txt: Versleutelde PDF (gebruik de app om te bekijken)\n- backup.dat: Systeem backup (gebruik de Import functie in de app)');
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `accounts_backup_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      setShowExportModal(false);
    };
    reader.readAsDataURL(pdfBlob);
  };

  const handleImport = async (file: File, zipPassword: string) => {
    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      
      const reportFile = content.file('veiligheidsrapport.txt');
      if (reportFile) {
        const encryptedReport = await reportFile.async('string');
        const decryptedReport = await decryptData(encryptedReport, zipPassword, appIdentity || '');
        setSecurityReportContent(decryptedReport);
        setShowImportModal(false);
        return;
      }

      const backupFile = content.file('backup.dat');
      if (!backupFile) throw new Error(t('error_no_backup'));

      const encryptedData = await backupFile.async('string');
      // Decrypt using appIdentity. If identity doesn't match, this will fail.
      const decryptedData = await decryptData(encryptedData, zipPassword, appIdentity || '');
      const parsed = JSON.parse(decryptedData);

      let importedAccounts: Account[] = [];
      let importedFolders: Folder[] = [];

      if (Array.isArray(parsed)) {
        importedAccounts = parsed;
      } else if (parsed && typeof parsed === 'object') {
        importedAccounts = parsed.accounts || [];
        importedFolders = parsed.folders || [];
      }

      if (importedAccounts.length === 0 && importedFolders.length === 0) throw new Error(t('error_invalid_format'));

      const seenIds = new Set(accounts.map(a => a.id));
      const mergedAccounts = [...accounts];
      
      importedAccounts.forEach(acc => {
        const id = acc.id || crypto.randomUUID();
        acc.id = id;
        if (!seenIds.has(id)) {
          mergedAccounts.push(acc);
          seenIds.add(id);
        }
      });

      // Merge folders
      const mergedFolders = [...folders];
      importedFolders.forEach(impFolder => {
        const existingFolder = mergedFolders.find(f => f.name === impFolder.name);
        if (existingFolder) {
          // Merge website names, avoiding duplicates
          const namesSet = new Set([...existingFolder.websiteNames, ...impFolder.websiteNames]);
          existingFolder.websiteNames = Array.from(namesSet);
        } else {
          mergedFolders.push(impFolder);
        }
      });

      await saveAppData(mergedAccounts, mergedFolders);
      setShowImportModal(false);
      alert(`${importedAccounts.length} ${t('import_success')}`);
    } catch (error) {
      console.error('Import failed:', error);
      alert(`${t('import_failed')}: ${error instanceof Error ? error.message : t('import_error_sub')}`);
    }
  };

  const handleEdit = async (updatedAccount: Account) => {
    const updated = accounts.map(a => a.id === updatedAccount.id ? updatedAccount : a);
    await saveAccounts(updated);
    setEditingAccount(null);
  };

  const runSecurityScan = () => {
    const passwordMap: Record<string, Account[]> = {};
    accounts.forEach(acc => {
      if (!passwordMap[acc.password]) {
        passwordMap[acc.password] = [];
      }
      passwordMap[acc.password].push(acc);
    });

    const duplicates: Record<string, Account[]> = {};
    Object.entries(passwordMap).forEach(([pass, accs]) => {
      if (accs.length > 1) {
        duplicates[pass] = accs;
      }
    });

    setDuplicatePasswords(duplicates);
    setShowSecurityScanModal(true);
  };

  const downloadSecurityReport = async (zipPassword: string) => {
    let report = `${t('report_header')}\n`;
    report += "==========================================\n\n";
    report += `${t('generated_on')}: ${new Date().toLocaleString()}\n\n`;

    if (Object.keys(duplicatePasswords).length === 0) {
      report += `${t('scan_safe')}\n`;
    } else {
      Object.entries(duplicatePasswords).forEach(([pass, accs]: [string, Account[]], index) => {
        report += `${t('group')} ${index + 1}: ${t('password')} "${pass}"\n`;
        report += `${t('used_at', { count: accs.length })}:\n`;
        accs.forEach((acc: Account) => {
          report += `  - ${acc.website} (${acc.username})${acc.url ? ` [${acc.url}]` : ''}\n`;
        });
        report += "\n";
      });
    }

    const zip = new JSZip();
    const encryptedReport = await encryptData(report, zipPassword, appIdentity || '');
    const rawData = JSON.stringify({ accounts, folders });
    const encryptedData = await encryptData(rawData, zipPassword, appIdentity || '');
    
    zip.file('veiligheidsrapport.txt', encryptedReport);
    zip.file('backup.dat', encryptedData);
    zip.file('README.txt', t('readme_text'));
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `beveiligingsrapport_${new Date().toISOString().split('T')[0]}.zip`;
    link.click();
    
    setShowSecurityReportModal(false);
    setShowSecurityScanModal(false);
  };

  const clearAllAccounts = async () => {
    await saveAccounts([]);
    setShowClearAllModal(false);
    setExpandedWebsite(null);
  };

  const addFolder = async (name: string) => {
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      websiteNames: [],
    };
    await saveAppData(accounts, [...folders, newFolder]);
    setShowAddFolderModal(false);
  };

  const moveWebsitesToFolder = async (folderId: string | null) => {
    const updatedFolders = folders.map(f => {
      // Remove selected websites from all folders first
      const filteredNames = f.websiteNames.filter(name => !selectedWebsites.has(name));
      
      if (f.id === folderId) {
        return { ...f, websiteNames: [...filteredNames, ...Array.from(selectedWebsites)] };
      }
      return { ...f, websiteNames: filteredNames };
    });
    
    await saveAppData(accounts, updatedFolders);
    setSelectedWebsites(new Set());
    setIsFolderMode(false);
    setShowMoveToFolderModal(false);
  };

  const deleteFolder = async (folderId: string) => {
    const updatedFolders = folders.filter(f => f.id !== folderId);
    await saveAppData(accounts, updatedFolders);
    setFolderToDelete(null);
    if (currentFolderId === folderId) setCurrentFolderId(null);
  };

  const filteredAccounts = accounts.filter(acc => 
    !acc.isDeleted && (
      acc.website.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (acc.url && acc.url.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  );

  const groupedAccounts = filteredAccounts.reduce((acc, curr) => {
    const site = curr.website || 'Unknown';
    if (!Object.prototype.hasOwnProperty.call(acc, site)) acc[site] = [];
    acc[site].push(curr);
    return acc;
  }, {} as Record<string, Account[]>);

  const sortedGroupedEntries = (Object.entries(groupedAccounts) as [string, Account[]][]).sort((a, b) => {
    switch (sortBy) {
      case 'az': return a[0].localeCompare(b[0]);
      case 'za': return b[0].localeCompare(a[0]);
      case 'most': return b[1].length - a[1].length;
      case 'least': return a[1].length - b[1].length;
      default: return 0;
    }
  });

  const websitesInFolders = new Set(folders.flatMap(f => f.websiteNames));
  
  const displayEntries = sortedGroupedEntries.filter(([website]) => {
    if (searchQuery) return true; // Show all matches when searching
    if (currentFolderId) {
      const folder = folders.find(f => f.id === currentFolderId);
      return folder?.websiteNames.includes(website);
    }
    return !websitesInFolders.has(website);
  });

  const displayFolders = (currentFolderId || searchQuery) ? [] : folders;

  if (state === 'setup') return <SetupScreen onComplete={handleSetup} t={t} identity={appIdentity} />;
  if (state === 'login') return (
    <>
      <LoginScreen onLogin={handleLogin} onReset={() => setShowResetModal(true)} t={t} />
      <AnimatePresence>
        {showResetModal && (
          <ResetConfirmModal 
            key="modal-reset"
            onClose={() => setShowResetModal(false)}
            onConfirm={handleFactoryReset}
            t={t}
          />
        )}
      </AnimatePresence>
    </>
  );
  if (state === 'mfa-setup' && mfaSecret) return <MfaSetupScreen secret={mfaSecret} onComplete={handleMfaSetup} t={t} />;
  if (state === 'mfa') return <MfaLoginScreen onLogin={handleMfaLogin} t={t} />;
  if (state === 'pin-setup') return <PinSetupScreen onComplete={handlePinSetup} t={t} />;
  if (state === 'pin-login') return <PinLoginScreen onComplete={handlePinLogin} t={t} />;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-neon-cyan selection:text-black">
      <div className="atmosphere" />
      
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10 p-6 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-neon-cyan neon-glow-cyan p-2 rounded-lg">
              <ShieldCheck className="text-black w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              {t('app_name')}
            </h1>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input 
              type="text"
              placeholder={t('search_placeholder')}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-neon-cyan outline-none transition-all text-sm placeholder:text-white/20"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            {currentFolderId && (
              <button 
                onClick={() => setCurrentFolderId(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white mr-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {/* Language Selector */}
            <div className="relative group mr-2">
              <button className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-sm hover:bg-white/10 transition-all">
                <Globe className="w-4 h-4 text-neon-cyan" />
                <span className="uppercase">{language}</span>
                <ChevronDown className="w-3 h-3 opacity-40" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-32 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-2xl">
                {(['en', 'nl', 'de', 'tr', 'ja', 'zh'] as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-neon-cyan hover:text-black transition-all flex items-center justify-between ${language === lang ? 'text-neon-cyan' : 'text-white/60'}`}
                  >
                    <span className="uppercase font-bold">{lang}</span>
                    {language === lang && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>{t('sort')}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showSortDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-56 glass-card rounded-2xl border border-white/10 overflow-hidden z-50 shadow-2xl"
                  >
                    {[
                      { id: 'az', label: t('sort_az') },
                      { id: 'za', label: t('sort_za') },
                      { id: 'most', label: t('sort_most') },
                      { id: 'least', label: t('sort_least') }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSortBy(opt.id as any);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                          sortBy === opt.id ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {opt.label}
                        {sortBy === opt.id && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Actions Bar */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-[#00f2ff] text-black px-6 py-3 rounded-xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {t('add_account')}
          </button>

          <button 
            onClick={() => setShowAddFolderModal(true)}
            className="flex items-center gap-2 bg-white/10 border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all text-white"
          >
            <FolderPlus className="w-5 h-5" />
            {t('add_folder')}
          </button>

          <button 
            onClick={() => {
              setIsFolderMode(!isFolderMode);
              setSelectedWebsites(new Set());
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border ${
              isFolderMode 
              ? 'bg-[#00f2ff]/20 border-[#00f2ff] text-[#00f2ff]' 
              : 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
            }`}
          >
            <Move className="w-5 h-5" />
            {t('select_for_folder')}
          </button>
          
          <button 
            onClick={() => setIsDeleteMode(!isDeleteMode)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border ${
              isDeleteMode 
              ? 'bg-red-500/20 border-red-500 text-red-400' 
              : 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
            }`}
          >
            <Trash2 className="w-5 h-5" />
            {isDeleteMode ? t('cancel') : t('delete')}
          </button>

          <button 
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 bg-white/10 border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all text-white"
          >
            <Upload className="w-5 h-5" />
            {t('export')}
          </button>

          <button 
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-white/10 border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all text-white"
          >
            <Download className="w-5 h-5" />
            {t('import')}
          </button>

          <button 
            onClick={runSecurityScan}
            className="flex items-center gap-2 bg-[#00f2ff]/10 border border-[#00f2ff]/30 px-6 py-3 rounded-xl font-bold hover:bg-[#00f2ff]/20 transition-all text-[#00f2ff]"
          >
            <ShieldAlert className="w-5 h-5" />
            {t('scan_security')}
          </button>

          <button 
            onClick={() => setShowTrashModal(true)}
            className="flex items-center gap-2 bg-white/10 border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all text-white/70"
          >
            <Trash2 className="w-5 h-5" />
            {t('trash')} ({accounts.filter(a => a.isDeleted).length})
          </button>

          <button 
            onClick={() => setShowClearAllModal(true)}
            className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 px-6 py-3 rounded-xl font-bold hover:bg-red-500/30 transition-all text-red-400 ml-auto"
          >
            <Trash2 className="w-5 h-5" />
            {t('clear_all')}
          </button>
        </div>

        {isDeleteMode && selectedIds.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex justify-between items-center"
          >
            <span className="text-red-400 font-medium">{selectedIds.size} {t('selected')}</span>
            <button 
              onClick={deleteSelected}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-[0_0_10px_rgba(220,38,38,0.5)]"
            >
              {t('confirm_delete')}
            </button>
          </motion.div>
        )}

        {isFolderMode && selectedWebsites.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl flex justify-between items-center"
          >
            <span className="text-neon-cyan font-medium">{selectedWebsites.size} {t('selected')}</span>
            <button 
              onClick={() => setShowMoveToFolderModal(true)}
              className="bg-neon-cyan text-black px-4 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all neon-glow-cyan"
            >
              {t('move_to_folder')}
            </button>
          </motion.div>
        )}

        {/* Account Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          <AnimatePresence mode="popLayout">
            {displayFolders.map((folder) => (
              <FolderTile 
                key={`folder-${folder.id}`}
                folder={folder}
                onClick={() => setCurrentFolderId(folder.id)}
                onDelete={(e) => {
                  e.stopPropagation();
                  setFolderToDelete(folder);
                }}
                t={t}
              />
            ))}
            {displayEntries.length === 0 && displayFolders.length === 0 ? (
              <motion.div 
                key="empty-state-placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10"
              >
                <p className="text-white/30 italic">{t('no_accounts')}</p>
              </motion.div>
            ) : (
              displayEntries.map(([website, websiteAccounts]) => (
                <WebsiteTile 
                  key={`website-${website}`}
                  website={website}
                  url={websiteAccounts[0]?.url}
                  count={websiteAccounts.length}
                  onClick={() => {
                    if (isFolderMode) {
                      const next = new Set(selectedWebsites);
                      if (next.has(website)) next.delete(website);
                      else next.add(website);
                      setSelectedWebsites(next);
                    } else {
                      setExpandedWebsite(website);
                    }
                  }}
                  isSelected={selectedWebsites.has(website)}
                  isSelectionMode={isFolderMode}
                  t={t}
                />
              ))
            )}
          </AnimatePresence>
        </div>
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-white/20 pb-8">
          <div className="flex items-center gap-4">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] font-bold tracking-widest uppercase">AES-256 + Argon2id Protected</span>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-1">
            <span className="text-[9px] uppercase tracking-widest font-bold">{t('app_identity')}</span>
            <span className="text-[10px] font-mono text-white/10 select-all">{appIdentity}</span>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {expandedWebsite && (
          <ExpandedWebsiteView 
            website={expandedWebsite}
            accounts={groupedAccounts[expandedWebsite] || []}
            isDeleteMode={isDeleteMode}
            selectedIds={selectedIds}
            onToggleSelect={(id) => {
              const next = new Set(selectedIds);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              setSelectedIds(next);
            }}
            onClose={() => setExpandedWebsite(null)}
            onEdit={(acc) => {
              setExpandedWebsite(null);
              setEditingAccount(acc);
            }}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showAddForm && (
          <AddAccountModal 
            key="modal-add"
            onClose={() => setShowAddForm(false)} 
            onAdd={addAccount} 
            t={t}
          />
        )}
        {showExportModal && (
          <ExportModal 
            key="modal-export"
            onClose={() => setShowExportModal(false)} 
            onExport={exportData} 
            t={t}
          />
        )}
        {showImportModal && (
          <ImportModal 
            key="modal-import"
            onClose={() => setShowImportModal(false)} 
            onImport={handleImport} 
            t={t}
            identity={appIdentity}
          />
        )}
        {editingAccount && (
          <EditAccountModal 
            key="modal-edit"
            account={editingAccount}
            onClose={() => setEditingAccount(null)}
            onEdit={handleEdit}
            t={t}
          />
        )}
        {showClearAllModal && (
          <ClearAllModal 
            key="modal-clear-all"
            onClose={() => setShowClearAllModal(false)}
            onConfirm={clearAllAccounts}
            t={t}
          />
        )}
        {showSecurityScanModal && (
          <SecurityScanModal 
            key="modal-security-scan"
            duplicates={duplicatePasswords}
            onClose={() => setShowSecurityScanModal(false)}
            onDownload={() => setShowSecurityReportModal(true)}
            t={t}
          />
        )}
        {showSecurityReportModal && (
          <SecurityReportModal 
            key="modal-security-report"
            onClose={() => setShowSecurityReportModal(false)}
            onConfirm={downloadSecurityReport}
            t={t}
          />
        )}
        {securityReportContent && (
          <ViewReportModal 
            key="modal-view-report"
            content={securityReportContent}
            onClose={() => setSecurityReportContent(null)}
            t={t}
          />
        )}
        {showAddFolderModal && (
          <AddFolderModal 
            key="modal-add-folder"
            onClose={() => setShowAddFolderModal(false)}
            onAdd={addFolder}
            t={t}
          />
        )}
        {showMoveToFolderModal && (
          <MoveToFolderModal 
            key="modal-move-to-folder"
            folders={folders}
            onClose={() => setShowMoveToFolderModal(false)}
            onMove={moveWebsitesToFolder}
            t={t}
          />
        )}
        {folderToDelete && (
          <ConfirmFolderDeleteModal 
            key="modal-confirm-folder-delete"
            folder={folderToDelete}
            onClose={() => setFolderToDelete(null)}
            onConfirm={() => deleteFolder(folderToDelete.id)}
            t={t}
          />
        )}
        {showTrashModal && (
          <TrashModal 
            key="modal-trash"
            accounts={accounts.filter(a => a.isDeleted)}
            onClose={() => setShowTrashModal(false)}
            onRestore={restoreAccount}
            onDelete={permanentlyDeleteAccount}
            onEmpty={emptyTrash}
            t={t}
          />
        )}
        {showResetModal && (
          <ResetConfirmModal 
            key="modal-reset"
            onClose={() => setShowResetModal(false)}
            onConfirm={handleFactoryReset}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SetupScreen({ onComplete, t, identity }: { onComplete: (p: string) => void | Promise<void>, t: (k: string, p?: any) => string, identity: string | null }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (p1.length < 6) return setError(t('error_min_length'));
    if (p1 !== p2) return setError(t('error_mismatch'));
    
    setIsLoading(true);
    setError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 50));
      await onComplete(p1);
    } catch (err: any) {
      setError(err.message || 'Setup is mislukt.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="atmosphere" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="bg-neon-cyan neon-glow-cyan w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="text-black w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">{t('setup_title')}</h2>
          <p className="text-white/60 mt-2">{t('setup_sub')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-2"
            >
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
          <input 
            type="password" 
            placeholder={t('password')} 
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all disabled:opacity-50"
            value={p1}
            onChange={e => setP1(e.target.value)}
            disabled={isLoading}
            required
          />
          <input 
            type="password" 
            placeholder={t('confirm_password')} 
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all disabled:opacity-50"
            value={p2}
            onChange={e => setP2(e.target.value)}
            disabled={isLoading}
            required
          />
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#00f2ff] text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{t('start')}...</span>
              </>
            ) : (
              t('start')
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mb-2">
            {t('app_identity')}
          </p>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 font-mono text-[10px] text-white/40 break-all select-all">
            {identity}
          </div>
          <p className="text-[9px] text-white/20 mt-2 leading-relaxed italic">
            {t('identity_warning')}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function LoginScreen({ onLogin, onReset, t }: { onLogin: (p: string) => void | Promise<void>, onReset: () => void, t: (k: string, p?: any) => string }) {
  const [p, setP] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 50));
      await onLogin(p);
    } catch (err: any) {
      setError(err.message || t('error_wrong_password'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="atmosphere" />
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="bg-neon-cyan neon-glow-cyan w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="text-black w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">{t('login_title')}</h2>
          <p className="text-white/60 mt-2">{t('login_sub')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-2"
            >
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
          <input 
            type="password" 
            placeholder={t('master_password')} 
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all disabled:opacity-50"
            value={p}
            onChange={e => setP(e.target.value)}
            disabled={isLoading}
            autoFocus
            required
          />
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#00f2ff] text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{t('unlock')}...</span>
              </>
            ) : (
              t('unlock')
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <button 
            onClick={onReset}
            disabled={isLoading}
            className="text-xs font-bold uppercase tracking-widest text-[#00f2ff]/60 hover:text-red-500 transition-all disabled:opacity-50"
          >
            {t('reset_app')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ResetConfirmModal({ onClose, onConfirm, t }: { key?: string, onClose: () => void, onConfirm: () => void, t: (k: string, p?: any) => string }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-[60]">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-red-500/20 p-2 rounded-lg">
            <ShieldAlert className="text-red-500 w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('danger_zone')}</h2>
        </div>
        
        <h3 className="text-lg font-bold text-white mb-2">{t('reset_confirm_title')}</h3>
        <p className="text-white/60 mb-8 leading-relaxed">
          {t('reset_confirm_sub')}
        </p>

        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            className="w-full bg-red-600 text-white p-4 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
          >
            {t('yes')}
          </button>
          <button 
            onClick={onClose}
            className="w-full bg-white/5 p-4 rounded-2xl font-bold text-white/60 hover:bg-white/10 transition-all"
          >
            {t('no')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function WebsiteTile({ website, url, count, onClick, isSelected, isSelectionMode, t }: { 
  key?: string,
  website: string, 
  url?: string, 
  count: number, 
  onClick: () => void, 
  isSelected?: boolean, 
  isSelectionMode?: boolean, 
  t: (k: string, p?: any) => string 
}) {
  const [imgError, setImgError] = useState(false);
  
  const getDomain = (w: string, u?: string) => {
    if (u) {
      try {
        const normalizedUrl = u.startsWith('http') ? u : `https://${u}`;
        return new URL(normalizedUrl).hostname;
      } catch {
        return w;
      }
    }
    return w;
  };

  const logoUrl = `https://www.google.com/s2/favicons?domain=${getDomain(website, url)}&sz=128`;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`aspect-square glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center text-center cursor-pointer group transition-all relative overflow-hidden border-2 ${
        isSelected ? 'border-neon-cyan bg-neon-cyan/10 neon-glow-cyan' : 'border-transparent hover:border-neon-cyan/50'
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {isSelectionMode && (
        <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-20 ${
          isSelected ? 'bg-neon-cyan border-neon-cyan' : 'border-white/20'
        }`}>
          {isSelected && <Check className="text-black w-4 h-4" />}
        </div>
      )}

      <div className="bg-white/5 p-4 rounded-2xl mb-4 group-hover:bg-neon-cyan/10 transition-colors flex items-center justify-center w-16 h-16 overflow-hidden">
        {!imgError ? (
          <img 
            src={logoUrl} 
            alt={website} 
            className="w-10 h-10 object-contain group-hover:scale-110 transition-transform"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <Globe className="w-8 h-8 text-white/40 group-hover:text-neon-cyan transition-colors" />
        )}
      </div>
      
      <h3 className="font-bold text-lg text-white/90 truncate w-full px-2">{website}</h3>
      
      {url && (
        <a 
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] text-neon-cyan/60 hover:text-neon-cyan truncate w-full px-4 mt-1 hover:underline z-10"
        >
          {url.replace(/^https?:\/\//i, '')}
        </a>
      )}

      <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-bold">
        {count} {count === 1 ? t('account') : t('accounts')}
      </p>

      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
        <ChevronRight className="w-4 h-4 text-neon-cyan" />
      </div>
    </motion.div>
  );
}

function FolderTile({ folder, onClick, onDelete, t }: { 
  key?: string,
  folder: Folder, 
  onClick: () => void, 
  onDelete: (e: React.MouseEvent) => void,
  t: (k: string, p?: any) => string 
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="aspect-square glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center text-center cursor-pointer group hover:border-neon-cyan/50 transition-all relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <button 
        onClick={onDelete}
        className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-red-500/20 rounded-xl text-white/20 hover:text-red-500 transition-all z-20 opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="bg-neon-cyan/10 p-4 rounded-2xl mb-4 group-hover:bg-neon-cyan/20 transition-colors flex items-center justify-center w-16 h-16">
        <FolderIcon className="w-10 h-10 text-neon-cyan" />
      </div>
      
      <div className="relative z-10">
        <h3 className="font-bold text-lg text-white truncate w-full px-2">{folder.name}</h3>
        <p className="text-xs text-white/40 mt-1">{folder.websiteNames.length} {t('website')}{folder.websiteNames.length !== 1 ? 's' : ''}</p>
      </div>
    </motion.div>
  );
}

function ExpandedWebsiteView({ website, accounts, isDeleteMode, selectedIds, onToggleSelect, onEdit, onClose, t }: { 
  website: string, 
  accounts: Account[], 
  isDeleteMode: boolean,
  selectedIds: Set<string>,
  onToggleSelect: (id: string) => void,
  onEdit: (account: Account) => void,
  onClose: () => void,
  t: (k: string, p?: any) => string
}) {
  const getDomain = (w: string, u?: string) => {
    if (u) {
      try {
        const normalizedUrl = u.startsWith('http') ? u : `https://${u}`;
        return new URL(normalizedUrl).hostname;
      } catch {
        return w;
      }
    }
    return w;
  };

  const logoUrl = `https://www.google.com/s2/favicons?domain=${getDomain(website, accounts[0]?.url)}&sz=128`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
      />
      
      <motion.div 
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        className="glass-card w-full max-w-2xl rounded-[3rem] overflow-hidden relative z-10 flex flex-col max-h-[80vh]"
      >
        <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-4">
            <div className="bg-neon-cyan/20 p-3 rounded-2xl w-14 h-14 flex items-center justify-center overflow-hidden">
              <img 
                src={logoUrl} 
                alt={website} 
                className="w-8 h-8 object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
                referrerPolicy="no-referrer"
              />
              <Globe className="w-8 h-8 text-neon-cyan absolute" style={{ zIndex: -1 }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{website}</h2>
              <p className="text-sm text-white/40">{accounts.length} {t('stored_accounts')}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-white/10 rounded-full text-white/60 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-4">
          {accounts.map(acc => (
            <AccountCard 
              key={acc.id}
              account={acc}
              isDeleteMode={isDeleteMode}
              isSelected={selectedIds.has(acc.id)}
              onToggleSelect={onToggleSelect}
              onEdit={() => onEdit(acc)}
              t={t}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

interface AccountCardProps {
  key?: string;
  account: Account;
  isDeleteMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: () => void;
  t: (k: string, p?: any) => string;
}

function MfaSetupScreen({ secret, onComplete, t }: { secret: string, onComplete: (token: string) => void | Promise<void>, t: (k: string, p?: any) => string }) {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uri = generateTOTPUri('User', 'AccountManager', secret);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await onComplete(token);
    } catch (err: any) {
      setError(err.message || t('mfa_error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="atmosphere" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="bg-neon-cyan neon-glow-cyan w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="text-black w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">{t('mfa_setup_title')}</h2>
          <p className="text-white/60 mt-2">{t('mfa_setup_sub')}</p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl mb-8 flex justify-center">
          <QRCodeSVG value={uri} size={200} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-2"
            >
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
          <input 
            type="text" 
            placeholder={t('mfa_code')} 
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all text-center text-2xl tracking-[0.5em] disabled:opacity-50"
            value={token}
            onChange={e => setToken(e.target.value)}
            disabled={isLoading}
            maxLength={6}
            required
          />
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#00f2ff] text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{t('mfa_verify')}...</span>
              </>
            ) : (
              t('mfa_verify')
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function MfaLoginScreen({ onLogin, t }: { onLogin: (token: string) => void | Promise<void>, t: (k: string, p?: any) => string }) {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await onLogin(token);
    } catch (err: any) {
      setError(err.message || t('mfa_error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="atmosphere" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="bg-neon-cyan neon-glow-cyan w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="text-black w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">{t('mfa_login_title')}</h2>
          <p className="text-white/60 mt-2">{t('mfa_login_sub')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-2"
            >
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
          <input 
            type="text" 
            placeholder={t('mfa_code')} 
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all text-center text-2xl tracking-[0.5em] disabled:opacity-50"
            value={token}
            onChange={e => setToken(e.target.value)}
            disabled={isLoading}
            maxLength={6}
            autoFocus
            required
          />
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#00f2ff] text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{t('unlock')}...</span>
              </>
            ) : (
              t('unlock')
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function PinPad({ onComplete, t, title, subTitle }: { onComplete: (pin: string) => void | Promise<void>, t: (k: string) => string, title: string, subTitle: string }) {
  const [pin, setPin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleInput = async (num: string) => {
    if (isLoading || pin.length >= 6) return;
    const newPin = pin + num;
    setPin(newPin);
    setError(null);

    if (newPin.length === 6) {
      if (!confirming && title === t('pin_setup_title')) {
        setTimeout(() => {
          setFirstPin(newPin);
          setPin('');
          setConfirming(true);
        }, 300);
      } else if (confirming) {
        if (newPin === firstPin) {
          setIsLoading(true);
          try {
            await new Promise(resolve => setTimeout(resolve, 300));
            await onComplete(newPin);
          } catch (err: any) {
            setError(err.message || t('error_invalid_pin'));
            setPin('');
          } finally {
            setIsLoading(false);
          }
        } else {
          setTimeout(() => {
            setError(t('pin_mismatch'));
            setPin('');
          }, 300);
        }
      } else {
        setTimeout(async () => {
          setIsLoading(true);
          try {
            await onComplete(newPin);
          } catch (err: any) {
            setError(err.message || t('error_invalid_pin'));
            setPin('');
          } finally {
            setIsLoading(false);
          }
        }, 300);
      }
    }
  };

  const handleBackspace = () => {
    if (isLoading) return;
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="atmosphere" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-8">
          <div className="bg-neon-cyan neon-glow-cyan w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="text-black w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            {confirming ? t('confirm_pin') : title}
          </h2>
          <p className="text-white/60 mt-2">{subTitle}</p>
        </div>

        <div className="flex justify-center gap-3 mb-10 h-6 items-center">
          {isLoading ? (
            <RefreshCw className="w-6 h-6 animate-spin text-neon-cyan" />
          ) : (
            [...Array(6)].map((_, i) => (
              <div 
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                  pin.length > i 
                    ? 'bg-neon-cyan border-neon-cyan shadow-[0_0_10px_#00ffff]' 
                    : 'border-white/20'
                }`}
              />
            ))
          )}
        </div>

        {error && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-500 text-sm font-bold text-center -mt-6 mb-6"
          >
            {error}
          </motion.p>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              disabled={isLoading}
              onClick={() => handleInput(num.toString())}
              className="aspect-square bg-white/5 hover:bg-white/10 rounded-2xl text-2xl font-bold flex items-center justify-center transition-all active:scale-95 text-white/80 hover:text-white border border-white/5 hover:border-white/10 disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            disabled={isLoading}
            onClick={() => handleInput('0')}
            className="aspect-square bg-white/5 hover:bg-white/10 rounded-2xl text-2xl font-bold flex items-center justify-center transition-all active:scale-95 text-white/80 hover:text-white border border-white/5 hover:border-white/10 disabled:opacity-50"
          >
            0
          </button>
          <button
            disabled={isLoading || pin.length === 0}
            onClick={handleBackspace}
            className="aspect-square bg-white/5 hover:bg-white/10 rounded-2xl text-2xl font-bold flex items-center justify-center transition-all active:scale-95 text-white/80 hover:text-white/60 border border-white/5 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PinSetupScreen({ onComplete, t }: { onComplete: (pin: string) => void | Promise<void>, t: (k: string) => string }) {
  return <PinPad onComplete={onComplete} t={t} title={t('pin_setup_title')} subTitle={t('pin_setup_sub')} />;
}

function PinLoginScreen({ onComplete, t }: { onComplete: (pin: string) => void | Promise<void>, t: (k: string) => string }) {
  return <PinPad onComplete={onComplete} t={t} title={t('pin_login_title')} subTitle={t('pin_login_sub')} />;
}

function CopyButton({ text, t }: { text: string, t: (k: string, p?: any) => string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      // Clear clipboard after 30 seconds for security
      setTimeout(() => {
        copyToClipboard('');
      }, 30000);
    }
  };

  return (
    <button 
      onClick={handleCopy}
      className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-neon-cyan transition-all relative group"
      title={t('copy')}
    >
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-green-400 text-black text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap">
          {t('copied')}
        </span>
      )}
    </button>
  );
}

function AccountCard({ account, isDeleteMode, isSelected, onToggleSelect, onEdit, t }: AccountCardProps) {
  const [showPass, setShowPass] = useState(false);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => isDeleteMode && onToggleSelect(account.id)}
      className={`glass-card p-6 rounded-3xl transition-all cursor-pointer group ${
        isSelected ? 'border-neon-cyan bg-neon-cyan/10 neon-glow-cyan' : 'hover:border-white/20'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-white">{account.website}</h3>
                {account.url && (
                  <a 
                    href={account.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-neon-cyan hover:underline truncate max-w-[200px] opacity-80 hover:opacity-100"
                  >
                    {account.url}
                  </a>
                )}
              </div>
              {isDeleteMode && (
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-neon-cyan border-neon-cyan' : 'border-white/20'
                }`}>
                  {isSelected && <Check className="text-black w-4 h-4" />}
                </div>
              )}
            </div>
            {!isDeleteMode && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-2 hover:bg-white/10 rounded-xl text-white/40 hover:text-neon-cyan transition-all opacity-0 group-hover:opacity-100"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5 group/field">
              <p className="text-sm text-white/60 flex items-center gap-2">
                <span className="font-medium text-white/40">{t('username')}:</span> {account.username}
              </p>
              <div onClick={e => e.stopPropagation()}>
                <CopyButton text={account.username} t={t} />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5 group/field">
              <div className="flex items-center gap-2">
                <p className="text-sm text-white/40 font-medium">{t('password')}:</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white/80">
                    {showPass ? account.password : '••••••••'}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowPass(!showPass); }}
                    className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white/80"
                  >
                    {showPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div onClick={e => e.stopPropagation()}>
                <CopyButton text={account.password} t={t} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AddAccountModal({ onClose, onAdd, t }: { key?: string, onClose: () => void, onAdd: (a: Omit<Account, 'id' | 'createdAt' | 'isDeleted' | 'deletedAt'>) => void, t: (k: string, p?: any) => string }) {
  const [form, setForm] = useState({ username: '', password: '', website: '', url: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalUrl = form.url.trim();
    if (finalUrl && !finalUrl.includes('://')) {
      finalUrl = `https://${finalUrl}`;
    }

    onAdd({
      ...form,
      website: form.website.trim(),
      url: finalUrl || undefined
    });
  };

  const handleGenerate = () => {
    setForm({ ...form, password: generatePassword() });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full text-white/60">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold mb-6 text-white">{t('new_account')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">{t('website_name')}</label>
            <input 
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all"
              value={form.website}
              onChange={e => setForm({...form, website: e.target.value})}
              placeholder={t('website_placeholder')}
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">{t('url_optional')}</label>
            <input 
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all"
              value={form.url}
              onChange={e => setForm({...form, url: e.target.value})}
              placeholder="https://www.netflix.com"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">{t('username_email')}</label>
            <input 
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all"
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
              required
            />
          </div>
          <div className="relative">
            <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">{t('password')}</label>
            <div className="relative group">
              <input 
                type="text"
                className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all pr-12"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                required
              />
              <button 
                type="button"
                onClick={handleGenerate}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-neon-cyan hover:text-black rounded-xl text-neon-cyan transition-all"
                title={t('generate_password')}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
            {form.password && (
              <div className="mt-2">
                <PasswordStrengthBar password={form.password} t={t} />
              </div>
            )}
          </div>
          <button className="w-full bg-neon-cyan text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all neon-glow-cyan mt-4">
            {t('save_account')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function EditAccountModal({ account, onClose, onEdit, t }: { key?: string, account: Account, onClose: () => void, onEdit: (a: Account) => void, t: (k: string, p?: any) => string }) {
  const [form, setForm] = useState({ username: account.username, password: account.password, website: account.website, url: account.url || '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalUrl = form.url.trim();
    if (finalUrl && !finalUrl.includes('://')) {
      finalUrl = `https://${finalUrl}`;
    }

    onEdit({
      ...account,
      username: form.username,
      password: form.password,
      website: form.website.trim(),
      url: finalUrl || undefined
    });
  };

  const handleGenerate = () => {
    setForm({ ...form, password: generatePassword() });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full text-white/60">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold mb-6 text-white">{t('edit_account')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">{t('website_name')}</label>
            <input 
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all"
              value={form.website}
              onChange={e => setForm({...form, website: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">{t('url_optional')}</label>
            <input 
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all"
              value={form.url}
              onChange={e => setForm({...form, url: e.target.value})}
              placeholder="https://www.netflix.com"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">{t('username_email')}</label>
            <input 
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all"
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
              required
            />
          </div>
          <div className="relative">
            <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">{t('password')}</label>
            <div className="relative group">
              <input 
                type="text"
                className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all pr-12"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                required
              />
              <button 
                type="button"
                onClick={handleGenerate}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-neon-cyan hover:text-black rounded-xl text-neon-cyan transition-all"
                title={t('generate_password')}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
            {form.password && (
              <div className="mt-2">
                <PasswordStrengthBar password={form.password} t={t} />
              </div>
            )}
          </div>
          <button className="w-full bg-[#00f2ff] text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]">
            {t('save_changes')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function ImportModal({ onClose, onImport, t, identity }: { key?: string, onClose: () => void, onImport: (f: File, p: string) => void, t: (k: string, p?: any) => string, identity: string | null }) {
  const [p, setP] = useState('');
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full text-white/60">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold mb-2 text-white">{t('import_backup')}</h2>
        <p className="text-white/60 mb-6">{t('import_sub')}</p>
        <form onSubmit={(e) => { e.preventDefault(); if(file) onImport(file, p); }} className="space-y-4">
          <div className="relative">
            <input 
              type="file"
              accept=".zip"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="import-file"
              required
            />
            <label 
              htmlFor="import-file"
              className="w-full p-4 bg-white/5 rounded-2xl border border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-all"
            >
              <Upload className="w-8 h-8 text-neon-cyan mb-2" />
              <span className="text-sm text-white/60">
                {file ? file.name : t('click_to_select')}
              </span>
            </label>
          </div>
          <input 
            type="password"
            placeholder={t('zip_password')}
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all"
            value={p}
            onChange={e => setP(e.target.value)}
            required
          />
          <button className="w-full bg-[#00f2ff] text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]">
            {t('start_import')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
            {t('app_identity')}
          </p>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 font-mono text-[9px] text-white/30 break-all select-all">
            {identity}
          </div>
          <p className="text-[9px] text-red-400/60 leading-relaxed italic">
            {t('identity_warning')}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function ExportModal({ onClose, onExport, t }: { key?: string, onClose: () => void, onExport: (p: string) => void, t: (k: string, p?: any) => string }) {
  const [p, setP] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full text-white/60">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold mb-2 text-white">{t('secure_export')}</h2>
        <p className="text-white/60 mb-6">{t('export_sub')}</p>
        <form onSubmit={(e) => { e.preventDefault(); onExport(p); }} className="space-y-4">
          <input 
            type="password"
            placeholder={t('zip_password')}
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all"
            value={p}
            onChange={e => setP(e.target.value)}
            required
          />
          <button className="w-full bg-[#00f2ff] text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]">
            {t('generate_download')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function ClearAllModal({ onClose, onConfirm, t }: { key?: string, onClose: () => void, onConfirm: () => void, t: (k: string, p?: any) => string }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative text-center"
      >
        <div className="bg-red-500/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Trash2 className="text-red-500 w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-white">{t('clear_all_confirm')}</h2>
        <p className="text-white/60 mb-8">
          {t('clear_all_sub')}
        </p>
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-4 bg-white/5 rounded-2xl font-bold text-white/60 hover:bg-white/10 transition-all"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]"
          >
            {t('yes_clear_all')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SecurityScanModal({ duplicates, onClose, onDownload, t }: { key?: string, duplicates: Record<string, Account[]>, onClose: () => void, onDownload: () => void, t: (k: string, p?: any) => string }) {
  const duplicateCount = Object.keys(duplicates).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative text-center"
      >
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${duplicateCount > 0 ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
          <ShieldAlert className={`w-8 h-8 ${duplicateCount > 0 ? 'text-red-500' : 'text-green-500'}`} />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-white">{t('security_scan_complete')}</h2>
        <p className="text-white/60 mb-8">
          {duplicateCount > 0 
            ? t('security_scan_found', { count: duplicateCount })
            : t('security_scan_clean')}
        </p>
        
        <div className="flex flex-col gap-3">
          {duplicateCount > 0 && (
            <button 
              onClick={onDownload}
              className="w-full bg-[#00f2ff] text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              {t('ok_download_report')}
            </button>
          )}
          <button 
            onClick={onClose}
            className="w-full p-4 bg-white/5 rounded-2xl font-bold text-white/60 hover:bg-white/10 transition-all"
          >
            {t('close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SecurityReportModal({ onClose, onConfirm, t }: { key?: string, onClose: () => void, onConfirm: (p: string) => void, t: (k: string, p?: any) => string }) {
  const [p, setP] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full text-white/60">
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-neon-cyan/20 p-2 rounded-lg">
            <FileText className="text-neon-cyan w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('secure_report')}</h2>
        </div>
        <p className="text-white/60 mb-6">{t('report_password_sub')}</p>
        <form onSubmit={(e) => { e.preventDefault(); onConfirm(p); }} className="space-y-4">
          <input 
            type="password"
            placeholder={t('report_password')}
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all"
            value={p}
            onChange={e => setP(e.target.value)}
            required
          />
          <button className="w-full bg-[#00f2ff] text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]">
            {t('download_secure_report')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function ViewReportModal({ content, onClose, t }: { key?: string, content: string, onClose: () => void, t: (k: string, p?: any) => string }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-2xl relative flex flex-col max-h-[80vh]"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full text-white/60">
          <X className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-neon-cyan/20 p-2 rounded-lg">
            <ShieldAlert className="text-neon-cyan w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('security_report')}</h2>
        </div>

        <div className="flex-1 overflow-y-auto bg-black/40 rounded-2xl p-6 border border-white/5 font-mono text-sm text-neon-cyan/80 leading-relaxed whitespace-pre-wrap">
          {content}
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 bg-white/5 p-4 rounded-2xl font-bold text-white/60 hover:bg-white/10 transition-all"
        >
          {t('close')}
        </button>
      </motion.div>
    </div>
  );
}

function AddFolderModal({ onClose, onAdd, t }: { 
  key?: string,
  onClose: () => void, 
  onAdd: (name: string) => void | Promise<void>, 
  t: (k: string, p?: any) => string 
}) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full text-white/60">
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-neon-cyan/20 p-2 rounded-lg">
            <FolderPlus className="text-neon-cyan w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('add_folder')}</h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onAdd(name); }} className="space-y-4">
          <input 
            type="text"
            placeholder={t('folder_name')}
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 focus:ring-2 focus:ring-neon-cyan text-white placeholder:text-white/20 outline-none transition-all"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoFocus
          />
          <button className="w-full bg-[#00f2ff] text-black p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]">
            {t('add_folder')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function MoveToFolderModal({ folders, onClose, onMove, t }: { 
  key?: string,
  folders: Folder[], 
  onClose: () => void, 
  onMove: (id: string | null) => void | Promise<void>, 
  t: (k: string, p?: any) => string 
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full text-white/60">
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-neon-cyan/20 p-2 rounded-lg">
            <Move className="text-neon-cyan w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('select_folder')}</h2>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
          <button
            onClick={() => onMove(null)}
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-left flex items-center gap-3 group"
          >
            <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10">
              <X className="w-5 h-5 text-white/40" />
            </div>
            <span className="text-white font-medium">{t('no_folder')}</span>
          </button>
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => onMove(folder.id)}
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-left flex items-center gap-3 group"
            >
              <div className="p-2 bg-neon-cyan/10 rounded-lg group-hover:bg-neon-cyan/20">
                <FolderIcon className="w-5 h-5 text-neon-cyan" />
              </div>
              <span className="text-white font-medium">{folder.name}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function ConfirmFolderDeleteModal({ folder, onClose, onConfirm, t }: { 
  key?: string,
  folder: Folder, 
  onClose: () => void, 
  onConfirm: () => void, 
  t: (k: string, p?: any) => string 
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-md relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full text-white/60">
          <X className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-red-500/20 p-2 rounded-lg">
            <Trash2 className="text-red-500 w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('delete_folder')}</h2>
        </div>

        <p className="text-white/60 mb-8 leading-relaxed">
          {t('confirm_delete_folder')}
        </p>

        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 bg-white/5 p-4 rounded-2xl font-bold text-white/60 hover:bg-white/10 transition-all"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 bg-red-500 text-white p-4 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg shadow-red-500/20"
          >
            {t('delete')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PasswordStrengthBar({ password, t }: { password: string, t: (k: string) => string }) {
  const strength = calculatePasswordStrength(password);
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-neon-cyan'
  ];
  const labels = [
    t('strength_very_weak'),
    t('strength_weak'),
    t('strength_medium'),
    t('strength_strong'),
    t('strength_very_strong')
  ];

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">{t('strength')}</span>
        <span className={`text-[10px] uppercase tracking-widest font-bold ${colors[strength].replace('bg-', 'text-')}`}>
          {labels[strength]}
        </span>
      </div>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className={`h-full flex-1 transition-all duration-500 ${i <= strength ? colors[strength] : 'bg-white/5'}`} 
          />
        ))}
      </div>
    </div>
  );
}

function TrashModal({ accounts, onClose, onRestore, onDelete, onEmpty, t }: { 
  key?: string,
  accounts: Account[], 
  onClose: () => void, 
  onRestore: (id: string) => void, 
  onDelete: (id: string) => void,
  onEmpty: () => void,
  t: (k: string, p?: any) => string 
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card p-8 rounded-[2.5rem] w-full max-w-2xl relative flex flex-col max-h-[85vh]"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full text-white/60">
          <X className="w-6 h-6" />
        </button>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Trash2 className="text-white w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white">{t('trash')}</h2>
          </div>
          {accounts.length > 0 && (
            <button 
              onClick={() => { if(confirm(t('empty_trash_confirm'))) onEmpty(); }}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold transition-all"
            >
              {t('empty_trash')}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {accounts.length === 0 ? (
            <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
              <p className="text-white/30 italic">{t('trash_empty')}</p>
            </div>
          ) : (
            accounts.map(acc => (
              <div 
                key={acc.id}
                className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between group"
              >
                <div>
                  <h3 className="font-bold text-white">{acc.website}</h3>
                  <p className="text-sm text-white/40">{acc.username}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onRestore(acc.id)}
                    className="p-2 bg-neon-cyan/10 hover:bg-neon-cyan text-neon-cyan hover:text-black rounded-lg transition-all"
                    title={t('restore')}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => { if(confirm(t('delete_forever_confirm'))) onDelete(acc.id); }}
                    className="p-2 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all"
                    title={t('permanently_delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 bg-white/5 p-4 rounded-2xl font-bold text-white/60 hover:bg-white/10 transition-all font-mono tracking-widest text-xs uppercase"
        >
          {t('close')}
        </button>
      </motion.div>
    </div>
  );
}
