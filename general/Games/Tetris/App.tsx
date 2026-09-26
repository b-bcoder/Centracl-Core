
import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- CONSTANTS & CONFIG ---
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const TETROMINOS = {
  '0': { shape: [[0]], color: 'transparent' }, // Empty cell
  I: {
    shape: [[1, 1, 1, 1]],
    color: 'bg-cyan-500',
  },
  J: {
    shape: [[0, 2, 0], [0, 2, 0], [2, 2, 0]],
    color: 'bg-blue-600',
  },
  L: {
    shape: [[0, 3, 0], [0, 3, 0], [0, 3, 3]],
    color: 'bg-orange-500',
  },
  O: {
    shape: [[4, 4], [4, 4]],
    color: 'bg-yellow-400',
  },
  S: {
    shape: [[0, 5, 5], [5, 5, 0], [0, 0, 0]],
    color: 'bg-green-500',
  },
  T: {
    shape: [[0, 0, 0], [6, 6, 6], [0, 6, 0]],
    color: 'bg-purple-600',
  },
  Z: {
    shape: [[7, 7, 0], [0, 7, 7], [0, 0, 0]],
    color: 'bg-red-500',
  },
};
const TETROMINO_KEYS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'] as const;

// --- TYPES ---
type TetrominoKey = typeof TETROMINO_KEYS[number];
type Board = (TetrominoKey | '0')[][];
type Player = {
  pos: { x: number; y: number };
  tetromino: { shape: (number | TetrominoKey)[][]; color: string };
  key: TetrominoKey;
  collided: boolean;
};

// --- HELPER FUNCTIONS ---
const createEmptyBoard = (): Board => Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill('0'));

// --- UI COMPONENTS ---

interface CellProps {
  type: TetrominoKey | '0';
}
const Cell: React.FC<CellProps> = React.memo(({ type }) => {
  const color = type === '0' ? 'bg-gray-800' : TETROMINOS[type].color;
  const borderStyle = type !== '0' ? 'border-gray-900' : 'border-gray-700';

  return (
    <div className={`w-full aspect-square ${color} border-[1px] ${borderStyle} transition-colors duration-100`}>
      {type !== '0' && <div className="w-full h-full opacity-20 bg-white/30" />}
    </div>
  );
});

