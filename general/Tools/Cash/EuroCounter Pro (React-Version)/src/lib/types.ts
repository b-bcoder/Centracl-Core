export type DenominationType = 'coin' | 'bill';

export interface Denomination {
  id: string;
  value: number; // In Euros
  label: string;
  type: DenominationType;
  color: string;
}

export interface CountState {
  [id: string]: number;
}

export interface CalculationResult {
  total: number;
  breakdown: {
    coins: number;
    bills: number;
  };
}
