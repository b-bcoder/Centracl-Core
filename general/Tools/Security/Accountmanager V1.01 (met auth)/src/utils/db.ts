import { get, set, del } from 'idb-keyval';

export const db = {
  saveData: async (data: string) => {
    await set('vault_data', data);
  },
  loadData: async (): Promise<string | null> => {
    const data = await get('vault_data');
    return data || null;
  },
  deleteData: async () => {
    await del('vault_data');
    await del('app_identity');
  },
  saveIdentity: async (identity: string) => {
    await set('app_identity', identity);
  },
  getIdentity: async (): Promise<string | null> => {
    const data = await get<string>('app_identity');
    return data || null;
  }
};