interface GameInfoPanelProps {
  score: number;
  highScore: number;
  lines: number;
  level: number;
  nextPiece: TetrominoKey;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleMute: () => void;
}
const GameInfoPanel: React.FC<GameInfoPanelProps> = ({ score, highScore, lines, level, nextPiece, volume, isMuted, onVolumeChange, onToggleMute }) => {
  const { shape, color } = TETROMINOS[nextPiece];
  
  return (
    <div className="w-full md:w-1/3 lg:w-1/4 p-4 space-y-6 bg-gray-900 rounded-lg shadow-lg border border-gray-700">
      <h2 className="font-press-start text-2xl text-cyan-400 text-center">TETRIS</h2>
      
      <div className="space-y-3 text-lg">
        <div className="bg-gray-800 p-3 rounded-md">
          <p className="text-gray-400">High Score</p>
          <p className="text-white font-bold text-2xl tracking-wider">{highScore}</p>
        </div>
        <div className="bg-gray-800 p-3 rounded-md">
          <p className="text-gray-400">Score</p>
          <p className="text-white font-bold text-2xl tracking-wider">{score}</p>
        </div>
        <div className="bg-gray-800 p-3 rounded-md">
          <p className="text-gray-400">Lines</p>
          <p className="text-white font-bold text-2xl tracking-wider">{lines}</p>
        </div>
        <div className="bg-gray-800 p-3 rounded-md">
          <p className="text-gray-400">Level</p>
          <p className="text-white font-bold text-2xl tracking-wider">{level}</p>
        </div>
      </div>
      
      <div className="bg-gray-800 p-3 rounded-md">
        <p className="text-gray-400 mb-2 text-center">Next</p>
        <div className="flex justify-center items-center h-24">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${shape[0].length}, 1fr)` }}>
            {shape.map((row, y) => 
              row.map((cell, x) => (
                cell ? <div key={`${y}-${x}`} className={`w-6 h-6 ${color}`} /> : <div key={`${y}-${x}`} className="w-6 h-6" />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="text-gray-500 text-xs pt-4 border-t border-gray-700 space-y-4">
        <div>
          <h3 className="font-bold text-gray-400 mb-2">Audio</h3>
          <div className="flex items-center gap-2">
            <button onClick={onToggleMute} className="text-white hover:text-cyan-400 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded" aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}>
              {isMuted || volume === 0 ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l-4-4m0 4l4-4" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={onVolumeChange}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              aria-label="Volume"
            />
          </div>
        </div>
        <div>
          <h3 className="font-bold text-gray-400 mb-2">Controls</h3>
          <p><span className="font-bold text-white">← →</span> : Move</p>
          <p><span className="font-bold text-white">A / D</span> : Rotate</p>
          <p><span className="font-bold text-white">C</span> : Mirror</p>
          <p><span className="font-bold text-white">↓</span> : Soft Drop</p>
          <p><span className="font-bold text-white">Space</span> : Hard Drop</p>
          <p><span className="font-bold text-white">P</span> : Pause</p>
        </div>
      </div>
    </div>
  );
};

interface ModalProps {
    title: string;
    children: React.ReactNode;
    buttonText: string;
    onButtonClick: () => void;
    titleClassName?: string;
}
const Modal: React.FC<ModalProps> = ({ title, children, buttonText, onButtonClick, titleClassName = '' }) => (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div className="bg-gray-800 text-white p-8 rounded-lg shadow-2xl text-center border-2 border-cyan-400 w-80">
            <h2 className={`font-press-start text-3xl text-cyan-400 mb-4 ${titleClassName}`}>{title}</h2>
            <div className="mb-6 text-lg">{children}</div>
            <button
                onClick={onButtonClick}
                className="font-press-start bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-bold py-3 px-6 rounded-md transition duration-300 transform hover:scale-105"
            >
                {buttonText}
            </button>
        </div>
    </div>
);


// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
    const [board, setBoard] = useState<Board>(createEmptyBoard());
    const [player, setPlayer] = useState<Player | null>(null);
    const [nextPieceKey, setNextPieceKey] = useState<TetrominoKey>(TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)]);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('tetrisHighScore') || 0));
    const [lines, setLines] = useState(0);
    const [level, setLevel] = useState(0);
    const [dropTime, setDropTime] = useState<number | null>(1000);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [volume, setVolume] = useState(() => Number(localStorage.getItem('tetrisVolume') || 0.5));
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('tetrisMuted') === 'true');

    const gameOverSoundRef = useRef<HTMLAudioElement>(null);

    // --- Audio Handling ---
    useEffect(() => {
        localStorage.setItem('tetrisVolume', String(volume));
    }, [volume]);

    useEffect(() => {
        localStorage.setItem('tetrisMuted', String(isMuted));
    }, [isMuted]);

    useEffect(() => {
        const effectiveVolume = isMuted ? 0 : volume;
        if (gameOverSoundRef.current) {
            gameOverSoundRef.current.volume = effectiveVolume;
        }
    }, [volume, isMuted]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (newVolume > 0 && isMuted) {
            setIsMuted(false);
        }
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
    };

    const resetPlayer = useCallback((): Player => {
      const newKey = nextPieceKey;
      const newTetromino = TETROMINOS[newKey];
      const newPlayer: Player = {
        pos: { x: Math.floor(BOARD_WIDTH / 2 - newTetromino.shape[0].length / 2), y: 0 },
        tetromino: newTetromino,
        key: newKey,
        collided: false,
      };
      setNextPieceKey(TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)]);
      return newPlayer;
    }, [nextPieceKey]);

    const checkCollision = useCallback((p: Player, b: Board, { moveX = 0, moveY = 0 }): boolean => {
        for (let y = 0; y < p.tetromino.shape.length; y++) {
            for (let x = 0; x < p.tetromino.shape[y].length; x++) {
                if (p.tetromino.shape[y][x] !== 0) {
                    const newY = p.pos.y + y + moveY;
                    const newX = p.pos.x + x + moveX;

                    if (
                        newY >= BOARD_HEIGHT || // Off bottom
                        newX < 0 || newX >= BOARD_WIDTH || // Off sides
                        (b[newY] && b[newY][newX] !== '0') // Colliding with another piece
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }, []);

    const startGame = useCallback(() => {
        setGameStarted(true);
        setIsGameOver(false);
        setIsPaused(false);
        setBoard(createEmptyBoard());
        setPlayer(resetPlayer());
        setScore(0);
        setLines(0);
        setLevel(0);
        setDropTime(1000);
    }, [resetPlayer]);

    const updatePlayerPos = useCallback((x: number, y: number, collided: boolean) => {
        setPlayer(prev => {
            if (!prev) return null;
            return {
                ...prev,
                pos: { x: prev.pos.x + x, y: prev.pos.y + y },
                collided,
            };
        });
    }, []);

    const drop = useCallback(() => {
        if (!player || isPaused || isGameOver) return;
        if (!checkCollision(player, board, { moveY: 1 })) {
            updatePlayerPos(0, 1, false);
        } else {
            if (player.pos.y < 1) {
                setIsGameOver(true);
                setDropTime(null);
                return;
            }
            updatePlayerPos(0, 0, true);
        }
    }, [player, board, checkCollision, isPaused, isGameOver, updatePlayerPos]);

    const movePlayer = useCallback((dir: -1 | 1) => {
      if (!player || isPaused || isGameOver) return;
      if (!checkCollision(player, board, { moveX: dir })) {
        updatePlayerPos(dir, 0, false);
      }
    }, [player, board, checkCollision, isPaused, isGameOver, updatePlayerPos]);

    const handlePlayerTransform = useCallback((transformedShape: Player['tetromino']['shape']) => {
        if (!player) return;
        const clonedPlayer = JSON.parse(JSON.stringify(player));
        clonedPlayer.tetromino.shape = transformedShape;

        let offset = 1;
        while(checkCollision(clonedPlayer, board, {})) {
            clonedPlayer.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (Math.abs(offset) > clonedPlayer.tetromino.shape[0].length) {
                return; // Can't transform
            }
        }
        setPlayer(clonedPlayer);
    }, [player, board, checkCollision]);

    const rotatePlayerRight = useCallback(() => {
        if (!player || isPaused || isGameOver) return;
        const { shape } = player.tetromino;
        const rotatedShape = shape[0].map((_, colIndex) => shape.map(row => row[colIndex]).reverse());
        handlePlayerTransform(rotatedShape);
    }, [player, isPaused, isGameOver, handlePlayerTransform]);

    const rotatePlayerLeft = useCallback(() => {
        if (!player || isPaused || isGameOver) return;
        const { shape } = player.tetromino;
        const transposed = shape[0].map((_, colIndex) => shape.map(row => row[colIndex]));
        const rotatedShape = transposed.reverse();
        handlePlayerTransform(rotatedShape);
    }, [player, isPaused, isGameOver, handlePlayerTransform]);
    
    const mirrorPlayer = useCallback(() => {
        if (!player || isPaused || isGameOver) return;
        const { shape } = player.tetromino;
        const mirroredShape = shape.map(row => [...row].reverse());
        handlePlayerTransform(mirroredShape);
    }, [player, isPaused, isGameOver, handlePlayerTransform]);

    const hardDrop = useCallback(() => {
        if (!player || isPaused || isGameOver) return;
        let newY = player.pos.y;
        while (!checkCollision(player, board, { moveY: newY - player.pos.y + 1 })) {
            newY++;
        }
        setPlayer(prev => prev ? { ...prev, pos: { x: prev.pos.x, y: newY }, collided: true } : null);
    }, [player, board, isPaused, isGameOver, checkCollision]);

    useEffect(() => {
      const sweepRows = (newBoard: Board): [Board, number] => {
          let clearedRows = 0;
          const sweptBoard = newBoard.reduce((acc, row) => {
              if (row.every(cell => cell !== '0')) {
                  clearedRows++;
                  acc.unshift(new Array(BOARD_WIDTH).fill('0'));
                  return acc;
              }
              acc.push(row);
              return acc;
          }, [] as Board);
          return [sweptBoard, clearedRows];
      };

      if (player?.collided) {
          const newBoard = board.map(row => [...row]);
          player.tetromino.shape.forEach((row, y) => {
              row.forEach((value, x) => {
                  if (value !== 0) {
                      const boardY = player.pos.y + y;
                      const boardX = player.pos.x + x;
                      if (boardY < BOARD_HEIGHT && boardX < BOARD_WIDTH) {
                          newBoard[boardY][boardX] = player.key;
                      }
                  }
              });
          });

          const [sweptBoard, clearedRowCount] = sweepRows(newBoard);
          if (clearedRowCount > 0) {
              setLines(prev => prev + clearedRowCount);
              setScore(prev => prev + clearedRowCount * 10);
          }
          setBoard(sweptBoard);
          
          const newPlayer = resetPlayer();
          if (checkCollision(newPlayer, sweptBoard, {})) {
            setIsGameOver(true);
            setDropTime(null);
          } else {
            setPlayer(newPlayer);
          }
      }
    }, [player, board, resetPlayer, checkCollision]);

    useEffect(() => {
        if (!gameStarted) return;
        const newLevel = Math.floor(score / 200);
        if (newLevel > level) {
            setLevel(newLevel);
        }
    }, [score, level, gameStarted]);

    useEffect(() => {
        if (!gameStarted) return;
        setDropTime(Math.max(100, 1000 - level * 200));
    }, [level, gameStarted]);
    
    useEffect(() => {
        if (isGameOver) {
            gameOverSoundRef.current?.play().catch(e => console.error("Audio play failed:", e));
            if (score > highScore) {
                setHighScore(score);
                localStorage.setItem('tetrisHighScore', String(score));
            }
        }
    }, [isGameOver, score, highScore]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
      if (isGameOver) return;
      const key = event.key.toLowerCase();
      if (key === 'p') {
          setIsPaused(prev => !prev);
          return;
      }
      if (isPaused) return;

      switch (key) {
        case 'arrowleft': movePlayer(-1); break;
        case 'arrowright': movePlayer(1); break;
        case 'arrowdown': drop(); break;
        case 'd': rotatePlayerRight(); break;
        case 'a': rotatePlayerLeft(); break;
        case 'c': mirrorPlayer(); break;
        case ' ': hardDrop(); break;
      }
    }, [isGameOver, isPaused, movePlayer, drop, rotatePlayerRight, rotatePlayerLeft, mirrorPlayer, hardDrop]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
    
    useEffect(() => {
        if (!gameStarted || isPaused || isGameOver || dropTime === null) return;
        const interval = setInterval(() => {
            drop();
        }, dropTime);
        return () => clearInterval(interval);
    }, [drop, dropTime, isPaused, isGameOver, gameStarted]);

    const displayBoard = board.map(row => [...row]);
    if (player) {
      player.tetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const boardY = player.pos.y + y;
            const boardX = player.pos.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = player.key;
            }
          }
        });
      });
    }

    return (
        <div className="bg-gray-900 min-h-screen text-white flex flex-col justify-center items-center p-4">
            <audio ref={gameOverSoundRef} src="https://www.myinstants.com/media/sounds/game-over-arcade.mp3" />
            <main className="flex flex-col md:flex-row gap-8 w-full max-w-5xl">
                <div className="relative w-full md:w-2/3 lg:w-3/4 flex justify-center items-start">
                    <div 
                      className="grid gap-px p-2 bg-gray-900 border-4 border-gray-700 rounded-lg shadow-inner"
                      style={{ 
                        gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
                        width: 'min(80vw, 40vh)'
                      }}
                    >
                        {displayBoard.map((row, y) =>
                            row.map((cell, x) => <Cell key={`${y}-${x}`} type={cell} />)
                        )}
                    </div>
                    {!gameStarted && (
                        <Modal title="React Tetris" buttonText="Start Game" onButtonClick={startGame}>
                            <p>Are you ready?</p>
                        </Modal>
                    )}
                    {isGameOver && (
                        <Modal 
                          title="Game Over" 
                          buttonText="Play Again" 
                          onButtonClick={startGame}
                          titleClassName="font-creepster text-6xl text-red-600 tracking-wider [text-shadow:2px_2px_4px_#000]"
                        >
                            <p>Final Score: {score}</p>
                        </Modal>
                    )}
                    {isPaused && !isGameOver && (
                        <Modal title="Paused" buttonText="Resume" onButtonClick={() => setIsPaused(false)}>
                            <p>Game is paused.</p>
                        </Modal>
                    )}
                </div>
                <GameInfoPanel 
                    score={score} 
                    highScore={highScore} 
                    lines={lines} 
                    level={level} 
                    nextPiece={nextPieceKey}
                    volume={volume}
                    isMuted={isMuted}
                    onVolumeChange={handleVolumeChange}
                    onToggleMute={toggleMute}
                />
            </main>
        </div>
    );
};

export default App;
