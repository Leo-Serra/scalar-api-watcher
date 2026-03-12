import { Timestamp } from 'firebase/firestore';

export interface SpecVersion {
  id?: string;
  configId: string;
  hash: string;
  version: string;
  title: string;
  endpointCount: number;
  timestamp: Timestamp;
  specRef: string;
}
