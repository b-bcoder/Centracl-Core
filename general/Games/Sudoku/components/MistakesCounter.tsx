
import React from 'react';
import { MAX_MISTAKES } from '../constants';
import { XCircle } from 'lucide-react';

interface MistakesCounterProps {
  mistakes: number;
}

const MistakesCounter: React.FC<MistakesCounterProps> = ({ mistakes }) => {
  return (
    <div className="flex items-center space-x-2">
       <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Fouten:</span>
       <div className="flex items-center space-x-1">
        {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
          <XCircle 
            key={i} 
            size={20} 
            className={i < mistakes ? "text-red-500 fill-red-500/20" : "text-slate-200 dark:text-slate-700"} 
          />
        ))}
       </div>
    </div>
  );
};

export default MistakesCounter;
