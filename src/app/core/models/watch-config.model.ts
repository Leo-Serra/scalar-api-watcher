import { Timestamp } from 'firebase/firestore';

export interface WatchConfig {
  id?: string;
  specUrl: string;
  cronSchedule: string;
  extraHeaders: Record<string, string>;
  maxHistory: number;
  createdBy: string;
  createdAt: Timestamp;
}
