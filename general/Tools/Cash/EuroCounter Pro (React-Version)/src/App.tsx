import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DENOMINATIONS } from './lib/constants';
import { CountState } from './lib/types';
import DenominationInput from './components/DenominationInput';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Banknote, Coins, RotateCcw, FileDown, Wallet, Download, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

export default function App() {
  const [counts, setCounts] = useState<CountState>({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [tellerName, setTellerName] = useState('');
  const [controllerName, setControllerName] = useState('');
  const [mounted, setMounted] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCountChange = useCallback((id: string, value: number) => {
    setCounts(prev => ({
      ...prev,
      [id]: value
    }));
  }, []);

  const resetAll = () => {
    setCounts({});
    setTellerName('');
    setControllerName('');
  };

  const totals = useMemo(() => {
    let billTotal = 0;
    let coinTotal = 0;

    DENOMINATIONS.forEach(d => {
      const count = counts[d.id] || 0;
      if (d.type === 'bill') billTotal += d.value * count;
      else coinTotal += d.value * count;
    });

    return {
      bills: billTotal,
      coins: coinTotal,
      grand: billTotal + coinTotal
    };
  }, [counts]);

  const activeDenominations = useMemo(() => {
    return DENOMINATIONS.filter(d => (counts[d.id] || 0) > 0);
  }, [counts]);

  const handleSavePDF = async () => {
    if (totals.grand === 0 || !reportRef.current) return;
    
    setIsGeneratingPDF(true);
    try {
      const dateStr = new Date().toLocaleDateString('nl-NL').replace(/\//g, '-');
      // Export JSON data as well
      const exportData = {
        counts,
        tellerName,
        controllerName,
        total: totals.grand,
        timestamp: new Date().toISOString()
      };
      const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `Kasopmaak_${dateStr}.json`;
      jsonLink.click();
      URL.revokeObjectURL(jsonUrl);

      const element = reportRef.current;
      
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px';
      container.style.zIndex = '-1000';
      
      const clone = element.cloneNode(true) as HTMLDivElement;
      clone.style.display = 'block';
      container.appendChild(clone);
      document.body.appendChild(container);

      // Verzamel posities van alle rijen en belangrijke blokken
      // We doen dit VOORDAT we html2canvas aanroepen om zeker te zijn van de layout
      const rows = Array.from(clone.querySelectorAll('tr, tfoot, .pdf-block'));
      const contentBlocks = rows.map(el => {
        const element = el as HTMLElement;
        return {
          top: element.offsetTop,
          bottom: element.offsetTop + element.offsetHeight
        };
      }).filter(b => b.bottom > 0);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800
      });
      
      document.body.removeChild(container);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10; 
      const contentWidth = pageWidth - (2 * margin);
      const contentHeight = pageHeight - (2 * margin);
      
      const scale = canvas.width / contentWidth;
      const contentHeightPx = contentHeight * scale;
      
      let currentYInImage = 0;
      const totalHeightPx = canvas.height;
      let isFirstPage = true;

      while (currentYInImage < totalHeightPx) {
        if (!isFirstPage) {
          pdf.addPage();
        }

        // Standaard slice hoogte
        let sliceHeightPx = Math.min(contentHeightPx, totalHeightPx - currentYInImage);
        
        // Zoek naar blokken die doorgesneden worden
        const cutLineY = currentYInImage + sliceHeightPx;
        
        // We kijken alleen of we moeten inkorten als we niet aan het einde van de afbeelding zijn
        if (cutLineY < totalHeightPx) {
          // Zoek het blok dat op de snijlijn ligt
          // Belangrijk: we schalen de contentBlocks ook mee als dat nodig is, 
          // maar offsetTop is al in pixels relatief aan de container.
          const overlappingBlock = contentBlocks.find(b => 
            b.top < cutLineY && b.bottom > cutLineY
          );

          if (overlappingBlock && overlappingBlock.top > currentYInImage) {
            // Inkorten tot de bovenkant van het blok dat anders doorgesneden zou worden
            sliceHeightPx = overlappingBlock.top - currentYInImage;
          }
        }

        // Maak een tijdelijk canvas voor dit deel
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = sliceHeightPx;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
          tempCtx.drawImage(
            canvas, 
            0, currentYInImage, canvas.width, sliceHeightPx, 
            0, 0, canvas.width, sliceHeightPx
          );
          
          const sliceData = tempCanvas.toDataURL('image/jpeg', 1.0);
          const sliceHeightMm = sliceHeightPx / scale;
          
          pdf.addImage(sliceData, 'JPEG', margin, margin, contentWidth, sliceHeightMm);
        }

        currentYInImage += sliceHeightPx;
        isFirstPage = false;

        // Veiligheidscheck
        if (sliceHeightPx <= 0) break;
      }
      
      pdf.save(`Kasopmaak_${dateStr}.pdf`);
    } catch (error) {
      console.error("PDF Error:", error);
      alert("Er is een fout opgetreden bij het opslaan van de PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const text = await file.text();
        const result = JSON.parse(text);
        
        if (result.counts) {
          setCounts(prev => ({ ...prev, ...result.counts }));
        }
        if (result.tellerName) setTellerName(result.tellerName);
        if (result.controllerName) setControllerName(result.controllerName);
        
        alert("Gegevens succesvol geïmporteerd uit JSON!");
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: file.type || "application/pdf"
                }
              },
              {
                text: "Extract cash count data from this file. The output should be a JSON object where keys are denomination IDs and values are the counts (integers). Use the following denomination IDs: 500_bill, 200_bill, 100_bill, 50_bill, 20_bill, 10_bill, 5_bill, 2_coin, 1_coin, 0.50_coin, 0.20_coin, 0.10_coin, 0.05_coin, 0.02_coin, 0.01_coin. Also extract 'tellerName' and 'controllerName' if available."
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              counts: {
                type: Type.OBJECT,
                additionalProperties: { type: Type.INTEGER }
              },
              tellerName: { type: Type.STRING },
              controllerName: { type: Type.STRING }
            }
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      if (result.counts) {
        setCounts(prev => ({ ...prev, ...result.counts }));
      }
      if (result.tellerName) setTellerName(result.tellerName);
      if (result.controllerName) setControllerName(result.controllerName);

      alert("Gegevens succesvol geïmporteerd!");
    } catch (error) {
      console.error("Import Error:", error);
      alert("Er is een fout opgetreden bij het importeren van het bestand. Zorg ervoor dat het bestand leesbaar is.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const billDenoms = DENOMINATIONS.filter(d => d.type === 'bill');
  const coinDenoms = DENOMINATIONS.filter(d => d.type === 'coin');

  return (
    <div className="min-h-screen bg-slate-50 pb-40 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-200/50">
              <Wallet size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">EuroCounter <span className="text-emerald-600">Pro</span></h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Professional Cash Management</p>
            </div>
          </div>
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 p-1 px-6 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-6"
          >
            <div className="py-2">
              <span className="text-[9px] uppercase font-black text-slate-500 block tracking-widest mb-0.5">Totaal Geteld</span>
              <span className="text-3xl font-black text-emerald-400 leading-none tabular-nums">€{totals.grand.toFixed(2)}</span>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div className="py-2 hidden sm:block">
              <span className="text-[9px] uppercase font-black text-slate-500 block tracking-widest mb-0.5">Items</span>
              <span className="text-xl font-black text-white leading-none">
                {activeDenominations.reduce((acc, d) => acc + (counts[d.id] || 0), 0)}
              </span>
            </div>
          </motion.div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-12 space-y-16">
        {/* Biljetten Sectie */}
        <section>
          <div className="flex items-center gap-6 mb-8">
            <div className="flex items-center gap-3 text-slate-800">
              <Banknote size={24} className="text-emerald-600" />
              <h2 className="text-xl font-black uppercase tracking-widest">Biljetten</h2>
            </div>
            <div className="h-px flex-1 bg-slate-200"></div>
            <div className="px-4 py-1 bg-white rounded-full border border-slate-200 font-bold text-slate-500 text-sm">
              €{totals.bills.toFixed(2)}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {billDenoms.map(d => (
              <DenominationInput 
                key={d.id} 
                denomination={d} 
                count={counts[d.id] || 0} 
                onChange={handleCountChange} 
              />
            ))}
          </div>
        </section>

        {/* Munten Sectie */}
        <section>
          <div className="flex items-center gap-6 mb-8">
            <div className="flex items-center gap-3 text-slate-800">
              <Coins size={24} className="text-amber-600" />
              <h2 className="text-xl font-black uppercase tracking-widest">Munten</h2>
            </div>
            <div className="h-px flex-1 bg-slate-200"></div>
            <div className="px-4 py-1 bg-white rounded-full border border-slate-200 font-bold text-slate-500 text-sm">
              €{totals.coins.toFixed(2)}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {coinDenoms.map(d => (
              <DenominationInput 
                key={d.id} 
                denomination={d} 
                count={counts[d.id] || 0} 
                onChange={handleCountChange} 
              />
            ))}
          </div>
        </section>

        {/* Rapport Details Sectie */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 text-slate-800">
            <div className="p-2 bg-slate-100 rounded-lg">
              <RotateCcw size={20} className="text-slate-600" />
            </div>
            <h2 className="text-lg font-black uppercase tracking-widest">Rapport Details</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Naam Teller</label>
              <input 
                type="text" 
                value={tellerName}
                onChange={(e) => setTellerName(e.target.value)}
                placeholder="Bijv. Jan de Vries"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Naam Controleur</label>
              <input 
                type="text" 
                value={controllerName}
                onChange={(e) => setControllerName(e.target.value)}
                placeholder="Bijv. Maria Jansen"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
              />
            </div>
          </div>
        </section>
      </main>

      {/* Floating Footer Control */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl z-[60]">
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-white/90 backdrop-blur-2xl border border-slate-200 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-between gap-4"
        >
          <div className="px-6 hidden md:block">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-1">Eindbedrag</span>
            <span className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">€{totals.grand.toFixed(2)}</span>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportFile} 
              accept=".pdf,image/*,.json" 
              className="hidden" 
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex-1 md:flex-none p-4 md:px-6 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all flex items-center justify-center gap-2 group"
            >
              {isImporting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <FileDown size={18} className="group-hover:translate-y-[2px] transition-transform" />
              )}
              <span className="font-black uppercase text-[10px] tracking-widest">Import</span>
            </button>

            <button 
              onClick={resetAll}
              className="flex-1 md:flex-none p-4 md:px-6 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all flex items-center justify-center gap-2 group"
            >
              <RotateCcw size={18} className="group-hover:rotate-[-45deg] transition-transform" />
              <span className="font-black uppercase text-[10px] tracking-widest">Reset</span>
            </button>
            
            <button 
              onClick={handleSavePDF}
              disabled={totals.grand === 0 || isGeneratingPDF}
              className="flex-[2] md:flex-none p-4 md:px-10 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-200/50 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {isGeneratingPDF ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Download size={18} />
                  <span>Sla overzicht op</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </footer>

      {/* PDF Template (Hidden) */}
      <div className="hidden">
        <div ref={reportRef} style={{ backgroundColor: '#ffffff', padding: '64px', color: '#0f172a', width: '800px', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '64px', borderBottom: '8px solid #0f172a', paddingBottom: '40px' }}>
            <div>
              <h1 style={{ fontSize: '60px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '-0.05em', margin: '0 0 8px 0', lineHeight: '1' }}>Kasopmaak</h1>
              <p style={{ color: '#64748b', fontWeight: '700', fontSize: '18px', margin: '0' }}>
                {mounted ? new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '...'}
              </p>
              <p style={{ color: '#94a3b8', fontWeight: '500', fontStyle: 'italic', margin: '0' }}>
                {mounted ? `Gegenereerd om ${new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : '...'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: '900', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>Gevalideerd Totaal</p>
              <p style={{ fontWeight: '900', fontSize: '48px', color: '#059669', margin: '0' }}>€{totals.grand.toFixed(2)}</p>
            </div>
          </div>

          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '64px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px 0', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.1em' }}>Eenheid</th>
                <th style={{ padding: '16px 0', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.1em', textAlign: 'center' }}>Aantal</th>
                <th style={{ padding: '16px 0', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.1em', textAlign: 'right' }}>Subtotaal</th>
              </tr>
            </thead>
            <tbody>
              {activeDenominations.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '20px 0', fontWeight: '700', color: '#334155', fontSize: '18px' }}>
                    {d.label} <span style={{ fontSize: '10px', fontWeight: '900', color: '#cbd5e1', textTransform: 'uppercase', marginLeft: '8px' }}>{d.type === 'bill' ? 'Biljet' : 'Munt'}</span>
                  </td>
                  <td style={{ padding: '20px 0', textAlign: 'center', fontWeight: '900', fontSize: '20px', color: '#0f172a' }}>
                    {counts[d.id]}
                  </td>
                  <td style={{ padding: '20px 0', textAlign: 'right', fontWeight: '900', fontSize: '20px', color: '#0f172a' }}>
                    €{(d.value * (counts[d.id] || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '4px solid #0f172a', backgroundColor: '#f8fafc' }}>
                <td style={{ padding: '32px 16px', fontSize: '24px', fontWeight: '900', textTransform: 'uppercase' }}>Eindtotaal</td>
                <td style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontWeight: '700' }}>
                  {activeDenominations.reduce((acc, d) => acc + (counts[d.id] || 0), 0)} Stuks
                </td>
                <td style={{ padding: '32px 16px', textAlign: 'right', fontSize: '36px', fontWeight: '900', color: '#059669' }}>
                  €{totals.grand.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="pdf-block" style={{ marginTop: '128px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '128px' }}>
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '24px' }}>
              <p style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: '#94a3b8', letterSpacing: '0.3em', marginBottom: '8px' }}>Handtekening Teller</p>
              <p style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 40px 0', minHeight: '24px' }}>{tellerName || '................................'}</p>
              <div style={{ height: '1px', width: '100%' }}></div>
            </div>
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '24px' }}>
              <p style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: '#94a3b8', letterSpacing: '0.3em', marginBottom: '8px' }}>Handtekening Controleur</p>
              <p style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 40px 0', minHeight: '24px' }}>{controllerName || '................................'}</p>
              <div style={{ height: '1px', width: '100%' }}></div>
            </div>
          </div>
          
          <div style={{ marginTop: '160px', textAlign: 'center' }}>
            <p style={{ fontSize: '9px', color: '#cbd5e1', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5em' }}>
              EuroCounter Pro - Professional Cash Management System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
