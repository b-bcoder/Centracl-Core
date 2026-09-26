
import { Difficulty } from './types';

export const DIFFICULTY_LEVELS: Record<Difficulty, { name: string; emptyCells: number }> = {
  [Difficulty.Beginner]: { name: "Beginner", emptyCells: 35 },
  [Difficulty.Middel]: { name: "Middel", emptyCells: 45 },
  [Difficulty.SomewhatMoeilijk]: { name: "Somewhat moeilijk", emptyCells: 52 },
  [Difficulty.Moeilijk]: { name: "Moeilijk", emptyCells: 56 },
  [Difficulty.Hardcore]: { name: "Hardcore", emptyCells: 60 },
  [Difficulty.HardcorePlusPlus]: { name: "Hardcore++", emptyCells: 64 }, // Very hard, might not always be uniquely solvable
};

export const GRID_SIZE = 9;
export const BOX_SIZE = 3;
export const MAX_MISTAKES = 3;
