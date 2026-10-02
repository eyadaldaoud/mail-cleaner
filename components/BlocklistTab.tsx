'use client';

import React, { useState } from 'react';
import {
  Ban,
  Plus,
  Trash2,
  CheckCircle2,
  Database,
  Filter,
  Shield,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { BlockedSenderRecord } from '@/lib/types';

interface BlocklistTabProps {
  blockedSenders: BlockedSenderRecord[];
  onAddBlockedSender: (
    domain: string,
    senderEmail?: string,
    reason?: string,
    autoTrash?: boolean
  ) => Promise<void>;
  onRemoveBlockedSender: (id: string) => Promise<void>;
  isProcessing: boolean;
}

export function BlocklistTab({
  blockedSenders,
  onAddBlockedSender,
  onRemoveBlockedSender,
  isProcessing,
}: BlocklistTabProps) {
  const [newDomain, setNewDomain] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState('Spam & unwanted promotional mail');
  const [autoTrash, setAutoTrash] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddBlockedSender(newDomain.trim(), newEmail.trim() || undefined, newReason, autoTrash);
      setNewDomain('');
      setNewEmail('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-950/30 via-slate-900/60 to-purple-950/30 p-5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
            <Ban className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Blocked Senders & Auto-Trash Pipeline</h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
              Rules stored in Supabase <code className="text-cyan-400 font-mono">blocked_senders</code> table.
              When enabled, emails from these domains are highlighted across your dashboard and queued for automated batch trashing.
            </p>
          </div>
        </div>
      </div>

      {/* Add New Blocked Sender Form */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-indigo-400" />
          <span>Add Custom Block Rule</span>
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Sender Domain (e.g. spamdeals.com) *
            </label>
            <input
              type="text"
              required
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g. promo-newsletter.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Specific Sender Email (Optional)
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. sales@promo.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Reason / Notes
            </label>
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Reason for blocking"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !newDomain.trim()}
              className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/30 hover:bg-rose-500 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>Add Block Rule</span>
            </button>
          </div>
        </form>
      </div>

      {/* Blocked Senders Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">
            Active Blocked Senders ({blockedSenders.length})
          </h3>
          <span className="text-xs text-slate-400">
            Backed by Supabase PostgreSQL
          </span>
        </div>

        {blockedSenders.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-slate-600 mb-2" />
            <p className="text-xs text-slate-400">
              No blocked senders yet. Use the form above or click "Block Sender" on any email or newsletter!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/40">
                <tr>
                  <th className="py-2.5 px-3">Domain</th>
                  <th className="py-2.5 px-3">Specific Email</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Auto-Trash</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {blockedSenders.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {item.domain}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {item.sender_email || 'Entire Domain'}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {item.reason || 'Blocked by user'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onRemoveBlockedSender(item.id)}
                        disabled={isProcessing}
                        title="Remove from blocklist"
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
