'use client';

import React, { useState, useMemo } from 'react';
import {
  Tag,
  Users,
  BellRing,
  Newspaper,
  Receipt,
  Code2,
  UserCheck,
  Inbox,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Search,
  Ban,
  ShieldCheck,
  Trash2,
  Loader2,
  X,
  Layers,
} from 'lucide-react';
import { EmailMetadata, BlockedSenderRecord } from '@/lib/types';
import {
  EMAIL_CATEGORIES,
  EmailCategoryId,
  classifyEmailCategory,
  aggregateSenders,
} from '@/lib/categories';
import { formatBytes } from '@/lib/gmail/parser';

interface CategoryExplorerWidgetProps {
  emails: EmailMetadata[];
  blockedSenders: BlockedSenderRecord[];
  selectedCategory: EmailCategoryId;
  onSelectCategory: (category: EmailCategoryId) => void;
  selectedSenderEmail: string | null;
  onSelectSenderEmail: (senderEmail: string | null) => void;
  onSelectAllFromSender?: (emailIds: string[]) => void;
  onBlockSender?: (domain: string, senderEmail?: string) => Promise<void>;
  onUnsubscribe?: (email: EmailMetadata) => Promise<{ success: boolean; message: string }>;
  onBatchTrash?: (ids: string[]) => Promise<void>;
  selectedEmailIds?: Set<string>;
  onBatchTrashSelected?: () => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Inbox,
  Tag,
  Users,
  BellRing,
  Newspaper,
  Receipt,
  Code2,
  UserCheck,
};

