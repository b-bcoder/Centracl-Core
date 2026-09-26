
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Sparkles,
  TrendingUp,
  Clock,
  Euro,
  Target,
  Sun,
  Moon,
  Timer,
  ArrowRightLeft
} from 'lucide-react';
import { 
  format, 
  differenceInDays, 
  differenceInMonths, 
  differenceInYears, 
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  addDays, 
  addHours,
  isSameDay, 
  getDay,
  parse,
  isValid,
  intervalToDuration
} from 'date-fns';
import { nl } from 'date-fns/locale';
import { ScenarioRule, CalculationResult, SimulationStep, WeekDay } from './types';

// Components defined outside for better performance
const StatCard = ({ title, value, icon: Icon, color, isDarkMode }: { title: string, value: string | number, icon: any, color: string, isDarkMode: boolean }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-300 dark:border-slate-700 flex items-center gap-4 transition-colors">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm font-black text-slate-800 dark:text-slate-300 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [startDate, setStartDate] = useState(format(new Date(), 'dd-MM-yyyy'));
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 365), 'dd-MM-yyyy'));
  const [endTime, setEndTime] = useState('00:00');
  const [rules, setRules] = useState<ScenarioRule[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isHoursConverterMode, setIsHoursConverterMode] = useState(false);
  const [inputHours, setInputHours] = useState<number>(229901);
  const [targetAmount, setTargetAmount] = useState<number>(1200);
  const [calculationMode, setCalculationMode] = useState<'endDate' | 'targetAmount'>('endDate');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Hours to Time Conversion Logic
  const hoursConversion = useMemo(() => {
    if (!isHoursConverterMode) return null;
    
    // We gebruiken een referentiedatum om schrikkeljaren correct mee te nemen
    // We nemen een gemiddelde startdatum of een vaste datum zoals 2000-01-01
    const referenceStart = new Date(2000, 0, 1, 0, 0, 0);
    const referenceEnd = addHours(referenceStart, inputHours);
    
    const duration = intervalToDuration({ start: referenceStart, end: referenceEnd });
    
    const years = duration.years || 0;
    const months = duration.months || 0;
    const totalDays = duration.days || 0;
    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;
    const hours = duration.hours || 0;
    
    return { years, months, weeks, days, hours };
  }, [inputHours, isHoursConverterMode]);

  // Helper for date input formatting (auto-dash)
  const handleDateChange = (val: string, setter: (v: string) => void) => {
    let t = val.replace(/\D/g, '').slice(0, 8);
    if (t.length >= 5) {
      t = `${t.slice(0, 2)}-${t.slice(2, 4)}-${t.slice(4)}`;
    } else if (t.length >= 3) {
      t = `${t.slice(0, 2)}-${t.slice(2)}`;
    }
    setter(t);
  };

  // Helper to check if a date string is complete and reasonable (DD-MM-YYYY)
  const isDateComplete = (dateStr: string) => {
    if (dateStr.length !== 10) return false;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const year = parseInt(parts[2], 10);
    // Only allow years between 1900 and 2100 to prevent massive simulation loops
    return year >= 1900 && year <= 2100;
  };

  // Target Goal Calculation
  const targetResult = useMemo(() => {
    if (targetAmount <= 0 || rules.length === 0) return null;
    if (!isDateComplete(startDate)) return null;
    
    const start = parse(startDate, 'dd-MM-yyyy', new Date());
    if (!isValid(start)) return null;

    let currentTotal = 0;
    let curr = start;
    let daysCount = 0;
    const maxDays = 365 * 50; // 50 years limit

    // Check if any rule actually adds value
    const totalWeeklyValue = rules.reduce((acc, rule) => acc + (rule.value * rule.days.length), 0);
    if (totalWeeklyValue <= 0) return null;

    while (currentTotal < targetAmount && daysCount < maxDays) {
      const currentDayOfWeek = getDay(curr) as WeekDay;
      let dailyIncrement = 0;

      rules.forEach(rule => {
        if (rule.days.includes(currentDayOfWeek)) {
          dailyIncrement += rule.value;
        }
      });

      currentTotal += dailyIncrement;
      if (currentTotal >= targetAmount) break;
      
      curr = addDays(curr, 1);
      daysCount++;
    }

    if (currentTotal < targetAmount) return null;

    const duration = intervalToDuration({ start, end: curr });
    return {
      date: format(curr, 'dd MMMM yyyy', { locale: nl }),
      rawDate: curr,
      days: daysCount,
      years: duration.years || 0,
      months: duration.months || 0,
      remainingDays: duration.days || 0
    };
  }, [startDate, targetAmount, rules]);

  // Core Date Calculation
  const dateInfo = useMemo((): CalculationResult | null => {
    if (!isDateComplete(startDate)) return null;
    if (calculationMode === 'endDate' && !isDateComplete(endDate)) return null;

    const start = parse(`${startDate} ${startTime}`, 'dd-MM-yyyy HH:mm', new Date());
    let end: Date;

    if (calculationMode === 'targetAmount') {
      if (!targetResult) return null;
      end = targetResult.rawDate;
      // Set time to end of day for consistency if needed, but targetResult uses start of day
    } else {
      end = parse(`${endDate} ${endTime}`, 'dd-MM-yyyy HH:mm', new Date());
    }

    if (!isValid(start) || !isValid(end) || start > end) return null;

    const totalDays = differenceInDays(end, start);
    const years = differenceInYears(end, start);
    const months = differenceInMonths(end, start);
    const weeks = Math.floor(totalDays / 7);
    const remainingDays = totalDays % 7;

    const totalSeconds = differenceInSeconds(end, start);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds;

    let weekdays = 0;
    let curr = parse(startDate, 'dd-MM-yyyy', new Date());
    const endDay = parse(endDate, 'dd-MM-yyyy', new Date());
    while (curr <= endDay) {
      const day = getDay(curr);
      if (day !== 0 && day !== 6) {
        weekdays++;
      }
      curr = addDays(curr, 1);
    }

    return { totalDays, years, months, weeks, remainingDays, weekdays, workdays: weekdays, hours, minutes, seconds };
  }, [startDate, startTime, endDate, endTime]);

  // Simulation Logic
  const simulation = useMemo((): SimulationStep[] => {
    if (!isDateComplete(startDate)) return [];
    if (calculationMode === 'endDate' && !isDateComplete(endDate)) return [];

    const start = parse(startDate, 'dd-MM-yyyy', new Date());
    let end: Date;
    
    if (calculationMode === 'targetAmount') {
      if (!targetResult) return [];
      end = targetResult.rawDate;
    } else {
      end = parse(endDate, 'dd-MM-yyyy', new Date());
    }

    if (!isValid(start) || !isValid(end) || start > end) return [];

    const steps: SimulationStep[] = [];
    let currentTotal = 0;
    let curr = start;

    const maxDays = differenceInDays(end, start);

    while (curr <= end) {
      let dailyIncrement = 0;
      const currentDayOfWeek = getDay(curr) as WeekDay;

      rules.forEach(rule => {
        if (rule.days.includes(currentDayOfWeek)) {
          dailyIncrement += rule.value;
        }
      });

      currentTotal += dailyIncrement;
      
      // Filter de stappen voor het overzicht
      // We voegen ALTIJD de start, het einde, de eerste van de maand, en alle dagen waarop er een inleg is gedaan toe
      if (isSameDay(curr, start) || isSameDay(curr, end) || curr.getDate() === 1 || dailyIncrement > 0) {
         steps.push({
          date: format(curr, 'dd MMM yyyy', { locale: nl }),
          totalValue: currentTotal,
          increment: dailyIncrement
        });
      }

      curr = addDays(curr, 1);
    }

    return steps;
  }, [startDate, endDate, rules]);

  const addRule = () => {
    const newRule: ScenarioRule = {
      id: crypto.randomUUID(),
      type: 'saving',
      label: 'Nieuwe Regel',
      value: 10,
      unit: '€',
      days: [1, 4] // Mon, Thu default
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<ScenarioRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const toggleDay = (ruleId: string, day: WeekDay) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    const newDays = rule.days.includes(day) 
      ? rule.days.filter(d => d !== day)
      : [...rule.days, day];
    updateRule(ruleId, { days: newDays });
  };

  const totalValue = simulation.length > 0 ? simulation[simulation.length - 1].totalValue : 0;

  return (
    <div className="min-h-screen pb-20 bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-400 dark:border-slate-700 sticky top-0 z-10 shadow-md transition-colors">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-800 p-2 rounded-lg shadow-inner">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white hidden sm:block">Datum & Wat-Als</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsHoursConverterMode(!isHoursConverterMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black transition-all border-2 shadow-md ${
                isHoursConverterMode 
                  ? 'bg-indigo-800 text-white border-indigo-900' 
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
              }`}
              title={isHoursConverterMode ? 'Terug naar simulator' : 'Uren omzetter tool'}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span className="hidden md:inline">{isHoursConverterMode ? 'Simulator' : 'Uren Tool'}</span>
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-md border-2 border-slate-300 dark:border-slate-600"
              title={isDarkMode ? 'Licht modus' : 'Donker modus'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {isHoursConverterMode ? (
          <div className="max-w-2xl mx-auto">
            <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border-4 border-indigo-100 dark:border-indigo-900/30 transition-all">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-indigo-800 p-3 rounded-2xl shadow-lg">
                  <Timer className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">Uren naar Tijd Omzetter</h2>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Inclusief schrikkeljaren</p>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-black text-slate-900 dark:text-slate-300 mb-3 uppercase tracking-widest">Voer aantal uren in</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={inputHours}
                      onChange={(e) => setInputHours(Number(e.target.value))}
                      className="w-full px-6 py-5 text-3xl font-black rounded-2xl border-4 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-indigo-800 dark:text-indigo-400 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-800 dark:focus:border-indigo-500 outline-none transition-all shadow-inner"
                      placeholder="Bijv: 229901"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">UUR</div>
                  </div>
                </div>

                {hoursConversion && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-8 border-t-4 border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-center transform transition-hover hover:scale-105">
                      <p className="text-4xl font-black text-indigo-800 dark:text-indigo-400">{hoursConversion.years}</p>
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Jaar</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-center transform transition-hover hover:scale-105">
                      <p className="text-4xl font-black text-indigo-800 dark:text-indigo-400">{hoursConversion.months}</p>
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Maanden</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-center transform transition-hover hover:scale-105">
                      <p className="text-4xl font-black text-indigo-800 dark:text-indigo-400">{hoursConversion.weeks}</p>
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Weken</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-center transform transition-hover hover:scale-105">
                      <p className="text-4xl font-black text-emerald-800 dark:text-emerald-400">{hoursConversion.days}</p>
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Dagen</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-center transform transition-hover hover:scale-105 sm:col-span-2">
                      <p className="text-4xl font-black text-emerald-800 dark:text-emerald-400">{hoursConversion.hours}</p>
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Resterende Uren</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-10 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border-2 border-amber-100 dark:border-amber-800 text-center">
                <p className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">Wist je dat?</p>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mt-1">Deze berekening houdt rekening met de gemiddelde kalenderstructuur inclusief schrikkeljaren voor maximale nauwkeurigheid.</p>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Config */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Mode Toggle */}
              <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-md border border-slate-300 dark:border-slate-700 flex gap-2 transition-colors">
                <button 
                  onClick={() => setCalculationMode('endDate')}
                  className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                    calculationMode === 'endDate' 
                      ? 'bg-indigo-800 text-white shadow-lg' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Datum Berekenen
                </button>
                <button 
                  onClick={() => setCalculationMode('targetAmount')}
                  className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                    calculationMode === 'targetAmount' 
                      ? 'bg-emerald-800 text-white shadow-lg' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  Doel Berekenen
                </button>
              </div>

              {/* Date Picker Section */}
              <section className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-md border border-slate-300 dark:border-slate-700 transition-colors">
                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-indigo-800 dark:text-indigo-400" />
                  {calculationMode === 'endDate' ? 'Tijdsperiode' : 'Startdatum'}
                </h2>
                <div className="space-y-4">
                  <div className={`grid gap-4 ${calculationMode === 'endDate' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="space-y-3">
                      <label className="block text-sm font-black text-slate-900 dark:text-slate-300 uppercase tracking-wide">Start</label>
                      <div className="flex flex-col gap-2">
                        <input 
                          type="text" 
                          inputMode="numeric"
                          placeholder="DD-MM-JJJJ"
                          autoComplete="off"
                          value={startDate}
                          onChange={(e) => handleDateChange(e.target.value, setStartDate)}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-800 dark:focus:ring-indigo-500 focus:border-indigo-800 dark:focus:border-indigo-500 outline-none transition-all font-bold"
                        />
                        <input 
                          type="time" 
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-800 dark:focus:ring-indigo-500 focus:border-indigo-800 dark:focus:border-indigo-500 outline-none transition-all font-bold"
                        />
                      </div>
                    </div>
                    {calculationMode === 'endDate' && (
                      <div className="space-y-3">
                        <label className="block text-sm font-black text-slate-900 dark:text-slate-300 uppercase tracking-wide">Einde</label>
                        <div className="flex flex-col gap-2">
                          <input 
                            type="text" 
                            inputMode="numeric"
                            placeholder="DD-MM-JJJJ"
                            autoComplete="off"
                            value={endDate}
                            onChange={(e) => handleDateChange(e.target.value, setEndDate)}
                            className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-800 dark:focus:ring-indigo-500 focus:border-indigo-800 dark:focus:border-indigo-500 outline-none transition-all font-bold"
                          />
                          <input 
                            type="time" 
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-800 dark:focus:ring-indigo-500 focus:border-indigo-800 dark:focus:border-indigo-500 outline-none transition-all font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {dateInfo ? (
                    <>
                      <div className="pt-6 mt-6 border-t-2 border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-black text-indigo-800 dark:text-indigo-400">{dateInfo.years}</p>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase">Jaar</p>
                        </div>
                        <div className="text-center border-x-0 sm:border-x-2 border-slate-200 dark:border-slate-700">
                          <p className="text-2xl font-black text-indigo-800 dark:text-indigo-400">{dateInfo.months}</p>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase">Maanden</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black text-indigo-800 dark:text-indigo-400">{dateInfo.totalDays}</p>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase">Totaal Dagen</p>
                        </div>
                        <div className="text-center border-t-2 sm:border-t-0 pt-4 sm:pt-0 border-slate-200 dark:border-slate-700">
                          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-400">{dateInfo.weekdays}</p>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase">Weekdagen</p>
                        </div>
                        <div className="text-center border-t-2 sm:border-t-0 pt-4 sm:pt-0 border-slate-200 dark:border-slate-700 border-x-0 sm:border-x-2">
                          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-400">{dateInfo.workdays}</p>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase">Werkdagen</p>
                        </div>
                        <div className="text-center border-t-2 sm:border-t-0 pt-4 sm:pt-0 border-slate-200 dark:border-slate-700">
                          <p className="text-2xl font-black text-indigo-800 dark:text-indigo-400">{dateInfo.weeks}</p>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase">Weken</p>
                        </div>
                      </div>

                      {/* Precise Time Display */}
                      <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border-2 border-indigo-100 dark:border-indigo-800">
                        <p className="text-[10px] font-black text-indigo-800 dark:text-indigo-400 uppercase mb-3 text-center tracking-widest">Precieze Tijdsduur</p>
                        <div className="flex justify-around items-center">
                          <div className="text-center">
                            <p className="text-xl font-black text-slate-900 dark:text-white">{dateInfo.hours.toLocaleString()}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase">Uur</p>
                          </div>
                          <div className="w-px h-8 bg-indigo-200 dark:bg-indigo-800"></div>
                          <div className="text-center">
                            <p className="text-xl font-black text-slate-900 dark:text-white">{dateInfo.minutes.toLocaleString()}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase">Min</p>
                          </div>
                          <div className="w-px h-8 bg-indigo-200 dark:bg-indigo-800"></div>
                          <div className="text-center">
                            <p className="text-xl font-black text-slate-900 dark:text-white">{dateInfo.seconds.toLocaleString()}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase">Sec</p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-red-900 dark:text-red-200 font-black bg-red-100 dark:bg-red-900/30 p-4 rounded-xl border-2 border-red-200 dark:border-red-800 text-center">Ongeldige datumreeks</p>
                  )}
                </div>
              </section>

              {/* Target Goal Section */}
              {calculationMode === 'targetAmount' && (
                <section className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-md border border-slate-300 dark:border-slate-700 transition-colors">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />
                    Vast Spaardoel
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-black text-slate-900 dark:text-slate-300 mb-2 uppercase tracking-wide">Hoeveel wil je sparen?</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={targetAmount}
                          onChange={(e) => setTargetAmount(Number(e.target.value))}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-800 dark:focus:ring-indigo-500 focus:border-indigo-800 dark:focus:border-indigo-500 outline-none transition-all font-bold"
                          placeholder="Bijv: 1200"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">€</div>
                      </div>
                    </div>

                    {targetResult ? (
                      <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border-2 border-emerald-100 dark:border-emerald-800 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
                          <Sparkles className="w-4 h-4" />
                          <p className="text-xs font-black uppercase tracking-widest">Doel Bereikt Op</p>
                        </div>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{targetResult.date}</p>
                        <div className="pt-3 border-t border-emerald-100 dark:border-emerald-800/50 grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-lg font-black text-emerald-800 dark:text-emerald-400">{targetResult.years}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase">Jaar</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-emerald-800 dark:text-emerald-400">{targetResult.months}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase">Maanden</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-emerald-800 dark:text-emerald-400">{targetResult.remainingDays}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase">Dagen</p>
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-emerald-900/60 dark:text-emerald-400/60 text-center mt-2 italic">
                          Totaal: {targetResult.days} dagen sparen
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-xs font-bold text-slate-500 italic">
                          {rules.length === 0 ? 'Voeg regels toe om de datum te berekenen' : 'Voer een geldig bedrag in'}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Scenario Rules Section */}
              <section className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-md border border-slate-300 dark:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />
                    Wat-Als Scenario's
                  </h2>
                  <button 
                    onClick={addRule}
                    className="p-2.5 bg-emerald-800 dark:bg-emerald-700 text-white rounded-lg hover:bg-emerald-900 dark:hover:bg-emerald-600 transition-colors shadow-md active:scale-95 border-2 border-emerald-900 dark:border-emerald-800"
                    title="Regel toevoegen"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {rules.length === 0 && (
                    <div className="text-center py-12 border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-100 dark:bg-slate-800/50">
                      <p className="text-slate-800 dark:text-slate-400 font-black italic">Klik op '+' om een regel toe te voegen!</p>
                    </div>
                  )}
                  {rules.map((rule) => (
                    <div key={rule.id} className="p-5 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 relative group transition-all hover:border-indigo-500 dark:hover:border-indigo-400 shadow-sm">
                      <button 
                        onClick={() => removeRule(rule.id)}
                        className="absolute -top-3 -right-3 p-2.5 bg-white dark:bg-slate-700 border-2 border-slate-400 dark:border-slate-600 text-slate-900 dark:text-white hover:text-red-800 dark:hover:text-red-400 hover:border-red-800 dark:hover:border-red-400 rounded-full shadow-xl transition-all active:scale-90 z-10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div className="space-y-4">
                        <div className="flex gap-4 items-end">
                          <div className="flex-1">
                             <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase mb-1 block">Naam van de regel</label>
                             <input 
                              type="text" 
                              value={rule.label}
                              onChange={(e) => updateRule(rule.id, { label: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-indigo-800 dark:focus:border-indigo-500 outline-none text-sm font-black text-slate-900 dark:text-white shadow-inner transition-colors"
                              placeholder="Bijv: Wekelijks Sparen"
                            />
                          </div>
                          <div className="w-32">
                            <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase mb-1 block text-right">Bedrag (€)</label>
                            <input 
                              type="number" 
                              value={rule.value}
                              onChange={(e) => updateRule(rule.id, { value: Number(e.target.value) })}
                              className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-indigo-800 dark:focus:border-indigo-500 outline-none text-sm font-black text-right text-indigo-900 dark:text-indigo-400 shadow-inner transition-colors"
                            />
                          </div>
                        </div>
                        
                        <div>
                           <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase mb-2 block">Kies de dagen</label>
                           <div className="flex flex-wrap gap-2">
                            {['Zon', 'Maa', 'Din', 'Woe', 'Don', 'Vrij', 'Zat'].map((name, idx) => (
                              <button
                                key={idx}
                                onClick={() => toggleDay(rule.id, idx as WeekDay)}
                                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all border-2 ${
                                  rule.days.includes(idx as WeekDay) 
                                    ? 'bg-indigo-800 dark:bg-indigo-600 text-white border-indigo-900 dark:border-indigo-700 shadow-md ring-4 ring-indigo-200 dark:ring-indigo-900/50' 
                                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-400 dark:border-slate-600'
                                }`}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right Column: Results & Charts */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard 
                  title="Eindtotaal" 
                  value={`€ ${totalValue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`}
                  icon={Euro}
                  color="bg-emerald-700"
                  isDarkMode={isDarkMode}
                />
                <StatCard 
                  title="Groeiperiode" 
                  value={`${dateInfo?.totalDays || 0} Dagen`}
                  icon={TrendingUp}
                  color="bg-indigo-800"
                  isDarkMode={isDarkMode}
                />
              </div>

              {/* Table Breakdown / Milestones */}
              <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg border border-slate-300 dark:border-slate-700 transition-colors flex-1">
                 <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-8 flex items-center justify-between border-b-4 border-slate-100 dark:border-slate-800 pb-4">
                   Overzicht Mijlpalen
                   <span className="text-xs font-black text-white bg-indigo-800 dark:bg-indigo-600 px-4 py-1.5 rounded-full shadow-sm tracking-widest uppercase">Groei per fase</span>
                 </h2>
                 <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-inner max-h-[600px] overflow-y-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800/50 sticky top-0 z-10">
                        <tr className="bg-slate-100 dark:bg-slate-800">
                          <th className="px-6 py-5 font-black uppercase tracking-wider text-xs border-r border-slate-300 dark:border-slate-700">Datum</th>
                          <th className="px-6 py-5 font-black uppercase tracking-wider text-xs border-r border-slate-300 dark:border-slate-700 text-right">Inleg op deze dag</th>
                          <th className="px-6 py-5 font-black uppercase tracking-wider text-xs text-right">Totaal Balans</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-slate-200 dark:divide-slate-800">
                        {(() => {
                          // We tonen de start, het einde, en alle dagen waarop er een inleg is gedaan
                          const displaySteps = simulation;
                          
                          // Beperk tot de laatste 200 als het er teveel zijn om de UI clean te houden
                          // We tonen de eerste 100 en de laatste 100 om een goed beeld van start en finish te geven
                          const finalSteps = displaySteps.length > 200 
                            ? [...displaySteps.slice(0, 100), ...displaySteps.slice(-100)]
                            : displaySteps;

                          if (finalSteps.length === 0) {
                            return (
                              <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-slate-500 font-black italic">
                                  Geen data beschikbaar voor deze periode.
                                </td>
                              </tr>
                            );
                          }

                          return finalSteps.map((step, idx) => {
                            const isGap = idx > 0 && displaySteps.length > 200 && idx === 100;
                            
                            return (
                              <React.Fragment key={idx}>
                                {isGap && (
                                  <tr>
                                    <td colSpan={3} className="px-6 py-4 text-center bg-slate-50 dark:bg-slate-800/30 border-y-2 border-slate-200 dark:border-slate-700">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">... Tussenliggende periodes verborgen ...</span>
                                    </td>
                                  </tr>
                                )}
                                <tr className="hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group font-bold">
                                  <td className="px-6 py-6 text-slate-900 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">{step.date}</td>
                                  <td className="px-6 py-6 text-right font-black text-emerald-800 dark:text-emerald-400 border-r border-slate-100 dark:border-slate-800">
                                    {step.increment > 0 ? `+€${step.increment.toFixed(2)}` : '€0,00'}
                                  </td>
                                  <td className="px-6 py-6 text-right font-black text-indigo-950 dark:text-indigo-300 text-xl">
                                    €{step.totalValue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>
                   </table>
                 </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="max-w-6xl mx-auto px-4 mt-20 text-center border-t-4 border-slate-200 dark:border-slate-800 pt-10 transition-colors">
        <p className="text-slate-900 dark:text-slate-300 text-sm font-black uppercase tracking-[0.2em] mb-3">© 2026 Datum & Wat-Als Tool</p>
        <p className="text-slate-700 dark:text-slate-400 text-xs font-bold max-w-md mx-auto leading-relaxed">
          Een krachtige simulatie tool voor het inzichtelijk maken van spaardoelen en gewoontes over tijd.
        </p>
      </footer>
    </div>
  );
};

export default App;
