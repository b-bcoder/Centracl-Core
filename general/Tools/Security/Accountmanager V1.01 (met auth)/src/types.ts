export interface Account {
  id: string;
  username: string;
  password: string;
  website: string;
  url?: string;
  createdAt: number;
  isDeleted?: boolean;
  deletedAt?: number;
}

export interface Folder {
  id: string;
  name: string;
  websiteNames: string[];
}

export type AppState = 'setup' | 'login' | 'mfa' | 'dashboard' | 'mfa-setup' | 'pin-setup' | 'pin-login';