export function CategoryExplorerWidget({
  emails,
  blockedSenders,
  selectedCategory,
  onSelectCategory,
  selectedSenderEmail,
  onSelectSenderEmail,
  onSelectAllFromSender,
  onBlockSender,
  onUnsubscribe,
  onBatchTrash,
  selectedEmailIds,
  onBatchTrashSelected,
}: CategoryExplorerWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [senderSearch, setSenderSearch] = useState('');
  const [showAllSenders, setShowAllSenders] = useState(false);
  const [unsubLoading, setUnsubLoading] = useState<string | null>(null);
  const [blockLoading, setBlockLoading] = useState<string | null>(null);
  const [bulkTrashLoading, setBulkTrashLoading] = useState(false);
  const [bulkUnsubLoading, setBulkUnsubLoading] = useState(false);
  const [bulkUnsubProgress, setBulkUnsubProgress] = useState<{ done: number; total: number } | null>(null);

  // Build quick lookup: senderEmail -> emails with unsubscribe options
  const emailsBySender = useMemo(() => {
    const map = new Map<string, EmailMetadata[]>();
    for (const email of emails) {
      const key = email.senderEmail.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(email);
    }
    return map;
  }, [emails]);

  // Set of blocked domains for fast lookup
  const blockedDomainSet = useMemo(() => {
    return new Set(blockedSenders.map((b) => b.domain.toLowerCase()));
  }, [blockedSenders]);

  // Pre-classify all emails
  const classifiedEmails = useMemo(() => {
    return emails.map((email) => ({
      email,
      category: classifyEmailCategory(email),
    }));
  }, [emails]);

  // Per-category counts and size stats
  const categoryStats = useMemo(() => {
    const stats: Record<
      EmailCategoryId,
      { count: number; totalSizeBytes: number; senders: Map<string, number> }
    > = {
      all: { count: emails.length, totalSizeBytes: 0, senders: new Map() },
      promotions: { count: 0, totalSizeBytes: 0, senders: new Map() },
      social: { count: 0, totalSizeBytes: 0, senders: new Map() },
      updates: { count: 0, totalSizeBytes: 0, senders: new Map() },
      newsletters: { count: 0, totalSizeBytes: 0, senders: new Map() },
      finance: { count: 0, totalSizeBytes: 0, senders: new Map() },
      dev_work: { count: 0, totalSizeBytes: 0, senders: new Map() },
      personal: { count: 0, totalSizeBytes: 0, senders: new Map() },
    };

    for (const { email, category } of classifiedEmails) {
      const size = email.sizeBytes || 0;
      stats.all.totalSizeBytes += size;
      const senderKey = email.senderEmail || email.senderDomain;
      stats.all.senders.set(senderKey, (stats.all.senders.get(senderKey) || 0) + 1);

      if (stats[category]) {
        stats[category].count += 1;
        stats[category].totalSizeBytes += size;
        stats[category].senders.set(senderKey, (stats[category].senders.get(senderKey) || 0) + 1);
      }
    }

    return stats;
  }, [emails, classifiedEmails]);

  // Filter emails to the currently selected category for sender breakdown
  const categoryEmails = useMemo(() => {
    if (selectedCategory === 'all') return emails;
    return classifiedEmails
      .filter((item) => item.category === selectedCategory)
      .map((item) => item.email);
  }, [emails, classifiedEmails, selectedCategory]);

  // Aggregate senders within this active category
  const sendersList = useMemo(() => {
    return aggregateSenders(categoryEmails);
  }, [categoryEmails]);

  // Filtered senders based on search
  const filteredSenders = useMemo(() => {
    if (!senderSearch.trim()) return sendersList;
    const q = senderSearch.toLowerCase();
    return sendersList.filter(
      (s) =>
        s.senderName.toLowerCase().includes(q) ||
        s.senderEmail.toLowerCase().includes(q) ||
        s.senderDomain.toLowerCase().includes(q)
    );
  }, [sendersList, senderSearch]);

  const visibleSenders = showAllSenders ? filteredSenders : filteredSenders.slice(0, 8);

  const activeCategoryDef = EMAIL_CATEGORIES.find((c) => c.id === selectedCategory) || EMAIL_CATEGORIES[0];
  const activeSender = selectedSenderEmail ? sendersList.find((s) => s.senderEmail === selectedSenderEmail) : null;

  // Generate consistent vibrant color initials for avatars
  const getAvatarGradient = (str: string) => {
    const gradients = [
      'from-indigo-500 to-purple-600',
      'from-emerald-500 to-teal-600',
      'from-rose-500 to-pink-600',
      'from-amber-500 to-orange-600',
      'from-cyan-500 to-blue-600',
      'from-fuchsia-500 to-pink-600',
      'from-blue-600 to-indigo-700',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl transition-all duration-300">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 text-white shadow-sm shadow-indigo-500/20">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Category & Sender Matrix
              </span>
              <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.2 text-[10px] font-bold text-indigo-300">
                Live Filter
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Filter your inbox by intelligent categories and top high-volume senders
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {(selectedCategory !== 'all' || selectedSenderEmail) && (
            <button
              onClick={() => {
                onSelectCategory('all');
                onSelectSenderEmail(null);
              }}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
              title="Reset all category and sender filters"
            >
              <X className="h-3.5 w-3.5 text-rose-400" />
              <span>Clear Filter</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <span>{isExpanded ? 'Collapse' : 'Expand Matrix'}</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Active Filter Pill Bar + Bulk Action Bar */}
      {(selectedCategory !== 'all' || selectedSenderEmail || (selectedEmailIds && selectedEmailIds.size > 0)) && (
        <div className="border-b border-indigo-900/40 bg-indigo-950/30">
          {/* Filter pills row */}
          {(selectedCategory !== 'all' || selectedSenderEmail) && (
            <div className="flex flex-wrap items-center gap-2 px-4 pt-2.5 pb-1.5 text-xs">
              <span className="text-slate-400 font-medium">Filtering by:</span>

              {selectedCategory !== 'all' && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 px-2.5 py-0.5 font-semibold text-indigo-200">
                  <span>{activeCategoryDef.label}</span>
                  <span className="text-[10px] text-indigo-300 font-mono">
                    ({categoryEmails.length})
                  </span>
                  <button
                    onClick={() => onSelectCategory('all')}
                    className="hover:text-white ml-0.5"
                    title="Remove category filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {selectedSenderEmail && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-0.5 font-semibold text-cyan-200">
                  <span className="truncate max-w-[200px]">
                    Sender: {activeSender?.senderName || selectedSenderEmail}
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono">
                    ({activeSender?.count || 0})
                  </span>
                  <button
                    onClick={() => onSelectSenderEmail(null)}
                    className="hover:text-white ml-0.5"
                    title="Remove sender filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Bulk Action Buttons Bar */}
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2.5 pt-1">
            {/* Scope label */}
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider shrink-0">
              {selectedSenderEmail
                ? `${activeSender?.count ?? 0} emails from sender:`
                : selectedCategory !== 'all'
                ? `${categoryEmails.length} emails in category:`
                : `${selectedEmailIds?.size ?? 0} selected:`}
            </span>

            {/* Trash selected (only when something is actually selected) */}
            {selectedEmailIds && selectedEmailIds.size > 0 && onBatchTrashSelected && (
              <button
                onClick={onBatchTrashSelected}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 hover:border-rose-400/50 transition shadow-sm"
                title={`Move ${selectedEmailIds.size} selected emails to Trash`}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span>Trash {selectedEmailIds.size} selected</span>
              </button>
            )}

            {/* Trash ALL in current filter view — directly, no pre-select needed */}
            {onBatchTrash && (() => {
              // Determine which email IDs to trash: sender filter > category filter
              const targetIds = selectedSenderEmail && activeSender
                ? activeSender.emailIds
                : categoryEmails.map((e) => e.id);
              if (targetIds.length === 0) return null;
              return (
                <button
                  onClick={async () => {
                    setBulkTrashLoading(true);
                    try { await onBatchTrash(targetIds); } finally { setBulkTrashLoading(false); }
                  }}
                  disabled={bulkTrashLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-600/40 bg-rose-600/20 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-600/30 hover:border-rose-500/60 transition shadow-sm disabled:opacity-50"
                  title={`Immediately move all ${targetIds.length} emails to Trash (no pre-select needed)`}
                >
                  {bulkTrashLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    : <Trash2 className="h-3.5 w-3.5 shrink-0" />}
                  <span>
                    {bulkTrashLoading ? 'Trashing…' : `Trash all ${targetIds.length}`}
                  </span>
                </button>
              );
            })()}

            {/* Unsubscribe ALL — fires sequentially for all senders with unsub options */}
            {onUnsubscribe && (() => {
              // Collect one unsub email per sender from current view
              const targetEmails = sendersList
                .filter((s) => s.hasUnsubscribe)
                .map((s) => {
                  const senderEmails = emailsBySender.get(s.senderEmail.toLowerCase()) || [];
                  return senderEmails.find((e) => e.hasUnsubscribe && e.unsubscribeOptions);
                })
                .filter(Boolean) as EmailMetadata[];

              // Only show when scoped to category or sender
              if (targetEmails.length === 0 || selectedCategory === 'all' && !selectedSenderEmail) return null;

              return (
                <button
                  onClick={async () => {
                    setBulkUnsubLoading(true);
                    setBulkUnsubProgress({ done: 0, total: targetEmails.length });
                    try {
                      for (let i = 0; i < targetEmails.length; i++) {
                        await onUnsubscribe(targetEmails[i]);
                        setBulkUnsubProgress({ done: i + 1, total: targetEmails.length });
                      }
                    } finally {
                      setBulkUnsubLoading(false);
                      setTimeout(() => setBulkUnsubProgress(null), 2500);
                    }
                  }}
                  disabled={bulkUnsubLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-400/50 transition shadow-sm disabled:opacity-50"
                  title={`Send unsubscribe to all ${targetEmails.length} senders in this view`}
                >
                  {bulkUnsubLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    : <ShieldCheck className="h-3.5 w-3.5 shrink-0" />}
                  <span>
                    {bulkUnsubLoading && bulkUnsubProgress
                      ? `Unsubbing ${bulkUnsubProgress.done}/${bulkUnsubProgress.total}…`
                      : `Unsub all ${targetEmails.length} senders`}
                  </span>
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Main Expandable Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Categories Grid / Cards Carousel */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Select Category
              </span>
              <span className="text-[11px] text-slate-500">
                {emails.length} total messages scanned
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {EMAIL_CATEGORIES.map((cat) => {
                const IconComponent = ICON_MAP[cat.iconName] || Tag;
                const stats = categoryStats[cat.id];
                const isSelected = selectedCategory === cat.id;
                const count = stats?.count || 0;
                const sizeFormatted = formatBytes(stats?.totalSizeBytes || 0);

                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      onSelectCategory(cat.id);
                      // Reset sender filter if category changed and sender doesn't exist here
                      onSelectSenderEmail(null);
                    }}
                    className={`group relative flex flex-col text-left p-2.5 rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-400/80 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-400/50'
                        : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    {/* Glowing active indicator dot */}
                    {isSelected && (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400" />
                    )}

                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
                          isSelected
                            ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-300'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-400 group-hover:text-slate-200'
                        }`}
                      >
                        <IconComponent className="h-3.5 w-3.5" />
                      </div>
                      <span
                        className={`text-xs font-bold truncate ${
                          isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'
                        }`}
                      >
                        {cat.shortLabel}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-auto">
                      <span
                        className={`text-sm font-black tracking-tight ${
                          isSelected ? 'text-cyan-300' : 'text-slate-200'
                        }`}
                      >
                        {count.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono truncate">
                        {sizeFormatted}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Senders Drill-Down Panel */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-950/40 p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">
                  Top Senders in{' '}
                  <span className="text-indigo-400">
                    {selectedCategory === 'all' ? 'All Categories' : activeCategoryDef.label}
                  </span>
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  {sendersList.length} senders
                </span>
              </div>

              {/* Senders Search Bar */}
              <div className="relative min-w-[200px] sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={senderSearch}
                  onChange={(e) => setSenderSearch(e.target.value)}
                  placeholder="Filter senders..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                />
                {senderSearch && (
                  <button
                    onClick={() => setSenderSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Senders Cards / Pills List */}
            {sendersList.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No emails found in this category.
              </div>
            ) : filteredSenders.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No senders match &ldquo;{senderSearch}&rdquo;.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {visibleSenders.map((sender) => {
                    const isSelected = selectedSenderEmail === sender.senderEmail;
                    const isBlocked = blockedDomainSet.has(sender.senderDomain.toLowerCase());
                    const gradient = getAvatarGradient(sender.senderDomain || sender.senderEmail);

                    return (
                      <div
                        key={sender.senderEmail}
                        className={`group relative flex flex-col justify-between p-2.5 rounded-xl border transition-all duration-150 ${
                          isSelected
                            ? 'bg-indigo-950/40 border-cyan-400/80 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                            : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => {
                              onSelectSenderEmail(isSelected ? null : sender.senderEmail);
                            }}
                            className="flex items-start gap-2 text-left flex-1 min-w-0"
                            title={`Click to filter by ${sender.senderName}`}
                          >
                            {/* Avatar */}
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr ${gradient} text-[11px] font-bold text-white shadow-sm`}
                            >
                              {(sender.senderName || sender.senderEmail)
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            {/* Name & Domain */}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                                {sender.senderName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                @{sender.senderDomain}
                              </p>
                            </div>
                          </button>

                          {/* Compact filter indicator */}
                          {isSelected && (
                            <span className="shrink-0 h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                          )}
                        </div>

                        {/* Bottom action row — stats + labeled action buttons */}
                        <div className="mt-2 pt-2 border-t border-slate-800/50 space-y-1.5">
                          {/* Stats line */}
                          <button
                            onClick={() => onSelectSenderEmail(isSelected ? null : sender.senderEmail)}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300 transition w-full"
                          >
                            <span className="font-bold text-slate-200">{sender.count}</span>
                            <span>{sender.count === 1 ? 'email' : 'emails'}</span>
                            <span className="text-slate-600">·</span>
                            <span className="font-mono">{formatBytes(sender.totalSizeBytes)}</span>
                          </button>

                          {/* Labeled action buttons row */}
                          <div className="flex flex-wrap gap-1">
                            {/* Select All */}
                            {onSelectAllFromSender && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onSelectAllFromSender(sender.emailIds); }}
                                className="flex items-center gap-1 rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-400/40 transition"
                                title={`Select all ${sender.count} emails from ${sender.senderName} for bulk trash`}
                              >
                                <CheckSquare className="h-3 w-3 shrink-0" />
                                <span>Select all</span>
                              </button>
                            )}

                            {/* Combined Trash + Unsubscribe (shown when BOTH are available — the recommended one-click cleanup) */}
                            {onBatchTrash && sender.hasUnsubscribe && onUnsubscribe && (() => {
                              const senderEmails = emailsBySender.get(sender.senderEmail.toLowerCase()) || [];
                              const unsubEmail = senderEmails.find((e) => e.hasUnsubscribe && e.unsubscribeOptions);
                              if (!unsubEmail) return null;
                              const key = '__trashAndUnsub__' + sender.senderEmail;
                              const isLoading = blockLoading === key;
                              return (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setBlockLoading(key);
                                    try {
                                      // 1. Unsubscribe first
                                      await onUnsubscribe(unsubEmail);
                                      // 2. Then trash all emails from this sender
                                      await onBatchTrash(sender.emailIds);
                                    } finally {
                                      setBlockLoading(null);
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="flex items-center gap-1 rounded-md border border-violet-500/40 bg-gradient-to-r from-emerald-500/15 to-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-200 hover:from-emerald-500/25 hover:to-rose-500/25 hover:border-violet-400/60 transition disabled:opacity-40 shadow-sm"
                                  title={`Unsubscribe from ${sender.senderDomain} AND move all ${sender.count} emails to Trash`}
                                >
                                  {isLoading
                                    ? <span className="h-3 w-3 border border-violet-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                    : <span className="flex items-center gap-0.5"><ShieldCheck className="h-3 w-3 shrink-0 text-emerald-400" /><span className="text-slate-400">+</span><Trash2 className="h-3 w-3 shrink-0 text-rose-400" /></span>}
                                  <span>{isLoading ? 'Working…' : `Unsub & Trash all ${sender.count}`}</span>
                                </button>
                              );
                            })()}

                            {/* Trash only (shown when unsubscribe is NOT available) */}
                            {onBatchTrash && (!sender.hasUnsubscribe || !onUnsubscribe) && (() => {
                              const key = '__trash__' + sender.senderEmail;
                              const isLoading = blockLoading === key;
                              return (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setBlockLoading(key);
                                    try { await onBatchTrash(sender.emailIds); } finally { setBlockLoading(null); }
                                  }}
                                  disabled={isLoading}
                                  className="flex items-center gap-1 rounded-md border border-rose-600/30 bg-rose-600/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-600/25 hover:border-rose-500/50 transition disabled:opacity-40"
                                  title={`Move all ${sender.count} emails from ${sender.senderName} to Trash`}
                                >
                                  {isLoading
                                    ? <span className="h-3 w-3 border border-rose-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                    : <Trash2 className="h-3 w-3 shrink-0" />}
                                  <span>{isLoading ? 'Trashing…' : `Trash all ${sender.count}`}</span>
                                </button>
                              );
                            })()}

                            {/* Unsubscribe only (shown when trash is NOT available) */}
                            {!onBatchTrash && sender.hasUnsubscribe && onUnsubscribe && (() => {
                              const senderEmails = emailsBySender.get(sender.senderEmail.toLowerCase()) || [];
                              const unsubEmail = senderEmails.find((e) => e.hasUnsubscribe && e.unsubscribeOptions);
                              if (!unsubEmail) return null;
                              const isLoading = unsubLoading === sender.senderEmail;
                              return (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setUnsubLoading(sender.senderEmail);
                                    try { await onUnsubscribe(unsubEmail); } finally { setUnsubLoading(null); }
                                  }}
                                  disabled={isLoading}
                                  className="flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/40 transition disabled:opacity-40"
                                  title={`Send unsubscribe request to ${sender.senderDomain}`}
                                >
                                  {isLoading
                                    ? <span className="h-3 w-3 border border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                    : <ShieldCheck className="h-3 w-3 shrink-0" />}
                                  <span>{isLoading ? 'Unsubbing…' : 'Unsubscribe'}</span>
                                </button>
                              );
                            })()}

                            {/* Block domain */}
                            {onBlockSender && !isBlocked && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setBlockLoading(sender.senderEmail);
                                  try { await onBlockSender(sender.senderDomain, sender.senderEmail); } finally { setBlockLoading(null); }
                                }}
                                disabled={blockLoading === sender.senderEmail}
                                className="flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/40 transition disabled:opacity-40"
                                title={`Block all future emails from @${sender.senderDomain}`}
                              >
                                {blockLoading === sender.senderEmail
                                  ? <span className="h-3 w-3 border border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                  : <Ban className="h-3 w-3 shrink-0" />}
                                <span>{blockLoading === sender.senderEmail ? 'Blocking…' : 'Block domain'}</span>
                              </button>
                            )}

                            {/* Blocked status indicator */}
                            {isBlocked && (
                              <span className="flex items-center gap-1 rounded-md border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                                <Ban className="h-3 w-3 shrink-0" />
                                <span>Domain blocked</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Show more senders toggle */}
                {filteredSenders.length > 8 && (
                  <div className="text-center pt-1">
                    <button
                      onClick={() => setShowAllSenders(!showAllSenders)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-indigo-400 hover:bg-slate-800 hover:text-indigo-300 transition"
                    >
                      <span>
                        {showAllSenders
                          ? 'Show fewer senders'
                          : `View all ${filteredSenders.length} senders`}
                      </span>
                      {showAllSenders ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
