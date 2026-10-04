'use client';

import React, { useState, useEffect } from 'react';
import {
  AutoDeleteRule,
  getAutoRules,
  deleteAutoRule,
  toggleAutoRule,
} from '@/lib/autoRules';
import {
  Zap,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Search,
} from 'lucide-react';

interface AutoRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRulesChanged?: () => void;
}

export function AutoRulesModal({ isOpen, onClose, onRulesChanged }: AutoRulesModalProps) {
  const [rules, setRules] = useState<AutoDeleteRule[]>([]);
  const [search, setSearch] = useState('');

  const refreshRules = () => {
    setRules(getAutoRules());
  };

  useEffect(() => {
    if (isOpen) {
      refreshRules();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = (id: string) => {
    deleteAutoRule(id);
    refreshRules();
    if (onRulesChanged) onRulesChanged();
  };

  const handleToggle = (id: string) => {
    toggleAutoRule(id);
    refreshRules();
    if (onRulesChanged) onRulesChanged();
  };

  const filteredRules = rules.filter(
    (r) =>
      r.pattern.toLowerCase().includes(search.toLowerCase()) ||
      r.senderName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0c1220] shadow-2xl shadow-black/80">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>Auto-Delete Rules Engine</span>
                <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.2 text-[10px] font-semibold text-amber-300">
                  {rules.length} active pattern{rules.length === 1 ? '' : 's'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Whenever you sync new batches of emails, MailCleaner automatically trashes matching messages.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-slate-800/60 bg-slate-950/40">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search automated rules by sender or domain..."
              className="w-full rounded-xl border border-slate-700/80 bg-slate-800/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Rules List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {filteredRules.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
              <Zap className="mx-auto h-8 w-8 text-slate-600 mb-2" />
              <h3 className="text-sm font-semibold text-white">No Auto-Delete Rules Yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Launch the Cleaning Wizard or check the &ldquo;Auto-delete future emails&rdquo; option when cleaning senders to register automatic sync rules.
              </p>
            </div>
          ) : (
            filteredRules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                  rule.enabled
                    ? 'border-amber-500/30 bg-amber-950/10'
                    : 'border-slate-800/80 bg-slate-900/40 opacity-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      {rule.senderName || rule.pattern}
                    </span>
                    <span className="text-[10px] font-mono text-amber-300/80 rounded bg-amber-500/10 px-1.5 py-0.2 border border-amber-500/20">
                      {rule.pattern}
                    </span>
                    {rule.category && (
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                        {rule.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1 text-rose-300">
                      <Trash2 className="h-2.5 w-2.5" />
                      <span>{rule.action === 'trash_and_unsub' ? 'Auto Unsub & Trash' : 'Auto Trash'}</span>
                    </span>
                    <span>·</span>
                    <span>Created {new Date(rule.createdAt).toLocaleDateString()}</span>
                    {rule.deletedCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-cyan-300 font-semibold">
                          {rule.deletedCount} emails auto-trashed
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(rule.id)}
                    className="p-1 text-slate-400 hover:text-white transition"
                    title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="h-6 w-6 text-amber-400" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-slate-600" />
                    )}
                  </button>

                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                    title="Delete rule"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800/80 px-6 py-3 bg-slate-900/60">
          <span className="text-[11px] text-slate-400">
            Rules apply automatically on every new email batch sync.
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
