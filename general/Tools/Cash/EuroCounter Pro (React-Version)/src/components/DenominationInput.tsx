import React from 'react';
import { Denomination } from '../lib/types';
import { Minus, Plus } from 'lucide-react';

interface DenominationInputProps {
  denomination: Denomination;
  count: number;
  onChange: (id: string, value: number) => void;
}

const DenominationInput: React.FC<DenominationInputProps> = ({ denomination, count, onChange }) => {
  const handleIncrement = () => onChange(denomination.id, count + 1);
  const handleDecrement = () => onChange(denomination.id, Math.max(0, count - 1));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    onChange(denomination.id, isNaN(val) ? 0 : Math.max(0, val));
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
      <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl border ${denomination.color} font-black text-sm`}>
        <span>{denomination.label}</span>
        <span className="text-[10px] opacity-60 uppercase tracking-tighter">
          {denomination.type === 'bill' ? 'Biljet' : 'Munt'}
        </span>
      </div>
      
      <div className="flex items-center gap-1">
        <button 
          onClick={handleDecrement}
          className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
        >
          <Minus size={16} strokeWidth={3} />
        </button>
        
        <input 
          type="number" 
          value={count === 0 ? '' : count}
          onChange={handleChange}
          placeholder="0"
          className="w-full text-center font-black text-xl text-slate-800 focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        
        <button 
          onClick={handleIncrement}
          className="p-2 hover:bg-slate-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
        >
          <Plus size={16} strokeWidth={3} />
        </button>
      </div>
      
      <div className="text-center">
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Subtotaal</span>
        <p className="font-black text-slate-600 text-sm">€{(denomination.value * count).toFixed(2)}</p>
      </div>
    </div>
  );
};

export default DenominationInput;
