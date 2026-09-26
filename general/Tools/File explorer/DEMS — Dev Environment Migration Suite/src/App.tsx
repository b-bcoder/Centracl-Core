/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Copy, Check, Terminal, FolderInput, FolderOutput, Play, Trash2, History, AlertCircle, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HistoryItem {
  id: number;
  command: string;
  timestamp: string;
}

const OPTIONAL_PARAMS = [
  { flag: '/MIR', label: 'Mirror (/MIR)', desc: 'Spiegel mappenstructuur (verwijdert bestanden in doel die niet in bron staan)' },
  { flag: '/Z', label: 'Restartable (/Z)', desc: 'Kopieer bestanden in hervatbare modus' },
  { flag: '/MT:16', label: '16 Threads (/MT:16)', desc: 'Gebruik 16 threads (sneller op NVMe-schijven)' },
  { flag: '/LOG:C:\\documents\\robocopy.log', label: 'Logbestand (/LOG)', desc: 'Sla resultaten op in C:\\documents\\robocopy.log' },
  { flag: '/NP', label: 'No Progress (/NP)', desc: 'Toon geen voortgangspercentage' },
  { flag: '/XO', label: 'Exclude Older (/XO)', desc: 'Sluit oudere bestanden uit' },
  { flag: '/MOVE', label: 'Move (/MOVE)', desc: 'Verplaats bestanden (verwijdert uit bron na kopie)' },
];

const SCANNER_SCRIPT = `# ================================
#  MODULAIRE SOFTWARE MAP SCANNER
# ================================

# Zoekwoorden (hier kun je alles toevoegen)
$searchTerms = @(
    "Visual Studio",
    "Microsoft Visual Studio",
    "VSCode",
    "Arduino"
)

# Output bestand
$output = "$env:USERPROFILE\\Documents\\software_map_scan.txt"

# Scan locaties
$locations = @(
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData",
    "$env:LOCALAPPDATA",
    "$env:APPDATA",
    "$env:USERPROFILE"
)

# Start rapport
"=====================================" | Out-File $output
" SOFTWARE MAP SCAN RAPPORT" | Add-Content $output
" Datum: $(Get-Date)" | Add-Content $output
"=====================================" | Add-Content $output
"" | Add-Content $output

foreach ($term in $searchTerms) {

    "----- Zoeken naar: $term -----" | Add-Content $output

    foreach ($loc in $locations) {

        if (Test-Path $loc) {

            Get-ChildItem $loc -Directory -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match $term } |
            ForEach-Object {
                $_.FullName | Add-Content $output
            }

        }

    }

    "" | Add-Content $output
}

"=== Scan voltooid ===" | Add-Content $output

Write-Host ""
Write-Host "Scan klaar!"
Write-Host "Resultaten staan in:"
Write-Host $output`;

const EXE_SCANNER_SCRIPT = `# ================================
#  MODULAIRE EXE SCANNER
# ================================

# Zoekwoorden (naam van app, vendor, etc.)
$searchTerms = @(
    "Visual Studio",
    "Microsoft Visual Studio",
    "VSCode",
    "Arduino"
)

# Output bestand
$output = "$env:USERPROFILE\\Documents\\exe_scan_rapport.txt"

# Scan locaties
$locations = @(
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData",
    "$env:LOCALAPPDATA",
    "$env:APPDATA",
    "$env:USERPROFILE"
)

# Start rapport
"=====================================" | Out-File $output
" EXE SCAN RAPPORT" | Add-Content $output
" Datum: $(Get-Date)" | Add-Content $output
"=====================================" | Add-Content $output
"" | Add-Content $output

foreach ($term in $searchTerms) {

    "----- Zoeken naar EXE's gerelateerd aan: $term -----" | Add-Content $output

    foreach ($loc in $locations) {

        if (Test-Path $loc) {

            Get-ChildItem $loc -Recurse -Filter *.exe -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -like "*$term*" -or
                $_.FullName -like "*$term*"
            } |
            ForEach-Object {
                "Bestand: $($_.FullName)" | Add-Content $output
            }

        }

    }

    "" | Add-Content $output
}

"=== EXE-scan voltooid ===" | Add-Content $output

Write-Host ""
Write-Host "Scan klaar!"
Write-Host "Resultaten staan in:"
Write-Host $output`;

