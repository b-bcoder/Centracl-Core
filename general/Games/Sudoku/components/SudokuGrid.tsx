
import React from 'react';
import { Grid, CellPosition, NotesGrid } from '../types';

interface SudokuGridProps {
  puzzleGrid: Grid;
  playerGrid: Grid;
  mistakesGrid: boolean[][];
  notesGrid: NotesGrid;
  selectedCell: CellPosition | null;
  onCellSelect: (row: number, col: number) => void;
}

const SudokuGrid: React.FC<SudokuGridProps> = ({ 
  puzzleGrid, 
  playerGrid, 
  mistakesGrid, 
  notesGrid, 
  selectedCell, 
  onCellSelect 
}) => {
  
  const isRelated = (row: number, col: number, sel: CellPosition | null): boolean => {
    if (!sel) return false;
    const { row: selRow, col: selCol } = sel;
    if (row === selRow || col === selCol) return true;
    const boxStartRow = Math.floor(selRow / 3) * 3;
    const boxStartCol = Math.floor(selCol / 3) * 3;
    return row >= boxStartRow && row < boxStartRow + 3 && col >= boxStartCol && col < boxStartCol + 3;
  };

  const isSameValue = (row: number, col: number, sel: CellPosition | null): boolean => {
    if (!sel) return false;
    const val = playerGrid[sel.row][sel.col];
    if (val === null) return false;
    return playerGrid[row][col] === val;
  };

  return (
    <div className="aspect-square w-full max-w-sm sm:max-w-md mx-auto bg-slate-200 dark:bg-slate-700 p-[2px] rounded-xl shadow-2xl border-4 border-slate-300 dark:border-slate-600 grid grid-cols-9 overflow-hidden">
      {playerGrid.map((rowArr, r) => (
        rowArr.map((cell, c) => {
          const isSelected = selectedCell?.row === r && selectedCell?.col === c;
          const isHighlight = isRelated(r, c, selectedCell);
          const isSameVal = isSameValue(r, c, selectedCell);
          const isInitial = puzzleGrid[r][c] !== null;
          const isMistake = mistakesGrid[r][c];

          let bgColor = 'bg-white dark:bg-slate-800';
          if (isSelected) {
            bgColor = 'bg-sky-500 dark:bg-sky-600';
          } else if (isHighlight) {
            bgColor = 'bg-sky-50 dark:bg-sky-900/40';
          }
          
          if (isSameVal && !isSelected) {
            bgColor = 'bg-sky-200 dark:bg-sky-800/80';
          }

          let textColor = 'text-slate-800 dark:text-slate-100';
          if (isSelected) {
            textColor = 'text-white';
          } else if (isInitial) {
            textColor = 'text-slate-900 dark:text-white font-black';
          } else if (isMistake) {
            textColor = 'text-red-500';
          } else {
            textColor = 'text-sky-600 dark:text-sky-300';
          }

          return (
            <div
              key={`${r}-${c}`}
              onClick={() => onCellSelect(r, c)}
              className={`
                aspect-square flex items-center justify-center cursor-pointer select-none transition-colors border-[0.5px] border-slate-100 dark:border-slate-700/50 relative
                ${bgColor} ${textColor}
                ${c % 3 === 2 && c !== 8 ? 'border-r-4 border-r-slate-300 dark:border-r-slate-600' : ''}
                ${r % 3 === 2 && r !== 8 ? 'border-b-4 border-b-slate-300 dark:border-b-slate-600' : ''}
              `}
            >
              {cell !== null ? (
                <span className={`text-2xl sm:text-3xl font-bold ${isSelected ? 'scale-110' : ''} transition-transform`}>
                  {cell}
                </span>
              ) : (
                <div className="grid grid-cols-3 gap-[1px] w-full h-full p-1">
                  {Array.from({ length: 9 }).map((_, i) => {
                    const num = i + 1;
                    const hasNote = notesGrid[r][c].has(num);
                    return (
                      <div key={i} className="flex items-center justify-center text-[8px] sm:text-[10px] leading-none text-slate-400 dark:text-slate-500 font-bold">
                        {hasNote ? num : ''}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      ))}
    </div>
  );
};

export default SudokuGrid;
