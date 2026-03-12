import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  lastLogin: Timestamp;
}

export interface ReadProgress {
  configId: string;
  lastSeenVersionId: string | null;
  lastSeenAt: Timestamp;
  viewedReports: string[];
}
