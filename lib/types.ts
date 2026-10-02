export interface EmailMetadata {
  id: string;
  threadId: string;
  from: string;
  senderName: string;
  senderEmail: string;
  senderDomain: string;
  to: string;
  subject: string;
  date: string; // ISO string
  internalDate: number; // Unix timestamp ms
  ageDays: number;
  sizeBytes: number;
  sizeFormatted: string;
  isHeavy5MB: boolean;
  isHeavy10MB: boolean;
  isMassNotification: boolean;
  isAncient1Year: boolean;
  isAncient2Years: boolean;
  hasUnsubscribe: boolean;
  unsubscribeOptions?: UnsubscribeOptions;
  snippet?: string;
  labels?: string[];
}

export interface UnsubscribeOptions {
  httpUrl?: string;
  mailto?: {
    address: string;
    subject: string;
    body?: string;
  };
  hasOneClickPost?: boolean; // RFC 8058 List-Unsubscribe-Post: List-Unsubscribe=One-Click
  rawHeader?: string;
}

export interface BlockedSenderRecord {
  id: string;
  user_email: string;
  domain: string;
  sender_email?: string;
  reason?: string;
  auto_trash: boolean;
  created_at: string;
  updated_at?: string;
}

export type DeleteDifficulty = 'easy' | 'medium' | 'hard' | 'impossible' | 'unknown';

export interface UserAccountRecord {
  id: string;
  user_email: string;
  domain: string;
  username?: string;
  source: 'chrome_csv' | 'hibp' | 'gmail_audit' | 'manual';
  delete_url?: string;
  delete_difficulty: DeleteDifficulty;
  breach_count: number;
  status: 'active' | 'pending_deletion' | 'deleted' | 'kept';
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface JustDeleteDirectoryItem {
  name: string;
  url: string;
  difficulty: DeleteDifficulty;
  notes?: string;
  domains: string[];
}

export interface HIBPBreach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  ModifiedDate: string;
  PwnCount: number;
  Description: string;
  LogoPath: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsRetired: boolean;
  IsSpamList: boolean;
}

export interface ChromePasswordEntry {
  name: string;
  url: string;
  username: string;
  domain: string;
}

export interface AuthSession {
  isAuthenticated: boolean;
  isDemoMode: boolean;
  userEmail?: string;
  userName?: string;
  userPicture?: string;
  expiresAt?: number;
}
