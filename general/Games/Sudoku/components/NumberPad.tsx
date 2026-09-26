
import React from 'react';
import { Eraser, Pencil } from 'lucide-react';

interface NumberPadProps {
  onNumberInput: (num: number) => void;
  onErase: () => void;
  isNotesMode: boolean;
  toggleNotesMode: () => void;
}

const NumberPad: React.FC<NumberPadProps> = ({ onNumberInput, onErase, isNotesMode, toggleNotesMode }) => {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  
  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {numbers.map((num) => (
          <button
            key={num}
            onClick={() => onNumberInput(num)}
            className="aspect-square flex items-center justify-center text-3xl font-bold bg-white dark:bg-slate-700 hover:bg-sky-50 shadow-sm dark:shadow-none hover:shadow-md dark:hover:bg-slate-600 rounded-2xl transition-all active:scale-95 text-sky-600 dark:text-sky-400 border border-transparent hover:border-sky-200 dark:hover:border-sky-800"
          >
            {num}
          </button>
        ))}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={toggleNotesMode}
          className={`flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold transition-all active:scale-95 border-2 ${
            isNotesMode 
            ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30' 
            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-600 hover:border-sky-300'
          }`}
        >
          <Pencil size={20} className={isNotesMode ? "animate-pulse" : ""} />
          <span>Notities {isNotesMode ? 'Aan' : 'Uit'}</span>
        </button>
        
        <button
          onClick={onErase}
          className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-slate-100 dark:border-slate-600 hover:border-red-300 hover:text-red-500 transition-all active:scale-95 shadow-sm dark:shadow-none hover:shadow-md"
        >
          <Eraser size={20} />
          <span>Gum</span>
        </button>
      </div>
    </div>
  );
};

export default NumberPad;