export default function App() {
  const [sourcePaths, setSourcePaths] = useState('');
  const [destPaths, setDestPaths] = useState('');
  const [mode, setMode] = useState<'robocopy' | 'symlink'>('robocopy');
  const [symlinkType, setSymlinkType] = useState<'/D' | '/J'>('/D');
  const [selectedParams, setSelectedParams] = useState<string[]>([]);
  const [generatedCommands, setGeneratedCommands] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<{ sources: string[]; dests: string[] }>({ sources: [], dests: [] });
  const [showScript, setShowScript] = useState(false);
  const [activeScript, setActiveScript] = useState<'map' | 'exe'>('map');

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const validatePath = (path: string) => {
    // Basic Windows path validation: Drive letter followed by colon and backslash
    // or UNC path (\\server\share)
    const windowsPathRegex = /^([a-zA-Z]:\\|\\\\)/;
    return windowsPathRegex.test(path.replace(/^["']+|["']+$/g, ''));
  };

  const handleGenerate = useCallback(async () => {
    const sanitizePath = (path: string) => path.replace(/^["']+|["']+$/g, '');

    const sources = sourcePaths.split('\n').map(s => s.trim()).filter(s => s !== '');
    const dests = destPaths.split('\n').map(d => d.trim()).filter(d => d !== '');

    const sourceErrors = sources.filter(s => !validatePath(s));
    const destErrors = dests.filter(d => !validatePath(d));

    setErrors({ sources: sourceErrors, dests: destErrors });

    if (sourceErrors.length > 0 || destErrors.length > 0) return;

    const commands: string[] = [];
    
    if (mode === 'robocopy') {
      const paramsString = selectedParams.join(' ');
      const baseFlags = '/E /COPYALL /R:3 /W:5';
      
      const maxLen = Math.max(sources.length, dests.length);
      
      for (let i = 0; i < maxLen; i++) {
        const rawSrc = sources[i] || (sources.length > 0 ? sources[0] : '');
        const rawDst = dests[i] || (dests.length > 0 ? dests[0] : '');
        
        if (rawSrc && rawDst) {
          const src = sanitizePath(rawSrc);
          const dst = sanitizePath(rawDst);
          commands.push(`robocopy "${src}" "${dst}" ${baseFlags} ${paramsString}`.trim());
        }
      }
    } else {
      // Symlink mode
      const maxLen = Math.max(sources.length, dests.length);
      for (let i = 0; i < maxLen; i++) {
        const rawSrc = sources[i] || (sources.length > 0 ? sources[0] : '');
        const rawDst = dests[i] || (dests.length > 0 ? dests[0] : '');
        
        if (rawSrc && rawDst) {
          const src = sanitizePath(rawSrc);
          const dst = sanitizePath(rawDst);
          commands.push(`mklink ${symlinkType} "${src}" "${dst}"`);
        }
      }
    }

    setGeneratedCommands(commands);

    // Save to history
    if (commands.length > 0) {
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commands }),
        });
        fetchHistory();
      } catch (err) {
        console.error('Failed to save history', err);
      }
    }
  }, [sourcePaths, destPaths, selectedParams]);

  const handleClearAll = () => {
    setSourcePaths('');
    setDestPaths('');
    setGeneratedCommands([]);
    setSelectedParams([]);
    setErrors({ sources: [], dests: [] });
  };

  const toggleParam = (flag: string) => {
    setSelectedParams(prev => 
      prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const clearHistory = async () => {
    try {
      await fetch('/api/history', { method: 'DELETE' });
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#1a1a1a] p-2 rounded-lg">
              <Terminal className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">DEMS</h1>
              <p className="text-sm text-muted-foreground">Dev Environment Migration Suite.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowScript(true)}
              className="flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-all"
            >
              <Terminal className="w-4 h-4" />
              Scanner Script
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-full transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Controls */}
          <div className="lg:col-span-2 space-y-8">
            {/* Mode Toggle */}
            <div className="flex bg-white p-1 rounded-2xl border border-black/5 shadow-sm w-fit">
              <button
                onClick={() => setMode('robocopy')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  mode === 'robocopy' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-muted-foreground hover:bg-black/5'
                }`}
              >
                Robocopy
              </button>
              <button
                onClick={() => setMode('symlink')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  mode === 'symlink' ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-muted-foreground hover:bg-black/5'
                }`}
              >
                Symlink Maker
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Source Paths */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <FolderInput className="w-4 h-4" />
                  Bronpad(en)
                </label>
                <textarea
                  className={`w-full h-48 p-4 bg-white border rounded-2xl shadow-sm outline-none transition-all resize-none font-mono text-sm ${
                    errors.sources.length > 0 ? 'border-red-500 ring-2 ring-red-50' : 'border-black/5 focus:ring-2 focus:ring-black/5 focus:border-black/20'
                  }`}
                  placeholder="C:\Mijn\Documenten"
                  value={sourcePaths}
                  onChange={(e) => setSourcePaths(e.target.value)}
                />
                {errors.sources.length > 0 && (
                  <div className="flex items-center gap-1 text-red-500 text-[10px] font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Ongeldig Windows pad gedetecteerd
                  </div>
                )}
              </div>

              {/* Destination Paths */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <FolderOutput className="w-4 h-4" />
                  Doelpad(en)
                </label>
                <textarea
                  className={`w-full h-48 p-4 bg-white border rounded-2xl shadow-sm outline-none transition-all resize-none font-mono text-sm ${
                    errors.dests.length > 0 ? 'border-red-500 ring-2 ring-red-50' : 'border-black/5 focus:ring-2 focus:ring-black/5 focus:border-black/20'
                  }`}
                  placeholder="D:\Backup"
                  value={destPaths}
                  onChange={(e) => setDestPaths(e.target.value)}
                />
                {errors.dests.length > 0 && (
                  <div className="flex items-center gap-1 text-red-500 text-[10px] font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Ongeldig Windows pad gedetecteerd
                  </div>
                )}
              </div>
            </div>

            {/* Optional Parameters or Symlink Options */}
            {mode === 'robocopy' ? (
              <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Optionele Parameters</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {OPTIONAL_PARAMS.map((param) => (
                    <label key={param.flag} className="flex items-start gap-3 p-3 rounded-xl hover:bg-black/5 cursor-pointer transition-colors border border-transparent hover:border-black/5">
                      <input
                        type="checkbox"
                        className="mt-1 w-4 h-4 rounded border-black/10 text-black focus:ring-black"
                        checked={selectedParams.includes(param.flag)}
                        onChange={() => toggleParam(param.flag)}
                      />
                      <div>
                        <span className="block text-sm font-bold">{param.label}</span>
                        <span className="block text-[10px] text-muted-foreground leading-tight">{param.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Symlink Opties</h2>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setSymlinkType('/D')}
                    className={`flex-1 p-4 rounded-xl border transition-all text-left ${
                      symlinkType === '/D' ? 'border-[#1a1a1a] bg-black/5' : 'border-black/5 hover:bg-black/5'
                    }`}
                  >
                    <span className="block text-sm font-bold">Directory (/D)</span>
                    <span className="block text-[10px] text-muted-foreground">Maakt een symbolische link naar een map.</span>
                  </button>
                  <button
                    onClick={() => setSymlinkType('/J')}
                    className={`flex-1 p-4 rounded-xl border transition-all text-left ${
                      symlinkType === '/J' ? 'border-[#1a1a1a] bg-black/5' : 'border-black/5 hover:bg-black/5'
                    }`}
                  >
                    <span className="block text-sm font-bold">Junction (/J)</span>
                    <span className="block text-[10px] text-muted-foreground">Maakt een directory junction (hard link naar map).</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="flex justify-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerate}
                className="flex items-center gap-2 bg-[#1a1a1a] text-white px-12 py-4 rounded-full font-bold shadow-xl hover:bg-black/90 transition-all"
              >
                <Play className="w-5 h-5 fill-current" />
                Generate Commands
              </motion.button>
            </div>

            {/* Result Section */}
            <AnimatePresence>
              {generatedCommands.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Resultaat</h2>
                    <button
                      onClick={() => copyToClipboard(generatedCommands.join('\n'))}
                      className="flex items-center gap-2 text-xs font-medium bg-white border border-black/5 px-4 py-2 rounded-xl hover:bg-black/5 transition-all shadow-sm"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Gekopieerd!' : 'Kopieer alles'}
                    </button>
                  </div>
                  <div className="bg-[#1a1a1a] p-6 rounded-2xl shadow-2xl overflow-x-auto border border-white/10">
                    <pre className="text-emerald-400 font-mono text-sm leading-relaxed">
                      {generatedCommands.map((cmd, idx) => (
                        <div key={idx} className="mb-2 last:mb-0 flex gap-4">
                          <span className="text-white/20 select-none">{idx + 1}</span>
                          <span>{cmd}</span>
                        </div>
                      ))}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* History Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Geschiedenis</h2>
              </div>
              {history.length > 0 && (
                <button onClick={clearHistory} className="text-[10px] font-bold text-red-500 hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden min-h-[400px]">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-30">
                  <History className="w-12 h-12 mb-2" />
                  <p className="text-xs font-medium">Nog geen geschiedenis</p>
                </div>
              ) : (
                <div className="divide-y divide-black/5 max-h-[800px] overflow-y-auto">
                  {history.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-black/5 transition-colors group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <button
                          onClick={() => copyToClipboard(item.command)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-black/10 rounded-lg transition-all"
                          title="Kopieer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[11px] font-mono break-all line-clamp-2 text-muted-foreground">
                        {item.command}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <footer className="mt-12 pt-8 border-t border-black/5 text-center text-[10px] text-muted-foreground">
          <p>© 2026 DEMS -- Dev Environment Migration Suite. Gebruik op eigen risico.</p>
        </footer>

        {/* Script Modal */}
        <AnimatePresence>
          {showScript && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              >
                <div className="p-6 border-b border-black/5 flex items-center justify-between bg-[#fcfcfc]">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-lg">
                      <Terminal className="text-white w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">PowerShell Scanners</h2>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Utility Scripts</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowScript(false)}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-muted-foreground rotate-45" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-black/5 bg-[#fcfcfc] px-6">
                  <button
                    onClick={() => setActiveScript('map')}
                    className={`px-4 py-3 text-xs font-bold transition-all border-b-2 ${
                      activeScript === 'map' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-indigo-600'
                    }`}
                  >
                    Software Map Scanner
                  </button>
                  <button
                    onClick={() => setActiveScript('exe')}
                    className={`px-4 py-3 text-xs font-bold transition-all border-b-2 ${
                      activeScript === 'exe' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-indigo-600'
                    }`}
                  >
                    EXE Scanner
                  </button>
                </div>
                
                <div className="p-6 overflow-y-auto bg-[#1a1a1a] flex-1">
                  <pre className="text-indigo-300 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {activeScript === 'map' ? SCANNER_SCRIPT : EXE_SCANNER_SCRIPT}
                  </pre>
                </div>

                <div className="p-4 border-t border-black/5 bg-[#fcfcfc] flex justify-end gap-3">
                  <button
                    onClick={() => setShowScript(false)}
                    className="px-6 py-2 rounded-xl text-sm font-bold text-muted-foreground hover:bg-black/5 transition-all"
                  >
                    Sluiten
                  </button>
                  <button
                    onClick={() => copyToClipboard(activeScript === 'map' ? SCANNER_SCRIPT : EXE_SCANNER_SCRIPT)}
                    className="flex items-center gap-2 bg-[#1a1a1a] text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-black/90 transition-all"
                  >
                    <Copy className="w-4 h-4" />
                    Kopieer Script
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
