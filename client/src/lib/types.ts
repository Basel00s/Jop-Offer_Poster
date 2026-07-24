export interface Account {
  _id: string;
  nickname: string;
  status: 'active' | 'cooldown' | 'checkpoint' | 'disabled';
  dailyPostCount: number;
  dailyPostCap: number;
  lastUsedAt: string | null;
  notes: string;
  hasSession: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  _id: string;
  accountId?: string;
  name: string;
  url: string;
  groupId: string;
  notes?: string;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  _id: string;
  title: string;
  description: string;
  salary?: string;
  hours?: string;
  languageRequired?: string;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  _id: string;
  name: string;
  phone: string;
  graduation: string;
  experience: string;
  language: string;
  languageLevel: string;
  nationality: string;
  position: Position | string;
  recordingUrl: string;
  status: 'submitted' | 'offer_selected' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  _id: string;
  title: string;
  description: string;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export interface PostJob {
  _id: string;
  offer: string;
  group: string;
  account: string;
  offerTitle: string | null;
  groupName: string | null;
  accountNickname: string | null;
  status: 'queued' | 'posted' | 'pending_approval' | 'failed' | 'skipped';
  resultUrl?: string;
  error?: string;
  queuedAt: string;
  postedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BulkResult {
  created: number;
  failed: number;
  failures: { input: string; reason: string }[];
}
