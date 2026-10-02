'use client';

import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Search,
  CheckSquare,
  Square,
  HardDrive,
  BellRing,
  History,
  ShieldCheck,
  Ban,
  ArrowUpDown,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { EmailMetadata, BlockedSenderRecord } from '@/lib/types';
import { formatBytes } from '@/lib/gmail/parser';

interface InboxCleanerTabProps {
  emails: EmailMetadata[];
  blockedSenders: BlockedSenderRecord[];
  onBatchTrash: (ids: string[]) => Promise<void>;
  onUnsubscribe: (email: EmailMetadata) => Promise<any>;
  onBlockSender: (domain: string, senderEmail?: string) => Promise<void>;
  isProcessing: boolean;
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  nextPageToken?: string;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  fetchLimit?: number;
  onFetchLimitChange?: (limit: number) => void;
}

export function InboxCleanerTab({
  emails,
  blockedSenders,
  onBatchTrash,
  onUnsubscribe,
  onBlockSender,
  isProcessing,
  activeFilter,
  setActiveFilter,
  nextPageToken,
  onLoadMore,
  isLoadingMore,
  fetchLimit = 100,
  onFetchLimitChange,
}: InboxCleanerTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [heavyFilterSize, setHeavyFilterSize] = useState<'5mb' | '10mb'>('5mb');
  const [ancientFilterYears, setAncientFilterYears] = useState<'1yr' | '2yrs'>('1yr');
  const [sortField, setSortField] = useState<'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Set of blocked domains for fast lookup
  const blockedDomainSet = useMemo(() => {
    return new Set(blockedSenders.map((b) => b.domain.toLowerCase()));
  }, [blockedSenders]);

  // Filtered emails based on active filter, search query, and sub-toggles
  const filteredEmails = useMemo(() => {
    return emails.filter((item) => {
      // 1. Text Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSubject = item.subject.toLowerCase().includes(q);
        const matchesSender = item.senderName.toLowerCase().includes(q) || item.senderEmail.toLowerCase().includes(q);
        const matchesDomain = item.senderDomain.toLowerCase().includes(q);
        if (!matchesSubject && !matchesSender && !matchesDomain) {
          return false;
        }
      }

      // 2. Category Filter
      if (activeFilter === 'heavy_5mb' || activeFilter === 'heavy') {
        return heavyFilterSize === '10mb' ? item.isHeavy10MB : item.isHeavy5MB;
      }
      if (activeFilter === 'mass_notifications') {
        return item.isMassNotification;
      }
      if (activeFilter === 'ancient_1yr' || activeFilter === 'ancient') {
        return ancientFilterYears === '2yrs' ? item.isAncient2Years : item.isAncient1Year;
      }
      if (activeFilter === 'unsubscribable') {
        return item.hasUnsubscribe;
      }
      if (activeFilter === 'blocked') {
        return blockedDomainSet.has(item.senderDomain.toLowerCase());
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'size') {
        return sortOrder === 'desc' ? b.sizeBytes - a.sizeBytes : a.sizeBytes - b.sizeBytes;
      }
      // default: date
      return sortOrder === 'desc' ? b.internalDate - a.internalDate : a.internalDate - b.internalDate;
    });
  }, [
    emails,
    searchQuery,
    activeFilter,
    heavyFilterSize,
    ancientFilterYears,
    blockedDomainSet,
    sortField,
    sortOrder,
  ]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAllVisible = () => {
    if (selectedIds.size === filteredEmails.length && filteredEmails.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmails.map((e) => e.id)));
    }
  };

  const handleSelectOnlyMass = () => {
    const ids = filteredEmails.filter((e) => e.isMassNotification).map((e) => e.id);
    setSelectedIds(new Set(ids));
  };

  const handleSelectOnlyHeavy = () => {
    const ids = filteredEmails.filter((e) => e.isHeavy5MB).map((e) => e.id);
    setSelectedIds(new Set(ids));
  };

  const handleSelectOnlyAncient = () => {
    const ids = filteredEmails.filter((e) => e.isAncient1Year).map((e) => e.id);
    setSelectedIds(new Set(ids));
  };

  // Selected totals
  const selectedEmails = useMemo(() => {
    return emails.filter((e) => selectedIds.has(e.id));
  }, [emails, selectedIds]);

  const selectedSizeBytes = selectedEmails.reduce((acc, e) => acc + e.sizeBytes, 0);
  const selectedSizeFormatted = formatBytes(selectedSizeBytes);

  const executeBatchTrash = async () => {
    if (selectedIds.size === 0) return;
    await onBatchTrash(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowConfirmModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar: Filters & Sub-toggles */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All ({emails.length})
            </button>

            <button
              onClick={() => setActiveFilter('heavy')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeFilter === 'heavy' || activeFilter === 'heavy_5mb'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <HardDrive className="h-3.5 w-3.5 text-amber-400" />
              Heavy Files
            </button>

            <button
              onClick={() => setActiveFilter('mass_notifications')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeFilter === 'mass_notifications'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <BellRing className="h-3.5 w-3.5 text-purple-400" />
              Mass Notifications
            </button>

            <button
              onClick={() => setActiveFilter('ancient')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeFilter === 'ancient' || activeFilter === 'ancient_1yr'
                  ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <History className="h-3.5 w-3.5 text-cyan-400" />
              Ancient History
            </button>

            <button
              onClick={() => setActiveFilter('blocked')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeFilter === 'blocked'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Ban className="h-3.5 w-3.5 text-rose-400" />
              Blocked ({emails.filter((e) => blockedDomainSet.has(e.senderDomain.toLowerCase())).length})
            </button>
          </div>

          {/* Sub-threshold selectors */}
          <div className="flex items-center gap-2">
            {(activeFilter === 'heavy' || activeFilter === 'heavy_5mb') && (
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-0.5 text-xs font-medium text-slate-300">
                <button
                  onClick={() => setHeavyFilterSize('5mb')}
                  className={`rounded-md px-2 py-1 ${
                    heavyFilterSize === '5mb' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  &gt; 5 MB
                </button>
                <button
                  onClick={() => setHeavyFilterSize('10mb')}
                  className={`rounded-md px-2 py-1 ${
                    heavyFilterSize === '10mb' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  &gt; 10 MB
                </button>
              </div>
            )}

            {(activeFilter === 'ancient' || activeFilter === 'ancient_1yr') && (
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-0.5 text-xs font-medium text-slate-300">
                <button
                  onClick={() => setAncientFilterYears('1yr')}
                  className={`rounded-md px-2 py-1 ${
                    ancientFilterYears === '1yr' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  &gt; 1 Year
                </button>
                <button
                  onClick={() => setAncientFilterYears('2yrs')}
                  className={`rounded-md px-2 py-1 ${
                    ancientFilterYears === '2yrs' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  &gt; 2 Years
                </button>
              </div>
            )}

            {/* Scan Depth Selector */}
            {onFetchLimitChange && (
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-0.5 text-xs font-medium text-slate-300">
                <span className="px-2 text-slate-400 text-[10px] uppercase font-bold">Scan:</span>
                {[100, 250, 500].map((limit) => (
                  <button
                    key={limit}
                    onClick={() => onFetchLimitChange(limit)}
                    disabled={isProcessing}
                    className={`rounded-md px-2 py-0.5 font-bold transition ${
                      fetchLimit === limit ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {limit}
                  </button>
                ))}
              </div>
            )}

            {/* Sort Toggle */}
            <button
              onClick={() => {
                if (sortField === 'date') {
                  setSortField('size');
                  setSortOrder('desc');
                } else {
                  setSortField('date');
                  setSortOrder('desc');
                }
              }}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
              title="Toggle Sort by Date or Size"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <span>Sort: {sortField === 'size' ? 'Size' : 'Date'}</span>
            </button>
          </div>
        </div>

        {/* Search bar and Quick Selectors */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sender, domain, or subject keywords..."
              className="w-full rounded-xl border border-slate-700/80 bg-slate-800/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Quick Preset Selector Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            <span>Select:</span>
            <button
              onClick={handleSelectAllVisible}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              {selectedIds.size === filteredEmails.length && filteredEmails.length > 0
                ? 'Deselect All'
                : 'All Visible'}
            </button>
            <button
              onClick={handleSelectOnlyMass}
              className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-purple-300 hover:bg-purple-500/20"
            >
              All Notifications
            </button>
            <button
              onClick={handleSelectOnlyHeavy}
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-300 hover:bg-amber-500/20"
            >
              All Heavy (&gt;5MB)
            </button>
            <button
              onClick={handleSelectOnlyAncient}
              className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-300 hover:bg-cyan-500/20"
            >
              All Ancient (&gt;1yr)
            </button>
          </div>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-20 z-30 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/70 p-3 backdrop-blur-md shadow-xl shadow-rose-950/40 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-rose-400" />
            <span className="text-xs font-semibold text-rose-200">
              {selectedIds.size} email{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <span className="rounded-full bg-rose-900/60 px-2 py-0.5 text-[11px] font-mono text-rose-300">
              ~{selectedSizeFormatted}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
            >
              Clear
            </button>
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={isProcessing}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1 text-xs font-bold text-white shadow-md shadow-rose-600/30 hover:bg-rose-500 disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span>Trash {selectedIds.size} Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Email List Items */}
      <div className="space-y-2">
        {filteredEmails.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-white">No matching emails found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Your inbox is clean according to this filter, or try adjusting your search keywords.
            </p>
          </div>
        ) : (
          filteredEmails.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isBlocked = blockedDomainSet.has(item.senderDomain.toLowerCase());

            return (
              <div
                key={item.id}
                className={`group flex items-start sm:items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                  isSelected
                    ? 'border-indigo-500/60 bg-indigo-950/20 shadow-sm shadow-indigo-500/10'
                    : isBlocked
                    ? 'border-rose-900/40 bg-rose-950/10'
                    : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-800/50 hover:border-slate-700'
                }`}
              >
                {/* Left: Checkbox + Sender Avatar + Metadata */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  {/* Select Checkbox */}
                  <button
                    onClick={() => handleToggleSelect(item.id)}
                    className="mt-1 sm:mt-0 text-slate-400 hover:text-white transition"
                    title={isSelected ? 'Deselect' : 'Select'}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-indigo-400" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-600 hover:text-slate-400" />
                    )}
                  </button>

                  {/* Sender Avatar Initials */}
                  <div
                    className={`hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm ${
                      item.isHeavy5MB
                        ? 'bg-amber-600/80'
                        : item.isMassNotification
                        ? 'bg-purple-600/80'
                        : isBlocked
                        ? 'bg-rose-700/80'
                        : 'bg-indigo-600/80'
                    }`}
                  >
                    {item.senderName.slice(0, 1).toUpperCase() || 'M'}
                  </div>

                  {/* Content snippet */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-bold text-slate-200 truncate max-w-[200px]">
                        {item.senderName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        @{item.senderDomain}
                      </span>

                      {/* Status Badges */}
                      {item.isHeavy10MB ? (
                        <span className="rounded-md border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-rose-300">
                          {item.sizeFormatted} Heavy
                        </span>
                      ) : item.isHeavy5MB ? (
                        <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-amber-300">
                          {item.sizeFormatted}
                        </span>
                      ) : null}

                      {item.isMassNotification && (
                        <span className="rounded-md border border-purple-500/30 bg-purple-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-purple-300">
                          Mass Alert
                        </span>
                      )}

                      {item.isAncient2Years ? (
                        <span className="rounded-md border border-cyan-500/30 bg-cyan-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-cyan-300">
                          &gt;2 Years Old
                        </span>
                      ) : item.isAncient1Year ? (
                        <span className="rounded-md border border-blue-500/30 bg-blue-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-blue-300">
                          &gt;1 Year Old
                        </span>
                      ) : null}

                      {isBlocked && (
                        <span className="rounded-md border border-rose-500/30 bg-rose-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-rose-400">
                          Domain Blocked
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-medium text-slate-300 truncate">
                      {item.subject}
                    </p>

                    {item.snippet && (
                      <p className="text-[11px] text-slate-500 truncate max-w-2xl mt-0.5">
                        {item.snippet}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Date + Size + Quick Actions */}
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  {/* Size + Date column */}
                  <div className="hidden sm:flex flex-col items-end gap-0.5 mr-1">
                    {/* Size badge — always shown */}
                    <div className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                      item.isHeavy10MB
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                        : item.isHeavy5MB
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                        : item.sizeBytes > 1024 * 1024
                        ? 'bg-slate-700/60 text-slate-300 border border-slate-700/40'
                        : 'bg-slate-800/50 text-slate-500 border border-slate-800'
                    }`}>
                      <HardDrive className="h-2.5 w-2.5" />
                      <span>{item.sizeFormatted}</span>
                    </div>
                    {/* Date */}
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                    </span>
                  </div>

                  {/* Unsubscribe Quick Action */}
                  {item.hasUnsubscribe && (
                    <button
                      onClick={() => onUnsubscribe(item)}
                      disabled={isProcessing}
                      title="1-Click Unsubscribe"
                      className="hidden md:flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      <span>Unsub</span>
                    </button>
                  )}

                  {/* Block Sender Quick Action */}
                  {!isBlocked && (
                    <button
                      onClick={() => onBlockSender(item.senderDomain, item.senderEmail)}
                      disabled={isProcessing}
                      title="Block sender domain"
                      className="hidden lg:flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition disabled:opacity-50"
                    >
                      <Ban className="h-3 w-3" />
                      <span>Block</span>
                    </button>
                  )}

                  {/* Single Trash Action */}
                  <button
                    onClick={() => onBatchTrash([item.id])}
                    disabled={isProcessing}
                    title="Trash this email"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination: Load Next Batch */}
      {nextPageToken && onLoadMore && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="flex items-center gap-2 rounded-2xl border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 px-6 py-2.5 text-xs font-bold text-indigo-200 shadow-lg shadow-indigo-950/40 transition disabled:opacity-50"
          >
            {isLoadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            ) : (
              <Sparkles className="h-4 w-4 text-cyan-400" />
            )}
            <span>Load Next Batch (+100 Emails)</span>
          </button>
        </div>
      )}

      {/* Confirmation Modal for Batch Trash */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Trash Selected Emails</h3>
                <p className="text-xs text-slate-400">Confirmation required</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to move{' '}
              <span className="font-bold text-white">{selectedIds.size} emails</span> (~
              <span className="font-bold text-amber-300">{selectedSizeFormatted}</span>) to the
              Gmail Trash?
            </p>

            <p className="text-[11px] text-slate-400 mt-2 bg-slate-800/60 p-2.5 rounded-lg border border-slate-800">
              Note: Messages will be moved to your Gmail Trash folder immediately. You can still restore them within 30 days directly from Gmail if needed.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={executeBatchTrash}
                disabled={isProcessing}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition disabled:opacity-50"
              >
                {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm & Trash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
