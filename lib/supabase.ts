import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BlockedSenderRecord, UserAccountRecord } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  !supabaseUrl.includes('your-project') &&
  !supabaseKey.includes('your-')
);

let _supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_supabaseClient) {
    _supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });
  }
  return _supabaseClient;
}

// In-memory fallback store for development/demo when Supabase credentials aren't yet entered
const inMemoryBlockedSenders: Map<string, BlockedSenderRecord> = new Map([
  ['marketing@spamdaily.com', {
    id: 'mock-b-1',
    user_email: 'user@example.com',
    domain: 'spamdaily.com',
    sender_email: 'marketing@spamdaily.com',
    reason: 'Frequent promotional spam',
    auto_trash: true,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  }],
  ['deals@cheapflights-alerts.net', {
    id: 'mock-b-2',
    user_email: 'user@example.com',
    domain: 'cheapflights-alerts.net',
    sender_email: 'deals@cheapflights-alerts.net',
    reason: 'Unwanted newsletters',
    auto_trash: true,
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
  }]
]);

const inMemoryAccounts: Map<string, UserAccountRecord> = new Map();

// Helper functions for Blocked Senders
export async function getBlockedSenders(userEmail: string = 'user@example.com'): Promise<BlockedSenderRecord[]> {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('blocked_senders')
        .select('*')
        .eq('user_email', userEmail)
        .order('created_at', { ascending: false });

      if (!error && data) return data as BlockedSenderRecord[];
    } catch (err) {
      console.warn('Supabase query error, falling back to local memory store:', err);
    }
  }

  return Array.from(inMemoryBlockedSenders.values()).filter(
    (b) => b.user_email === userEmail || userEmail === 'demo@mailcleaner.app' || b.user_email === 'user@example.com'
  );
}

export async function addBlockedSender(
  userEmail: string,
  domain: string,
  senderEmail?: string,
  reason?: string,
  autoTrash: boolean = true
): Promise<BlockedSenderRecord> {
  const client = getSupabase();
  const cleanDomain = domain.toLowerCase().trim();

  if (client) {
    try {
      const { data, error } = await client
        .from('blocked_senders')
        .upsert(
          {
            user_email: userEmail,
            domain: cleanDomain,
            sender_email: senderEmail,
            reason: reason || 'Blocked via MailCleaner',
            auto_trash: autoTrash,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_email,domain' }
        )
        .select()
        .single();

      if (!error && data) return data as BlockedSenderRecord;
    } catch (err) {
      console.warn('Supabase upsert error, falling back to local store:', err);
    }
  }

  const record: BlockedSenderRecord = {
    id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_email: userEmail,
    domain: cleanDomain,
    sender_email: senderEmail,
    reason: reason || 'Blocked via MailCleaner',
    auto_trash: autoTrash,
    created_at: new Date().toISOString(),
  };
  inMemoryBlockedSenders.set(`${userEmail}:${cleanDomain}`, record);
  return record;
}

export async function removeBlockedSender(id: string): Promise<boolean> {
  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from('blocked_senders').delete().eq('id', id);
      if (!error) return true;
    } catch (err) {
      console.warn('Supabase delete error:', err);
    }
  }

  for (const [key, val] of inMemoryBlockedSenders.entries()) {
    if (val.id === id) {
      inMemoryBlockedSenders.delete(key);
      return true;
    }
  }
  return true;
}

// Helper functions for User Discovered Accounts (OSINT)
export async function getUserAccounts(userEmail: string = 'user@example.com'): Promise<UserAccountRecord[]> {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('user_accounts')
        .select('*')
        .eq('user_email', userEmail)
        .order('created_at', { ascending: false });

      if (!error && data) return data as UserAccountRecord[];
    } catch (err) {
      console.warn('Supabase query error, falling back to local memory store:', err);
    }
  }

  return Array.from(inMemoryAccounts.values()).filter(
    (a) => a.user_email === userEmail || userEmail === 'demo@mailcleaner.app' || a.user_email === 'user@example.com'
  );
}

export async function saveUserAccountsBatch(
  accounts: Omit<UserAccountRecord, 'id' | 'created_at'>[]
): Promise<UserAccountRecord[]> {
  const client = getSupabase();
  const saved: UserAccountRecord[] = [];

  if (client && accounts.length > 0) {
    try {
      const payload = accounts.map((acc) => ({
        user_email: acc.user_email,
        domain: acc.domain.toLowerCase().trim(),
        username: acc.username || null,
        source: acc.source,
        delete_url: acc.delete_url || null,
        delete_difficulty: acc.delete_difficulty || 'unknown',
        breach_count: acc.breach_count || 0,
        status: acc.status || 'active',
        notes: acc.notes || null,
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await client
        .from('user_accounts')
        .upsert(payload, { onConflict: 'user_email,domain,username' })
        .select();

      if (!error && data) return data as UserAccountRecord[];
    } catch (err) {
      console.warn('Supabase accounts upsert error, falling back to local store:', err);
    }
  }

  for (const acc of accounts) {
    const key = `${acc.user_email}:${acc.domain}:${acc.username || ''}`;
    const record: UserAccountRecord = {
      ...acc,
      id: `local-acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
    };
    inMemoryAccounts.set(key, record);
    saved.push(record);
  }

  return saved;
}

export async function updateUserAccountStatus(
  id: string,
  status: UserAccountRecord['status']
): Promise<boolean> {
  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client
        .from('user_accounts')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (!error) return true;
    } catch (err) {
      console.warn('Supabase account update error:', err);
    }
  }

  for (const [key, val] of inMemoryAccounts.entries()) {
    if (val.id === id) {
      inMemoryAccounts.set(key, { ...val, status });
      return true;
    }
  }
  return true;
}
