
export enum Difficulty {
  Beginner,
  Middel,
  SomewhatMoeilijk,
  Moeilijk,
  Hardcore,
  HardcorePlusPlus,
}

export type Grid = (number | null)[][];

export type NotesGrid = Set<number>[][];

export interface CellPosition {
  row: number;
  col: number;
}

export type GameState = 'MENU' | 'PLAYING' | 'GAME_OVER' | 'WON';