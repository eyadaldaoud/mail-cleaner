'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Search,
  CheckCircle2,
  Trash2,
  Database,
  Lock,
  Layers,
  Sparkles,
  Info,
  Clock,
  Loader2,
} from 'lucide-react';
import { UserAccountRecord, HIBPBreach, DeleteDifficulty } from '@/lib/types';
import { parseChromePasswordsCsv } from '@/lib/osint/chrome-parser';

interface OsintTabProps {
  accounts: UserAccountRecord[];
  onSaveDiscoveredAccounts: (
    newAccounts: Partial<UserAccountRecord>[]
  ) => Promise<void>;
  onUpdateAccountStatus: (
    id: string,
    status: UserAccountRecord['status']
  ) => Promise<void>;
  userEmail?: string;
  isSaving: boolean;
}

export function OsintTab({
  accounts,
  onSaveDiscoveredAccounts,
  onUpdateAccountStatus,
  userEmail = 'user@example.com',
  isSaving,
}: OsintTabProps) {
  // HIBP State
  const [hibpQueryEmail, setHibpQueryEmail] = useState(userEmail);
  const [breaches, setBreaches] = useState<HIBPBreach[]>([]);
  const [isSearchingBreaches, setIsSearchingBreaches] = useState(false);
  const [breachStatus, setBreachStatus] = useState<string | null>(null);

  // Chrome CSV Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [csvStats, setCsvStats] = useState<{
    fileName: string;
    totalRows: number;
    uniqueDomains: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filter & Search State
  const [searchFilter, setSearchFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Trigger HIBP Check
  const handleCheckHIBP = async (emailToCheck: string = hibpQueryEmail) => {
    setIsSearchingBreaches(true);
    setBreachStatus(null);
    try {
      const res = await fetch(
        `/api/osint/hibp?email=${encodeURIComponent(emailToCheck)}`
      );
      const data = await res.json();
      setBreaches(data.breaches || []);
      setBreachStatus(data.message || `Checked breaches for ${emailToCheck}`);
    } catch {
      setBreachStatus('Failed to query Have I Been Pwned API');
    } finally {
      setIsSearchingBreaches(false);
    }
  };

  // Process Chrome Passwords CSV
  const handleProcessCsvFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a valid .csv file exported from Google Chrome.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseChromePasswordsCsv(text);

      setCsvStats({
        fileName: file.name,
        totalRows: parsed.totalRows,
        uniqueDomains: parsed.uniqueDomainsCount,
      });

      // Prepare accounts to sync with Supabase user_accounts table
      const accountsToSave: Partial<UserAccountRecord>[] = parsed.accounts.map(
        (item) => ({
          domain: item.domain,
          username: item.username,
          source: 'chrome_csv',
          delete_url: item.deleteUrl,
          delete_difficulty: item.deleteDifficulty,
          breach_count: 0,
          status: 'active',
          notes: item.deleteNotes,
        })
      );

      await onSaveDiscoveredAccounts(accountsToSave);
    } catch (err) {
      console.error('Failed to parse Chrome CSV:', err);
      alert('Error parsing CSV file. Please make sure it is a valid Chrome Passwords export.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessCsvFile(e.dataTransfer.files[0]);
    }
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesDomain = acc.domain.toLowerCase().includes(q);
        const matchesUser = (acc.username || '').toLowerCase().includes(q);
        if (!matchesDomain && !matchesUser) return false;
      }

      if (difficultyFilter !== 'all' && acc.delete_difficulty !== difficultyFilter) {
        return false;
      }

      if (statusFilter !== 'all' && acc.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [accounts, searchFilter, difficultyFilter, statusFilter]);

  const difficultyBadges: Record<
    DeleteDifficulty,
    { label: string; badgeClass: string }
  > = {
    easy: {
      label: 'Easy Deletion',
      badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    },
    medium: {
      label: 'Medium',
      badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    },
    hard: {
      label: 'Hard',
      badgeClass: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    },
    impossible: {
      label: 'Impossible',
      badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    },
    unknown: {
      label: 'Standard',
      badgeClass: 'border-slate-700 bg-slate-800 text-slate-400',
    },
  };

  return (
    <div className="space-y-6">
      {/* OSINT Header Banner */}
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-purple-950/30 via-slate-900/60 to-indigo-950/30 p-5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Digital Footprint & Account Discovery (OSINT)</h2>
              <p className="text-xs text-slate-300 max-w-xl mt-0.5">
                Audit online accounts via Google Chrome exported password archives and Have I Been Pwned breach
                intelligence. Cross-referenced with the <strong className="text-cyan-400">JustDelete.me</strong> directory
                for instant 1-click account erasure links.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-center">
              <div className="text-sm font-bold text-white">{accounts.length}</div>
              <div className="text-[10px] text-slate-400">Tracked Accounts</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-center">
              <div className="text-sm font-bold text-emerald-400">
                {accounts.filter((a) => a.delete_difficulty === 'easy').length}
              </div>
              <div className="text-[10px] text-slate-400">Easy Erasure</div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: HIBP Scanner (Left) & Chrome Passwords CSV Upload (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Module 3A: Have I Been Pwned Integration */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Have I Been Pwned Breach Scanner</h3>
              </div>
              <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                HIBP API v3
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Query the Have I Been Pwned database to identify compromised accounts, historical leaks, and exposed plaintext credentials.
            </p>

            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <input
                  type="email"
                  value={hibpQueryEmail}
                  onChange={(e) => setHibpQueryEmail(e.target.value)}
                  placeholder="Enter email to check breaches..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => handleCheckHIBP()}
                disabled={isSearchingBreaches}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition disabled:opacity-50"
              >
                {isSearchingBreaches ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                <span>Scan Email</span>
              </button>
            </div>

            {breachStatus && (
              <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-2.5 text-xs text-slate-300 flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>{breachStatus}</span>
              </div>
            )}
          </div>

          {/* Breaches List */}
          {breaches.length > 0 && (
            <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Exposed in {breaches.length} Data Breaches:
              </div>
              {breaches.map((b) => (
                <div
                  key={b.Name}
                  className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-rose-200">{b.Title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {b.BreachDate} • {(b.PwnCount / 1000000).toFixed(1)}M accounts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-2 mb-2">
                    {b.Description.replace(/<[^>]*>/g, '')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {b.DataClasses.map((item) => (
                      <span
                        key={item}
                        className="rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Module 3B: Local Password Scanner (Google Chrome Passwords CSV) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Local Password Scanner</h3>
              </div>
              <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                Chrome CSV
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Upload your exported Google Chrome <code className="text-cyan-300">passwords.csv</code> to automatically
              extract all online accounts you've ever registered.
            </p>

            {/* Zero Knowledge Privacy Notice */}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-300 mb-4">
              <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>
                <strong>100% Zero-Knowledge:</strong> Passwords are completely discarded in your browser memory and never uploaded or stored.
              </span>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-950/20'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleProcessCsvFile(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud className="h-8 w-8 text-cyan-400 mb-2" />
              <div className="text-xs font-bold text-white">
                Drop your Google Chrome passwords .csv here
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Exported from chrome://password-manager/settings
              </p>
            </div>
          </div>

          {/* CSV Scan Stats */}
          {csvStats && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-xs">
              <div>
                <span className="font-semibold text-white">{csvStats.fileName}</span>
                <p className="text-[10px] text-slate-400">
                  {csvStats.totalRows} entries parsed • {csvStats.uniqueDomains} unique domains
                </p>
              </div>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                <span>Aggregated</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Module 3C: Aggregation & JustDelete.me Directory Cross-Reference */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">
              Discovered Online Accounts ({filteredAccounts.length})
            </h3>
            <p className="text-xs text-slate-400">
              Cross-referenced with JustDelete.me directory for direct deletion links and difficulty ratings.
            </p>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter by domain or username..."
                className="rounded-lg border border-slate-700 bg-slate-800 pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="impossible">Impossible</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending_deletion">Pending Deletion</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
        </div>

        {/* Accounts Table */}
        <div className="overflow-x-auto">
          {filteredAccounts.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">
                No accounts found. Upload a Chrome passwords CSV above or run a scan to populate discovered accounts!
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/40">
                <tr>
                  <th className="py-2.5 px-3">Service / Domain</th>
                  <th className="py-2.5 px-3">Username / Identifier</th>
                  <th className="py-2.5 px-3">Erasure Difficulty</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAccounts.map((account) => {
                  const badge = difficultyBadges[account.delete_difficulty] || difficultyBadges.unknown;
                  return (
                    <tr
                      key={account.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{account.domain}</div>
                        {account.notes && (
                          <div className="text-[10px] text-slate-400 max-w-xs truncate">
                            {account.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {account.username || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badge.badgeClass}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={account.status}
                          onChange={(e) =>
                            onUpdateAccountStatus(
                              account.id,
                              e.target.value as UserAccountRecord['status']
                            )
                          }
                          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
                        >
                          <option value="active">Active</option>
                          <option value="pending_deletion">Pending Deletion</option>
                          <option value="deleted">Deleted</option>
                          <option value="kept">Retained</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {account.delete_url ? (
                          <a
                            href={account.delete_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 shadow-sm transition"
                          >
                            <span>Delete Account</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-500">No URL</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
