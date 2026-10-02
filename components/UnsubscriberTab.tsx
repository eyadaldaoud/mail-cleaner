'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ExternalLink,
  Mail,
  Ban,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { EmailMetadata, BlockedSenderRecord } from '@/lib/types';

interface UnsubscriberTabProps {
  emails: EmailMetadata[];
  blockedSenders: BlockedSenderRecord[];
  onUnsubscribe: (email: EmailMetadata) => Promise<{ success: boolean; message: string }>;
  onBlockSender: (domain: string, senderEmail?: string) => Promise<void>;
  onBatchTrash: (ids: string[]) => Promise<void>;
}

export function UnsubscriberTab({
  emails,
  blockedSenders,
  onUnsubscribe,
  onBlockSender,
  onBatchTrash,
}: UnsubscriberTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [unsubscribedDomains, setUnsubscribedDomains] = useState<Map<string, string>>(new Map());
  const [processingDomain, setProcessingDomain] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ domain: string; text: string; isError?: boolean } | null>(null);

  const blockedDomainSet = useMemo(() => {
    return new Set(blockedSenders.map((b) => b.domain.toLowerCase()));
  }, [blockedSenders]);

  // Group emails by sender domain
  const subscriptionGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        domain: string;
        senderName: string;
        senderEmail: string;
        emails: EmailMetadata[];
        sampleEmail: EmailMetadata;
        hasUnsubscribeHeader: boolean;
        hasOneClickPost: boolean;
        hasMailto: boolean;
        hasHttpUrl: boolean;
        totalBytes: number;
      }
    >();

    for (const email of emails) {
      const domain = email.senderDomain.toLowerCase();
      if (!map.has(domain)) {
        map.set(domain, {
          domain,
          senderName: email.senderName,
          senderEmail: email.senderEmail,
          emails: [],
          sampleEmail: email,
          hasUnsubscribeHeader: Boolean(email.hasUnsubscribe),
          hasOneClickPost: Boolean(email.unsubscribeOptions?.hasOneClickPost),
          hasMailto: Boolean(email.unsubscribeOptions?.mailto),
          hasHttpUrl: Boolean(email.unsubscribeOptions?.httpUrl),
          totalBytes: 0,
        });
      }

      const group = map.get(domain)!;
      group.emails.push(email);
      group.totalBytes += email.sizeBytes;
      if (email.hasUnsubscribe && !group.hasUnsubscribeHeader) {
        group.sampleEmail = email;
        group.hasUnsubscribeHeader = true;
        group.hasOneClickPost = Boolean(email.unsubscribeOptions?.hasOneClickPost);
        group.hasMailto = Boolean(email.unsubscribeOptions?.mailto);
        group.hasHttpUrl = Boolean(email.unsubscribeOptions?.httpUrl);
      }
    }

    let list = Array.from(map.values());

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (g) =>
          g.domain.includes(q) ||
          g.senderName.toLowerCase().includes(q) ||
          g.senderEmail.toLowerCase().includes(q)
      );
    }

    // Sort: subscriptions with unsubscribe headers first, then by email count descending
    return list.sort((a, b) => {
      if (a.hasUnsubscribeHeader !== b.hasUnsubscribeHeader) {
        return a.hasUnsubscribeHeader ? -1 : 1;
      }
      return b.emails.length - a.emails.length;
    });
  }, [emails, searchQuery]);

  const handleExecuteUnsubscribe = async (group: (typeof subscriptionGroups)[0]) => {
    setProcessingDomain(group.domain);
    setStatusMessage(null);
    try {
      const result = await onUnsubscribe(group.sampleEmail);
      if (result.success) {
        setUnsubscribedDomains((prev) => new Map(prev).set(group.domain, result.message));
        setStatusMessage({ domain: group.domain, text: result.message });
      } else {
        setStatusMessage({ domain: group.domain, text: result.message, isError: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unsubscribe request failed';
      setStatusMessage({ domain: group.domain, text: msg, isError: true });
    } finally {
      setProcessingDomain(null);
    }
  };

  const handleTrashAllFromGroup = async (group: (typeof subscriptionGroups)[0]) => {
    const ids = group.emails.map((e) => e.id);
    await onBatchTrash(ids);
  };

  return (
    <div className="space-y-4">
      {/* Overview Banner */}
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900/50 to-cyan-950/30 p-5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Automated "One-Click" Unsubscriber</h2>
              <p className="text-xs text-slate-300 max-w-xl mt-0.5">
                Inspects RFC 2369 & RFC 8058 <code className="text-cyan-400 font-mono">List-Unsubscribe</code> headers.
                Executes background server-side POST/GET or sends silent automated mailto messages directly via Gmail API.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-center flex-1 sm:flex-initial">
              <div className="text-sm font-bold text-emerald-400">
                {subscriptionGroups.filter((g) => g.hasUnsubscribeHeader).length}
              </div>
              <div className="text-[10px] text-slate-400">Unsubscribable</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-center flex-1 sm:flex-initial">
              <div className="text-sm font-bold text-rose-400">
                {blockedSenders.length}
              </div>
              <div className="text-[10px] text-slate-400">Blocked Senders</div>
            </div>
          </div>
        </div>

        {/* Global Status Message Toast */}
        {statusMessage && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs font-medium border ${
              statusMessage.isError
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {statusMessage.isError ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <span>
              <strong>{statusMessage.domain}:</strong> {statusMessage.text}
            </span>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subscriptions by domain or sender..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="text-xs text-slate-400">
          Showing <span className="font-semibold text-white">{subscriptionGroups.length}</span> sender domains
        </div>
      </div>

      {/* Subscription Groups Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {subscriptionGroups.map((group) => {
          const isUnsubscribed = unsubscribedDomains.has(group.domain);
          const isBlocked = blockedDomainSet.has(group.domain.toLowerCase());
          const isBusy = processingDomain === group.domain;

          return (
            <div
              key={group.domain}
              className={`rounded-xl border p-4 transition-all relative overflow-hidden flex flex-col justify-between ${
                isUnsubscribed
                  ? 'border-emerald-500/40 bg-emerald-950/15'
                  : isBlocked
                  ? 'border-rose-500/30 bg-rose-950/15'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div>
                {/* Header: Sender info + domain */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {group.senderName}
                    </h3>
                    <p className="text-xs text-indigo-400 font-mono truncate">
                      @{group.domain}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300">
                      {group.emails.length} email{group.emails.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Subtitle / latest email subject */}
                <p className="text-xs text-slate-400 truncate mb-3">
                  Latest: "{group.sampleEmail.subject}"
                </p>

                {/* Unsubscribe Mechanism Badge */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  {group.hasOneClickPost ? (
                    <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                      RFC 8058 One-Click POST
                    </span>
                  ) : group.hasHttpUrl ? (
                    <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                      HTTP Unsubscribe Link
                    </span>
                  ) : group.hasMailto ? (
                    <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                      Silent Gmail Mailto
                    </span>
                  ) : (
                    <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      No Unsubscribe Header
                    </span>
                  )}

                  {isBlocked && (
                    <span className="rounded-md border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                      Domain Blocked
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                {/* Trash all emails from sender */}
                <button
                  onClick={() => handleTrashAllFromGroup(group)}
                  title={`Trash all ${group.emails.length} emails from this sender`}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:text-rose-400 hover:border-rose-500/40 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Trash All ({group.emails.length})</span>
                </button>

                <div className="flex items-center gap-2">
                  {/* Unsubscribe Button */}
                  {group.hasUnsubscribeHeader ? (
                    <button
                      onClick={() => handleExecuteUnsubscribe(group)}
                      disabled={isBusy || isUnsubscribed}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                        isUnsubscribed
                          ? 'bg-emerald-600 text-white cursor-default'
                          : 'bg-emerald-600/90 text-white hover:bg-emerald-500 shadow-emerald-600/20'
                      } disabled:opacity-75`}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isUnsubscribed ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      <span>{isUnsubscribed ? 'Unsubscribed' : '1-Click Unsub'}</span>
                    </button>
                  ) : null}

                  {/* Fallback Block Sender Button */}
                  {!isBlocked ? (
                    <button
                      onClick={() => onBlockSender(group.domain, group.senderEmail)}
                      title="Block sender domain in Supabase and trash future emails"
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-rose-400 hover:border-rose-500/40 transition"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Block Sender</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-rose-400">
                      Blocked & Filtered
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
