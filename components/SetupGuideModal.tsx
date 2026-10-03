'use client';

import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Database,
  KeyRound,
  FileCode,
  Sparkles,
} from 'lucide-react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  oauthConfigured: boolean;
  dbConfigured: boolean;
  hibpConfigured: boolean;
}

export function SetupGuideModal({
  isOpen,
  onClose,
  oauthConfigured,
  dbConfigured,
  hibpConfigured,
}: SetupGuideModalProps) {
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  if (!isOpen) return null;

  const sqlSchema = `-- Run this in your Supabase SQL Editor:
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_senders_user_domain ON public.blocked_senders (user_email, domain);

CREATE TABLE IF NOT EXISTS public.user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    domain TEXT NOT NULL,
    username TEXT,
    source TEXT NOT NULL DEFAULT 'chrome_csv',
    delete_url TEXT,
    delete_difficulty TEXT DEFAULT 'unknown',
    breach_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_accounts_user_domain_user ON public.user_accounts (user_email, domain, COALESCE(username, ''));

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

ALTER TABLE public.blocked_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on blocked_senders for all" ON public.blocked_senders FOR SELECT USING (true);
CREATE POLICY "Allow insert on blocked_senders for all" ON public.blocked_senders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on blocked_senders for all" ON public.blocked_senders FOR UPDATE USING (true);
CREATE POLICY "Allow delete on blocked_senders for all" ON public.blocked_senders FOR DELETE USING (true);
CREATE POLICY "Allow select on user_accounts for all" ON public.user_accounts FOR SELECT USING (true);
CREATE POLICY "Allow insert on user_accounts for all" ON public.user_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on user_accounts for all" ON public.user_accounts FOR UPDATE USING (true);
CREATE POLICY "Allow delete on user_accounts for all" ON public.user_accounts FOR DELETE USING (true);
CREATE POLICY "Allow access on oauth_tokens for all" ON public.oauth_tokens FOR ALL USING (true);`;

  const envTemplate = `# Environment Variables (.env.local)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback/google"

NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

HIBP_API_KEY="" # Optional: obtain from https://haveibeenpwned.com/API/Key
SESSION_SECRET="super-secret-key-at-least-32-characters"`;

  const copyToClipboard = (text: string, type: 'sql' | 'env') => {
    navigator.clipboard.writeText(text);
    if (type === 'sql') {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } else {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-700 bg-[#0d1322] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Integration & Setup Guide</h2>
              <p className="text-xs text-slate-400">
                Connect your real Google Cloud, Supabase, and Have I Been Pwned keys
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Current Connection Status Checklist */}
        <div className="my-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className={`rounded-2xl border p-3.5 ${
              oauthConfigured
                ? 'border-emerald-500/30 bg-emerald-950/20'
                : 'border-amber-500/30 bg-amber-950/20'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">Google OAuth</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  oauthConfigured
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {oauthConfigured ? 'Connected' : 'Demo Active'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {oauthConfigured
                ? 'Valid client credentials detected in .env.local.'
                : 'Add GOOGLE_CLIENT_ID to .env.local for live Gmail sync.'}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-3.5 ${
              dbConfigured
                ? 'border-emerald-500/30 bg-emerald-950/20'
                : 'border-indigo-500/30 bg-indigo-950/20'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">Supabase DB</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  dbConfigured
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-indigo-500/20 text-indigo-300'
                }`}
              >
                {dbConfigured ? 'Connected' : 'Local Fallback'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {dbConfigured
                ? 'PostgreSQL tables and rules active.'
                : 'Local memory store active. Add Supabase keys to persist.'}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-3.5 ${
              hibpConfigured
                ? 'border-emerald-500/30 bg-emerald-950/20'
                : 'border-slate-700 bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">HIBP Breach Scanner</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  hibpConfigured
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {hibpConfigured ? 'Live API Key' : 'Catalog Mode'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {hibpConfigured
                ? 'Live breach queries verified.'
                : 'Using verified historical breach catalog.'}
            </p>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-6 text-xs text-slate-300">
          {/* Step 1: Google Cloud Console */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                1
              </span>
              <span>Google Cloud OAuth 2.0 Credentials</span>
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pl-1">
              <li>
                Visit the{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 underline inline-flex items-center gap-1"
                >
                  Google Cloud Console <ExternalLink className="h-3 w-3 inline" />
                </a>{' '}
                and create a project.
              </li>
              <li>
                Enable the <strong className="text-white">Gmail API</strong> under "APIs & Services" -&gt; "Library".
              </li>
              <li>
                Create an <strong className="text-white">OAuth 2.0 Client ID</strong> (Application type: "Web application").
              </li>
              <li>
                Add Authorized Redirect URI:{' '}
                <code className="text-indigo-300 font-mono bg-slate-800 px-1 py-0.5 rounded">
                  http://localhost:3000/api/auth/callback/google
                </code>
              </li>
              <li>Copy Client ID & Client Secret into <code className="text-indigo-300 font-mono">.env.local</code>.</li>
            </ol>
          </div>

          {/* Step 2: Supabase Schema */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                  2
                </span>
                <span>Supabase PostgreSQL Schema</span>
              </h3>
              <button
                onClick={() => copyToClipboard(sqlSchema, 'sql')}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white transition"
              >
                {copiedSql ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied SQL</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy SQL Schema</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-slate-400 mb-2">
              Create a free Supabase project, open the{' '}
              <strong className="text-white">SQL Editor</strong>, paste this schema, and click Run.
            </p>
            <pre className="max-h-36 overflow-y-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-400 border border-slate-800">
              {sqlSchema}
            </pre>
          </div>

          {/* Step 3: .env.local configuration template */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                  3
                </span>
                <span>Environment Template (.env.local)</span>
              </h3>
              <button
                onClick={() => copyToClipboard(envTemplate, 'env')}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white transition"
              >
                {copiedEnv ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied .env</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy .env Template</span>
                  </>
                )}
              </button>
            </div>
            <pre className="max-h-36 overflow-y-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-400 border border-slate-800">
              {envTemplate}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
