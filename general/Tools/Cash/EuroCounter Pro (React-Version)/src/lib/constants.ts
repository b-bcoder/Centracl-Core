import { Denomination } from './types';

export const DENOMINATIONS: Denomination[] = [
  // Bills
  { id: '500_bill', value: 500, label: '€500', type: 'bill', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: '200_bill', value: 200, label: '€200', type: 'bill', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { id: '100_bill', value: 100, label: '€100', type: 'bill', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: '50_bill', value: 50, label: '€50', type: 'bill', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: '20_bill', value: 20, label: '€20', type: 'bill', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: '10_bill', value: 10, label: '€10', type: 'bill', color: 'bg-red-100 text-red-700 border-red-200' },
  { id: '5_bill', value: 5, label: '€5', type: 'bill', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  
  // Coins
  { id: '2_coin', value: 2, label: '€2', type: 'coin', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: '1_coin', value: 1, label: '€1', type: 'coin', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: '0.50_coin', value: 0.5, label: '50c', type: 'coin', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: '0.20_coin', value: 0.2, label: '20c', type: 'coin', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: '0.10_coin', value: 0.1, label: '10c', type: 'coin', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: '0.05_coin', value: 0.05, label: '5c', type: 'coin', color: 'bg-orange-50 text-orange-800 border-orange-100' },
  { id: '0.02_coin', value: 0.02, label: '2c', type: 'coin', color: 'bg-orange-50 text-orange-800 border-orange-100' },
  { id: '0.01_coin', value: 0.01, label: '1c', type: 'coin', color: 'bg-orange-50 text-orange-800 border-orange-100' },
];
