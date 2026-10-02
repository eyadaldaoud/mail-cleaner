import Papa from 'papaparse';
import { extractRootDomain, lookupJustDeleteInfo } from './justdelete';
import { UserAccountRecord } from '../types';

export interface RawChromePasswordRow {
  name?: string;
  url?: string;
  username?: string;
  password?: string;
  note?: string;
  [key: string]: string | undefined;
}

export interface ParsedChromeAccount {
  name: string;
  url: string;
  domain: string;
  username: string;
  deleteUrl?: string;
  deleteDifficulty: 'easy' | 'medium' | 'hard' | 'impossible' | 'unknown';
  deleteNotes?: string;
  hasDeleteLink: boolean;
}

export function parseChromePasswordsCsv(csvContent: string): {
  accounts: ParsedChromeAccount[];
  totalRows: number;
  uniqueDomainsCount: number;
  easyDeletesCount: number;
} {
  const parsed = Papa.parse<RawChromePasswordRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const domainMap = new Map<string, ParsedChromeAccount>();

  for (const row of parsed.data) {
    const rawUrl = row.url || '';
    const rawName = row.name || '';
    const username = row.username || '';

    // Ignore android/app protocol prefixes if present, or extract domain
    const domain = extractRootDomain(rawUrl || rawName);
    if (!domain || domain === 'unknown' || domain.length < 3) {
      continue;
    }

    const justDelete = lookupJustDeleteInfo(domain);

    const account: ParsedChromeAccount = {
      name: rawName || domain,
      url: rawUrl,
      domain,
      username,
      deleteUrl: justDelete.deleteUrl,
      deleteDifficulty: justDelete.difficulty,
      deleteNotes: justDelete.notes,
      hasDeleteLink: justDelete.matchFound,
    };

    // Keep unique by domain + username combination
    const key = `${domain}:${username}`;
    if (!domainMap.has(key)) {
      domainMap.set(key, account);
    }
  }

  const accounts = Array.from(domainMap.values());
  const uniqueDomains = new Set(accounts.map((a) => a.domain));
  const easyDeletesCount = accounts.filter(
    (a) => a.deleteDifficulty === 'easy' || a.deleteDifficulty === 'medium'
  ).length;

  return {
    accounts,
    totalRows: parsed.data.length,
    uniqueDomainsCount: uniqueDomains.size,
    easyDeletesCount,
  };
}

export function convertParsedToUserAccountRecords(
  parsedAccounts: ParsedChromeAccount[],
  userEmail: string,
  breachedDomains: Set<string> = new Set()
): Omit<UserAccountRecord, 'id' | 'created_at'>[] {
  return parsedAccounts.map((item) => ({
    user_email: userEmail,
    domain: item.domain,
    username: item.username,
    source: 'chrome_csv',
    delete_url: item.deleteUrl,
    delete_difficulty: item.deleteDifficulty,
    breach_count: breachedDomains.has(item.domain) ? 1 : 0,
    status: 'active',
    notes: item.deleteNotes,
  }));
}
