
import React, { useState, useCallback, useMemo } from 'react';
import { Difficulty, GameState, Grid, CellPosition, NotesGrid } from './types';
import { DIFFICULTY_LEVELS, MAX_MISTAKES } from './constants';
import { generateSudoku } from './services/sudokuService';
import SudokuGrid from './components/SudokuGrid';
import NumberPad from './components/NumberPad';
import Modal from './components/Modal';
import MistakesCounter from './components/MistakesCounter';

const DifficultyMenu: React.FC<{ onSelect: (difficulty: Difficulty) => void }> = ({ onSelect }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-4">
    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg w-full max-w-sm text-center">
      <h1 className="text-3xl font-bold mb-6 text-slate-700 dark:text-slate-200">Sudoku</h1>
      <p className="mb-8 text-slate-500 dark:text-slate-400">Kies een moeilijkheidsgraad</p>
      <div className="space-y-3">
        {Object.keys(Difficulty)
          .filter((v) => !isNaN(Number(v)))
          .map((key) => {
            const difficulty = Number(key) as Difficulty;
            return (
              <button
                key={difficulty}
                onClick={() => onSelect(difficulty)}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105"
              >
                {DIFFICULTY_LEVELS[difficulty].name}
              </button>
            );
        })}
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [puzzle, setPuzzle] = useState<Grid | null>(null);
  const [solution, setSolution] = useState<Grid | null>(null);
  const [playerGrid, setPlayerGrid] = useState<Grid | null>(null);
  const [notesGrid, setNotesGrid] = useState<NotesGrid | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [mistakesGrid, setMistakesGrid] = useState<boolean[][] | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [isExitModalOpen, setExitModalOpen] = useState(false);
  const [isNotesMode, setIsNotesMode] = useState(false);

  const isGameWon = useMemo(() => {
    if (!playerGrid) return false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (playerGrid[r][c] === null) return false;
      }
    }
    return true;
  }, [playerGrid]);

  const handleStartGame = useCallback((diff: Difficulty) => {
    const { puzzle, solution } = generateSudoku(diff);
    setDifficulty(diff);
    setPuzzle(puzzle);
    setSolution(solution);
    setPlayerGrid(JSON.parse(JSON.stringify(puzzle)));
    setMistakesGrid(Array(9).fill(null).map(() => Array(9).fill(false)));
    
    // Initialize empty notes grid
    const initialNotes = Array(9).fill(null).map(() => 
      Array(9).fill(null).map(() => new Set<number>())
    );
    setNotesGrid(initialNotes);
    
    setMistakes(0);
    setSelectedCell(null);
    setIsNotesMode(false);
    setGameState('PLAYING');
  }, []);

  const handleReturnToMenu = useCallback(() => {
    setGameState('MENU');
    setDifficulty(null);
    setPuzzle(null);
    setSolution(null);
    setPlayerGrid(null);
    setNotesGrid(null);
    setIsNotesMode(false);
  }, []);

  const handleCellSelect = useCallback((row: number, col: number) => {
    if (puzzle && puzzle[row][col] === null) {
      setSelectedCell({ row, col });
    } else {
      setSelectedCell(null);
    }
  }, [puzzle]);

  const handleNumberInput = useCallback((num: number) => {
    if (!selectedCell || !playerGrid || !solution || !mistakesGrid || !notesGrid) return;

    const { row, col } = selectedCell;

    // Handle Notes Mode
    if (isNotesMode) {
      // Optioneel: sta geen notities toe als er al een nummer staat
      if (playerGrid[row][col] !== null) return;

      const newNotesGrid = notesGrid.map(r => r.map(c => new Set(c))); // Deep copy structure
      const currentCellNotes = newNotesGrid[row][col];

      if (currentCellNotes.has(num)) {
        currentCellNotes.delete(num);
      } else {
        currentCellNotes.add(num);
      }
      setNotesGrid(newNotesGrid);
      return;
    }

    // Handle Normal Input
    const newGrid = JSON.parse(JSON.stringify(playerGrid));
    newGrid[row][col] = num;

    // Clear notes for this cell when placing a number
    const newNotesGrid = notesGrid.map(r => r.map(c => new Set(c)));
    newNotesGrid[row][col].clear();
    setNotesGrid(newNotesGrid);

    if (solution[row][col] !== num) {
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      const newMistakesGrid = JSON.parse(JSON.stringify(mistakesGrid));
      newMistakesGrid[row][col] = true;
      setMistakesGrid(newMistakesGrid);
      if (newMistakes >= MAX_MISTAKES) {
        setGameState('GAME_OVER');
      }
    } else {
       const newMistakesGrid = JSON.parse(JSON.stringify(mistakesGrid));
       newMistakesGrid[row][col] = false;
       setMistakesGrid(newMistakesGrid);
    }
    
    setPlayerGrid(newGrid);

    // Check for win condition after state update
    const isNowFull = !newGrid.flat().includes(null);
    if(isNowFull && mistakes < MAX_MISTAKES) {
      setTimeout(() => setGameState('WON'), 100);
    }

  }, [selectedCell, playerGrid, solution, mistakes, mistakesGrid, isNotesMode, notesGrid]);

  const handleErase = useCallback(() => {
    if (!selectedCell || !playerGrid || !notesGrid) return;
    const { row, col } = selectedCell;

    if (playerGrid[row][col] !== null) {
      // Erase Number
      const newGrid = JSON.parse(JSON.stringify(playerGrid));
      newGrid[row][col] = null;
      setPlayerGrid(newGrid);

      if(mistakesGrid) {
        const newMistakesGrid = JSON.parse(JSON.stringify(mistakesGrid));
        newMistakesGrid[row][col] = false;
        setMistakesGrid(newMistakesGrid);
      }
    } else {
      // Erase Notes if cell is empty
      const newNotesGrid = notesGrid.map(r => r.map(c => new Set(c)));
      newNotesGrid[row][col].clear();
      setNotesGrid(newNotesGrid);
    }

  }, [selectedCell, playerGrid, mistakesGrid, notesGrid]);

  if (gameState === 'MENU') {
    return <DifficultyMenu onSelect={handleStartGame} />;
  }
  
  if (!playerGrid || !puzzle || difficulty === null || !mistakesGrid || !notesGrid) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-2 sm:p-4">
      <div className="w-full max-w-lg mx-auto">
        <header className="flex justify-between items-center mb-4 px-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{DIFFICULTY_LEVELS[difficulty].name}</h1>
          </div>
          <MistakesCounter mistakes={mistakes} />
        </header>

        <main className="mb-4">
          <SudokuGrid
            puzzleGrid={puzzle}
            playerGrid={playerGrid}
            mistakesGrid={mistakesGrid}
            notesGrid={notesGrid}
            selectedCell={selectedCell}
            onCellSelect={handleCellSelect}
          />
        </main>
        
        <footer className="flex flex-col items-center">
            <NumberPad 
              onNumberInput={handleNumberInput} 
              onErase={handleErase}
              isNotesMode={isNotesMode}
              toggleNotesMode={() => setIsNotesMode(!isNotesMode)}
            />
            <button
                onClick={() => setExitModalOpen(true)}
                className="mt-6 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition"
            >
                Exit
            </button>
        </footer>
      </div>

      <Modal isOpen={isExitModalOpen} onClose={() => setExitModalOpen(false)}>
        <h2 className="text-xl font-bold mb-4">Spel verlaten?</h2>
        <p className="mb-6">Weet je zeker dat je wilt stoppen? Je voortgang gaat verloren.</p>
        <div className="flex justify-end space-x-3">
          <button onClick={() => setExitModalOpen(false)} className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500">Annuleren</button>
          <button onClick={() => { setExitModalOpen(false); handleReturnToMenu(); }} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white">Afsluiten</button>
        </div>
      </Modal>

      <Modal isOpen={gameState === 'GAME_OVER'} onClose={handleReturnToMenu}>
        <h2 className="text-2xl font-bold mb-4 text-red-500">Game Over</h2>
        <p className="mb-6">Je hebt {MAX_MISTAKES} fouten gemaakt. Probeer het opnieuw!</p>
        <div className="flex justify-center">
          <button onClick={handleReturnToMenu} className="px-6 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold">Terug naar menu</button>
        </div>
      </Modal>

      <Modal isOpen={gameState === 'WON'} onClose={handleReturnToMenu}>
         <h2 className="text-2xl font-bold mb-4 text-green-500">Gefeliciteerd!</h2>
        <p className="mb-6">Je hebt de Sudoku opgelost!</p>
        <div className="flex justify-center">
          <button onClick={handleReturnToMenu} className="px-6 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold">Speel nogmaals</button>
        </div>
      </Modal>
    </div>
  );
};

export default App;