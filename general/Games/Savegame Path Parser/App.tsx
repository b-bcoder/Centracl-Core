
import React, { useState, useCallback, useMemo } from 'react';
import Header from './components/Header';
import { ParsedFile, FieldSelection, SortOption } from './types';
import { parseSkyrimFile, generateSkyrimTextOutput, generateSkyrimExcelOutput } from './services/skyrimParser';
import { parseFerociousFile, generateFerociousTextOutput, generateFerociousExcelOutput } from './services/ferociousParser';

const initialSelection: FieldSelection = {
  showName: false,
  showDate: false,
  showTime: false,
  showType: false,
  showSkyrimSaveType: false,
  showSkyrimProfile1: false,
  showSkyrimProfile2: false,
  showSkyrimProfile3: false,
  showSkyrimLocation: false,
  showSkyrimSaveNr: false,
  removeDuplicates: true,
  sortOption: 'name'
};

import { copyToClipboard } from './utils/clipboard';

const App: React.FC = () => {
  const [environment, setEnvironment] = useState<'skyrim' | 'ferocious' | null>(null);
  const [inputPaths, setInputPaths] = useState<string>('');
  const [results, setResults] = useState<ParsedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'Kopieer' | 'Gekopieerd!'>('Kopieer');
  const [excelStatus, setExcelStatus] = useState<'Kopieer voor Excel' | 'Klaar voor Excel!'>('Kopieer voor Excel');
  
  const [selection, setSelection] = useState<FieldSelection>(initialSelection);

  const handleSetEnvironment = (env: 'skyrim' | 'ferocious' | null) => {
    setEnvironment(env);
    setSelection(initialSelection);
    setResults([]);
    setInputPaths('');
  };

  const columnFields = useMemo(() => {
    if (environment === 'skyrim') {
      return ['showSkyrimSaveType', 'showSkyrimProfile1', 'showSkyrimProfile2', 'showSkyrimProfile3', 'showSkyrimLocation', 'showSkyrimSaveNr', 'showDate', 'showTime'];
    }
    if (environment === 'ferocious') {
      return ['showName', 'showType', 'showDate', 'showTime'];
    }
    return [];
  }, [environment]);

  const allSelected = useMemo(() => 
    columnFields.every(field => selection[field as keyof FieldSelection]), 
    [selection, columnFields]
  );

  const toggleAllFields = () => {
    const newValue = !allSelected;
    setSelection(prev => {
      const next = { ...prev };
      columnFields.forEach(field => {
        (next[field as keyof FieldSelection] as boolean) = newValue;
      });
      return next;
    });
  };

  const toggleField = (field: keyof FieldSelection) => {
    setSelection(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as SortOption;
    setSelection(prev => ({ ...prev, sortOption: value }));
  };

  const handleProcess = useCallback(() => {
    if (!inputPaths.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      const paths = inputPaths.split('\n').map(p => p.trim()).filter(p => p.length > 0).map(p => p.replace(/^"(.*)"$/, '$1'));
      if (environment === 'skyrim') {
        setResults(paths.map(path => parseSkyrimFile(path)));
      } else {
        setResults(paths.map(path => parseFerociousFile(path)));
      }
      setIsProcessing(false);
    }, 150);
  }, [inputPaths, environment]);

  const rawOutput = useMemo(() => {
    if (environment === 'skyrim') return generateSkyrimTextOutput(results, selection);
    if (environment === 'ferocious') return generateFerociousTextOutput(results, selection);
    return '';
  }, [results, selection, environment]);

  const excelOutput = useMemo(() => {
    if (environment === 'skyrim') return generateSkyrimExcelOutput(results, selection);
    if (environment === 'ferocious') return generateFerociousExcelOutput(results, selection);
    return '';
  }, [results, selection, environment]);

  const handleCopyToClipboard = async () => {
    const success = await copyToClipboard(rawOutput);
    if (success) {
      setCopyStatus('Gekopieerd!');
      setTimeout(() => setCopyStatus('Kopieer'), 2000);
    }
  };

  const handleCopyForExcel = async () => {
    const success = await copyToClipboard(excelOutput);
    if (success) {
      setExcelStatus('Klaar voor Excel!');
      setTimeout(() => setExcelStatus('Kopieer voor Excel'), 2000);
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    element.href = URL.createObjectURL(new Blob([rawOutput], {type: 'text/plain'}));
    element.download = "ontlede_bestanden.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!environment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Module Selectie
            </h1>
            <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Kies je omgeving om te beginnen</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <button 
              onClick={() => handleSetEnvironment('skyrim')}
              className="group p-8 bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 rounded-3xl transition-all hover:scale-105 active:scale-95 text-left space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl font-bold">S</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Skyrim</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Inclusief Save Nr, Locatie en Profiel matching logica.</p>
              </div>
            </button>

            <button 
              onClick={() => handleSetEnvironment('ferocious')}
              className="group p-8 bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 rounded-3xl transition-all hover:scale-105 active:scale-95 text-left space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl font-bold">F</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Ferocious</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Standaard pad ontleding voor Ferocious omgevingen.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-12 text-slate-200">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
           <button 
             onClick={() => handleSetEnvironment(null)}
             className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white flex items-center gap-2 transition-colors"
           >
             ← Wissel Omgeving
           </button>
           <div className="px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-black uppercase tracking-[0.2em]">
             Actieve Omgeving: <span className={environment === 'skyrim' ? 'text-emerald-400' : 'text-blue-400'}>{environment}</span>
           </div>
        </div>

        {/* Settings Bar */}
        <section className="mb-8 bg-slate-800/30 border border-slate-700/50 p-6 rounded-2xl shadow-xl space-y-6 backdrop-blur-md">
          <div className="flex justify-between items-center border-b border-slate-700/50 pb-4">
             <h3 className="text-slate-100 font-bold text-sm uppercase tracking-widest">Kolominstellingen</h3>
             <label className="flex items-center gap-2 cursor-pointer bg-slate-700/50 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors">
                <input 
                  type="checkbox" 
                  checked={allSelected} 
                  onChange={toggleAllFields} 
                  className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-indigo-500 cursor-pointer" 
                />
                <span className="text-xs font-bold text-slate-200">Selecteer Alles</span>
             </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* CONDITIONAL DETAILS BASED ON ENVIRONMENT */}
            {environment === 'ferocious' ? (
              <div className="space-y-3">
                <h3 className="text-slate-100 font-semibold flex items-center gap-2 text-xs uppercase tracking-wider text-blue-400">Ferocious Save Details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {[
                    { id: 'showName', label: 'Naam' }, 
                    { id: 'showType', label: 'Type' },
                    { id: 'showDate', label: 'Datum' }, 
                    { id: 'showTime', label: 'Tijd' }
                  ].map(f => (
                    <label key={f.id} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={selection[f.id as keyof FieldSelection] as boolean} onChange={() => toggleField(f.id as keyof FieldSelection)} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 transition-all cursor-pointer" />
                      <span className={`text-xs font-medium ${selection[f.id as keyof FieldSelection] ? 'text-blue-300' : 'text-slate-500'}`}>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3 pl-0">
                <h3 className="text-slate-100 font-semibold flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400">Skyrim Save Details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {[
                    { id: 'showSkyrimSaveType', label: 'Savetype' }, 
                    { id: 'showSkyrimProfile1', label: 'Profiel 1' },
                    { id: 'showSkyrimSaveNr', label: 'Save Nr.' }, 
                    { id: 'showSkyrimProfile2', label: 'Profiel 2' },
                    { id: 'showSkyrimLocation', label: 'Locatie' }, 
                    { id: 'showSkyrimProfile3', label: 'Profiel 3' },
                    { id: 'showDate', label: 'Datum' }, 
                    { id: 'showTime', label: 'Tijd' }
                  ].map((f, idx) => (
                    <label key={`${f.id}-${idx}`} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={selection[f.id as keyof FieldSelection] as boolean} onChange={() => toggleField(f.id as keyof FieldSelection)} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 transition-all cursor-pointer" />
                      <span className={`text-xs font-medium ${selection[f.id as keyof FieldSelection] ? 'text-emerald-300' : 'text-slate-500'}`}>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* LIJST OPTIES */}
            <div className="space-y-3 border-l border-slate-700/50 pl-6">
              <h3 className="text-slate-100 font-semibold flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400">Lijst opties</h3>
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Sorteer op...</label>
                  <select 
                    value={selection.sortOption} 
                    onChange={handleSortChange}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-amber-500/50"
                  >
                    <option value="oldest">Sorteer op oud naar nieuw</option>
                    <option value="newest">Sorteer op nieuw naar oud</option>
                    <option value="name">Sorteer op alfabet</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input type="checkbox" checked={selection.removeDuplicates} onChange={() => toggleField('removeDuplicates')} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 cursor-pointer" />
                  <span className={`text-xs font-medium ${selection.removeDuplicates ? 'text-amber-300' : 'text-slate-500'}`}>Verwijder dubbele</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-blue-500/20">1</span>
                Bestanden invoeren
              </h2>
              {inputPaths && <button onClick={() => {setInputPaths(''); setResults([]);}} className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors">Wis alles</button>}
            </div>
            <textarea value={inputPaths} onChange={(e) => setInputPaths(e.target.value)} placeholder="Plak paden hier..." className="w-full h-[500px] bg-slate-800/40 border border-slate-700 rounded-2xl p-5 text-slate-300 font-mono text-sm focus:ring-2 focus:ring-blue-500/50 outline-none shadow-inner transition-all" />
            <button onClick={handleProcess} disabled={!inputPaths.trim() || isProcessing} className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl transition-all ${!inputPaths.trim() || isProcessing ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.01] text-white active:scale-95'}`}>
              {isProcessing ? 'Ontleden...' : 'Start Verwerking'}
            </button>
          </section>

          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-emerald-500/20">2</span>
                Resultaat
              </h2>
              {results.length > 0 && <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-widest">{results.length} BESTANDEN</span>}
            </div>
            <div className="relative group overflow-hidden rounded-2xl border border-slate-700 shadow-2xl">
              <textarea readOnly value={rawOutput} className="w-full h-[500px] bg-slate-900/90 p-5 text-emerald-400 font-mono text-[12px] outline-none resize-none whitespace-pre overflow-auto scrollbar-thin scrollbar-thumb-slate-700" />
              {results.length > 0 && (
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                   <button onClick={handleCopyToClipboard} className={`px-3 py-1.5 rounded border text-[11px] font-bold transition-all shadow-md ${copyStatus === 'Gekopieerd!' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800/80 text-slate-200 border-slate-600 hover:bg-slate-700'}`}>{copyStatus}</button>
                   <button onClick={handleCopyForExcel} className={`px-3 py-1.5 rounded border text-[11px] font-bold transition-all shadow-md ${excelStatus === 'Klaar voor Excel!' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800/80 text-emerald-400 border-emerald-500/30 hover:bg-slate-700'}`}>{excelStatus}</button>
                   <button onClick={handleDownload} className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 rounded text-[11px] border border-slate-700 font-bold transition-all shadow-md">Download .txt</button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="text-center text-slate-600 text-[10px] py-8 uppercase tracking-widest font-medium">
        Savegame Path Parser &bull; Geoptimaliseerd voor Skyrim, Ferocious & Excel
      </footer>
    </div>
  );
};

export default App;
