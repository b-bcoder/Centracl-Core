
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface ScenarioRule {
  id: string;
  type: 'saving' | 'habit';
  label: string;
  value: number;
  unit: string;
  days: WeekDay[];
}

export interface CalculationResult {
  totalDays: number;
  years: number;
  months: number;
  weeks: number;
  remainingDays: number;
  weekdays: number;
  workdays: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface SimulationStep {
  date: string;
  totalValue: number;
  increment: number;
}
