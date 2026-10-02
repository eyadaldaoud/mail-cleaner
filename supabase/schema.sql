-- ==============================================================================
-- PERSONAL EMAIL CLEANING & OSINT DASHBOARD: SUPABASE SCHEMA
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- to initialize the necessary tables, indexes, and Row Level Security (RLS) policies.
-- ==============================================================================

-- 1. BLOCKED SENDERS TABLE
-- Stores blocked email addresses and domains with auto-trash rules.
CREATE TABLE IF NOT EXISTS public.blocked_senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    domain TEXT NOT NULL,
    sender_email TEXT,
    reason TEXT DEFAULT 'Unsubscribed / Blocked via MailCleaner',
    auto_trash BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Unique index to prevent duplicate domain blocks per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_senders_user_domain 
    ON public.blocked_senders (user_email, domain);

CREATE INDEX IF NOT EXISTS idx_blocked_senders_domain 
    ON public.blocked_senders (domain);


-- 2. USER DISCOVERED ACCOUNTS (OSINT & DIGITAL FOOTPRINT)
-- Stores discovered online accounts (from Chrome password CSV export, HIBP, or Gmail analysis)
-- cross-referenced with JustDelete.me deletion links and difficulty ratings.
CREATE TABLE IF NOT EXISTS public.user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    domain TEXT NOT NULL,
    username TEXT,
    source TEXT NOT NULL DEFAULT 'chrome_csv', -- 'chrome_csv', 'hibp', 'gmail_audit', 'manual'
    delete_url TEXT,
    delete_difficulty TEXT DEFAULT 'unknown', -- 'easy', 'medium', 'hard', 'impossible', 'unknown'
    breach_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'pending_deletion', 'deleted', 'kept'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Unique index to prevent duplicate domain/username account pairs per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_accounts_user_domain_user 
    ON public.user_accounts (user_email, domain, COALESCE(username, ''));

CREATE INDEX IF NOT EXISTS idx_user_accounts_status 
    ON public.user_accounts (status);


-- 3. GOOGLE OAUTH TOKENS (OPTIONAL SECURE TOKEN STORE)
-- Enables persistent multi-device OAuth token storage for the personal dashboard.
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date BIGINT,
    scope TEXT,
    token_type TEXT DEFAULT 'Bearer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);


-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS for all tables
ALTER TABLE public.blocked_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Allow read/write access for authenticated users or service role
-- Note: When accessed via Next.js server-side Supabase client with SERVICE_ROLE_KEY or user session
CREATE POLICY "Allow select on blocked_senders for all" 
    ON public.blocked_senders FOR SELECT USING (true);

CREATE POLICY "Allow insert on blocked_senders for all" 
    ON public.blocked_senders FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on blocked_senders for all" 
    ON public.blocked_senders FOR UPDATE USING (true);

CREATE POLICY "Allow delete on blocked_senders for all" 
    ON public.blocked_senders FOR DELETE USING (true);

CREATE POLICY "Allow select on user_accounts for all" 
    ON public.user_accounts FOR SELECT USING (true);

CREATE POLICY "Allow insert on user_accounts for all" 
    ON public.user_accounts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on user_accounts for all" 
    ON public.user_accounts FOR UPDATE USING (true);

CREATE POLICY "Allow delete on user_accounts for all" 
    ON public.user_accounts FOR DELETE USING (true);

CREATE POLICY "Allow access on oauth_tokens for all" 
    ON public.oauth_tokens FOR ALL USING (true);
