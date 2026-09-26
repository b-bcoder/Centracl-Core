
import { Difficulty, Grid } from '../types';
import { DIFFICULTY_LEVELS, GRID_SIZE } from '../constants';

const shuffle = <T,>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const isValid = (grid: number[][], row: number, col: number, num: number): boolean => {
  for (let x = 0; x < GRID_SIZE; x++) {
    if (grid[row][x] === num || grid[x][col] === num) {
      return false;
    }
  }

  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[i + startRow][j + startCol] === num) {
        return false;
      }
    }
  }

  return true;
};

const solveSudoku = (grid: number[][]): boolean => {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (grid[row][col] === 0) {
        const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of numbers) {
          if (isValid(grid, row, col, num)) {
            grid[row][col] = num;
            if (solveSudoku(grid)) {
              return true;
            }
            grid[row][col] = 0; // Backtrack
          }
        }
        return false;
      }
    }
  }
  return true;
};

export const generateSudoku = (difficulty: Difficulty): { puzzle: Grid; solution: Grid } => {
  const solutionGrid: number[][] = Array(GRID_SIZE)
    .fill(0)
    .map(() => Array(GRID_SIZE).fill(0));

  solveSudoku(solutionGrid);
  
  const puzzleGrid: Grid = JSON.parse(JSON.stringify(solutionGrid));

  let attempts = DIFFICULTY_LEVELS[difficulty].emptyCells;
  while (attempts > 0) {
    const row = Math.floor(Math.random() * GRID_SIZE);
    const col = Math.floor(Math.random() * GRID_SIZE);

    if (puzzleGrid[row][col] !== null) {
      puzzleGrid[row][col] = null;
      attempts--;
    }
  }

  return { puzzle: puzzleGrid, solution: solutionGrid };
};
