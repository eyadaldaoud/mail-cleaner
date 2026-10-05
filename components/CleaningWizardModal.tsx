'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { EmailMetadata } from '@/lib/types';
import {
  classifyEmailCategory,
  aggregateSenders,
  EMAIL_CATEGORIES,
  EmailCategoryId,
  SenderAggregate,
} from '@/lib/categories';
import { saveBulkAutoRules, AutoDeleteRule } from '@/lib/autoRules';
import {
  Sparkles,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Zap,
  Check,
  Mail,
  SlidersHorizontal,
  HardDrive,
  RefreshCw,
  Info,
} from 'lucide-react';

interface CleaningWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  emails: EmailMetadata[];
  onBatchTrash: (ids: string[]) => Promise<void>;
  onUnsubscribe: (email: EmailMetadata) => Promise<{ success: boolean; message: string }>;
  onRefreshInbox?: () => void;
  onAutoRulesUpdated?: () => void;
}

type WizardPhase = 'intro' | 'category' | 'review' | 'success';
type SenderActionChoice = 'keep' | 'unsub_and_trash' | 'trash_only';

interface SenderDecision {
  senderEmail: string;
  senderDomain: string;
  senderName: string;
  category: EmailCategoryId;
  emailIds: string[];
  action: SenderActionChoice;
  autoDeleteFuture: boolean;
  hasUnsubscribe: boolean;
  count: number;
  totalSizeBytes: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function CleaningWizardModal({
  isOpen,
  onClose,
  emails,
  onBatchTrash,
  onUnsubscribe,
  onRefreshInbox,
  onAutoRulesUpdated,
}: CleaningWizardModalProps) {
  // Phase state machine (robust against category list changes during trash operations)
  const [phase, setPhase] = useState<WizardPhase>('intro');
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState<number>(0);

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingStatus, setExecutingStatus] = useState<string>('');
  const [executionProgress, setExecutionProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Frozen snapshot of emails & categories captured when modal opens
  const [snapshotEmails, setSnapshotEmails] = useState<EmailMetadata[]>([]);
  const [frozenCategories, setFrozenCategories] = useState<EmailCategoryId[]>([]);

  // Decisions state
  const [decisions, setDecisions] = useState<Record<string, SenderDecision>>({});

  // Reset & initialize wizard state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('intro');
      setCurrentCategoryIndex(0);
      setIsExecuting(false);
      setExecutingStatus('');

      // Freeze emails snapshot
      setSnapshotEmails(emails);

      // Categorize snapshot emails
      const catMap = new Map<EmailCategoryId, EmailMetadata[]>();
      for (const cat of EMAIL_CATEGORIES) {
        if (cat.id !== 'all') catMap.set(cat.id, []);
      }
      for (const e of emails) {
        const cat = classifyEmailCategory(e);
        const list = catMap.get(cat) || [];
        list.push(e);
        catMap.set(cat, list);
      }

      // Priority category order
      const priorityOrder: EmailCategoryId[] = [
        'promotions',
        'newsletters',
        'social',
        'updates',
        'finance',
        'dev_work',
        'personal',
      ];

      const active = priorityOrder.filter((catId) => {
        const list = catMap.get(catId);
        return list && list.length > 0;
      });

      setFrozenCategories(active);

      // Initialize decisions: ALWAYS SAFE DEFAULT ('keep'). NO AUTO-SELECTION FOR TRASH!
      const initialDecisions: Record<string, SenderDecision> = {};
      for (const catId of active) {
        const catEmails = catMap.get(catId) || [];
        const senders = aggregateSenders(catEmails);
        for (const s of senders) {
          initialDecisions[s.senderEmail.toLowerCase()] = {
            senderEmail: s.senderEmail,
            senderDomain: s.senderDomain,
            senderName: s.senderName,
            category: catId,
            emailIds: s.emailIds,
            action: 'keep', // SAFE DEFAULT: User must explicitly choose to trash
            autoDeleteFuture: false,
            hasUnsubscribe: s.hasUnsubscribe,
            count: s.count,
            totalSizeBytes: s.totalSizeBytes,
          };
        }
      }
      setDecisions(initialDecisions);
    }
  }, [isOpen]); // Only initialize when modal opens

  // Group snapshot emails by category
  const categorizedEmails = useMemo(() => {
    const map = new Map<EmailCategoryId, EmailMetadata[]>();
    for (const cat of EMAIL_CATEGORIES) {
      if (cat.id !== 'all') map.set(cat.id, []);
    }
    for (const email of snapshotEmails) {
      const cat = classifyEmailCategory(email);
      const list = map.get(cat) || [];
      list.push(email);
      map.set(cat, list);
    }
    return map;
  }, [snapshotEmails]);

  // Aggregate senders per category
  const categorySenders = useMemo(() => {
    const map = new Map<EmailCategoryId, SenderAggregate[]>();
    for (const catId of frozenCategories) {
      const catEmails = categorizedEmails.get(catId) || [];
      const senders = aggregateSenders(catEmails);
      senders.sort((a, b) => b.count - a.count);
      map.set(catId, senders);
    }
    return map;
  }, [frozenCategories, categorizedEmails]);

  if (!isOpen) return null;

  // Active category for the current step
  const activeCategoryId = frozenCategories[currentCategoryIndex];
  const activeCategoryDef = EMAIL_CATEGORIES.find((c) => c.id === activeCategoryId);
  const activeCategorySenders = activeCategoryId ? categorySenders.get(activeCategoryId) || [] : [];

  // Total steps: Intro (1) + Categories (N) + Review (1)
  const totalCategorySteps = frozenCategories.length;
  const currentStepNumber =
    phase === 'intro'
      ? 1
      : phase === 'category'
      ? currentCategoryIndex + 2
      : phase === 'review'
      ? totalCategorySteps + 2
      : totalCategorySteps + 2;

  const totalStepsCount = totalCategorySteps + 2;
  const progressPercent = Math.min(
    100,
    Math.round(((currentStepNumber - 1) / Math.max(1, totalStepsCount - 1)) * 100)
  );

  // Statistics
  const pendingDecisionsList = Object.values(decisions);
  const toTrashEmailsCount = pendingDecisionsList
    .filter((d) => d.action === 'unsub_and_trash' || d.action === 'trash_only')
    .reduce((sum, d) => sum + d.count, 0);

  const toUnsubSendersCount = pendingDecisionsList.filter(
    (d) => d.action === 'unsub_and_trash' && d.hasUnsubscribe
  ).length;

  const toAutoDeleteRules = pendingDecisionsList.filter(
    (d) => d.autoDeleteFuture && (d.action === 'unsub_and_trash' || d.action === 'trash_only')
  );

  const estimatedSavedBytes = pendingDecisionsList
    .filter((d) => d.action === 'unsub_and_trash' || d.action === 'trash_only')
    .reduce((sum, d) => sum + d.totalSizeBytes, 0);

  // Helper to change sender decision
  const setSenderAction = (senderEmail: string, action: SenderActionChoice) => {
    setDecisions((prev) => {
      const key = senderEmail.toLowerCase();
      const existing = prev[key];
      if (!existing) return prev;
      return {
        ...prev,
        [key]: {
          ...existing,
          action,
          // When keeping, turn off auto-delete; when trashing, enable auto-delete by default
          autoDeleteFuture: action !== 'keep' ? existing.autoDeleteFuture || true : false,
        },
      };
    });
  };

  const toggleAutoDelete = (senderEmail: string) => {
    setDecisions((prev) => {
      const key = senderEmail.toLowerCase();
      const existing = prev[key];
      if (!existing) return prev;
      return {
        ...prev,
        [key]: {
          ...existing,
          autoDeleteFuture: !existing.autoDeleteFuture,
        },
      };
    });
  };

  // Bulk actions for the current category
  const selectAllCategoryToClean = () => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const s of activeCategorySenders) {
        const key = s.senderEmail.toLowerCase();
        if (next[key]) {
          next[key] = {
            ...next[key],
            action: s.hasUnsubscribe ? 'unsub_and_trash' : 'trash_only',
            autoDeleteFuture: true,
          };
        }
      }
      return next;
    });
  };

  const resetAllCategoryToKeep = () => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const s of activeCategorySenders) {
        const key = s.senderEmail.toLowerCase();
        if (next[key]) {
          next[key] = {
            ...next[key],
            action: 'keep',
            autoDeleteFuture: false,
          };
        }
      }
      return next;
    });
  };

  // Step Navigation Handlers
  const handleNext = () => {
    if (phase === 'intro') {
      if (frozenCategories.length > 0) {
        setPhase('category');
        setCurrentCategoryIndex(0);
      } else {
        setPhase('review');
      }
    } else if (phase === 'category') {
      if (currentCategoryIndex < frozenCategories.length - 1) {
        setCurrentCategoryIndex((prev) => prev + 1);
      } else {
        setPhase('review');
      }
    }
  };

  const handleBack = () => {
    if (phase === 'category') {
      if (currentCategoryIndex > 0) {
        setCurrentCategoryIndex((prev) => prev - 1);
      } else {
        setPhase('intro');
      }
    } else if (phase === 'review') {
      if (frozenCategories.length > 0) {
        setPhase('category');
        setCurrentCategoryIndex(frozenCategories.length - 1);
      } else {
        setPhase('intro');
      }
    }
  };

  // Execute Cleanup Handler
  const handleExecuteCleanup = async () => {
    setIsExecuting(true);
    const toTrashIds: string[] = [];
    const unsubEmailTargets: EmailMetadata[] = [];
    const autoRulesToSave: Array<Omit<AutoDeleteRule, 'id' | 'createdAt' | 'deletedCount'>> = [];

    for (const d of Object.values(decisions)) {
      if (d.action === 'unsub_and_trash' || d.action === 'trash_only') {
        toTrashIds.push(...d.emailIds);
      }

      if (d.action === 'unsub_and_trash' && d.hasUnsubscribe) {
        const sampleEmail = snapshotEmails.find(
          (e) => e.senderEmail.toLowerCase() === d.senderEmail.toLowerCase() && e.hasUnsubscribe
        );
        if (sampleEmail) unsubEmailTargets.push(sampleEmail);
      }

      if (d.autoDeleteFuture && (d.action === 'unsub_and_trash' || d.action === 'trash_only')) {
        autoRulesToSave.push({
          target: 'sender',
          pattern: d.senderEmail.toLowerCase(),
          senderName: d.senderName,
          action: d.action === 'unsub_and_trash' ? 'trash_and_unsub' : 'trash',
          enabled: true,
          category: d.category,
        });
      }
    }

    const totalOps = unsubEmailTargets.length + (toTrashIds.length > 0 ? 1 : 0) + 1;
    let completed = 0;
    setExecutionProgress({ current: 0, total: totalOps });

    try {
      // 1. Unsubscribes
      if (unsubEmailTargets.length > 0) {
        setExecutingStatus(`Sending unsubscribe requests (0/${unsubEmailTargets.length})…`);
        for (let i = 0; i < unsubEmailTargets.length; i++) {
          try {
            await onUnsubscribe(unsubEmailTargets[i]);
          } catch {
            /* ignore individual errors */
          }
          completed++;
          setExecutionProgress({ current: completed, total: totalOps });
          setExecutingStatus(`Sending unsubscribe requests (${i + 1}/${unsubEmailTargets.length})…`);
        }
      }

      // 2. Batch Trash
      if (toTrashIds.length > 0) {
        setExecutingStatus(`Moving ${toTrashIds.length} emails to Trash…`);
        await onBatchTrash(toTrashIds);
        completed++;
        setExecutionProgress({ current: completed, total: totalOps });
      }

      // 3. Save Auto-rules
      if (autoRulesToSave.length > 0) {
        setExecutingStatus(`Saving ${autoRulesToSave.length} Auto-Delete sync rules…`);
        saveBulkAutoRules(autoRulesToSave);
        if (onAutoRulesUpdated) onAutoRulesUpdated();
      }

      completed++;
      setExecutionProgress({ current: completed, total: totalOps });
      setExecutingStatus('Cleanup complete!');

      // Transition to success screen
      setPhase('success');
    } catch (err) {
      console.error('Wizard execution error:', err);
      setExecutingStatus('An error occurred during cleanup.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#0c1220] shadow-2xl shadow-indigo-950/60">
        {/* Glow Header Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-600/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Inbox Cleaning Wizard
                </h2>
                {phase !== 'success' && (
                  <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                    Step {currentStepNumber} of {totalStepsCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review your categories, choose what to clean, and set auto-delete rules.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExecuting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Bar (capped at 100%, never glitches or overshoots) */}
        {phase !== 'success' && (
          <div className="px-6 py-2.5 border-b border-slate-800/50 bg-slate-950/40">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
              <span>
                {phase === 'intro'
                  ? 'Overview & Scan'
                  : phase === 'review'
                  ? 'Review & Confirm'
                  : `${activeCategoryDef?.label || 'Category'} (${currentCategoryIndex + 1}/${frozenCategories.length})`}
              </span>
              <span className="font-mono text-cyan-300 font-bold">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* PHASE 1: INTRO & INBOX SCAN */}
          {phase === 'intro' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 via-slate-900/60 to-purple-950/20 p-5 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-3 shadow-lg shadow-indigo-600/20">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">Let&apos;s clean up your inbox</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto mt-1.5 leading-relaxed">
                  We found <span className="font-bold text-white">{snapshotEmails.length}</span> emails across{' '}
                  <span className="font-bold text-cyan-300">{frozenCategories.length} categories</span>. You have full control — nothing is deleted until you select it and confirm.
                </p>
              </div>

              {/* Informational Notice about Safe Defaults */}
              <div className="flex items-center gap-2.5 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-xs text-blue-200">
                <Info className="h-4 w-4 shrink-0 text-blue-400" />
                <span>
                  All senders start in <strong>Keep</strong> mode by default. You choose exactly which senders to unsubscribe from or trash.
                </span>
              </div>

              {/* Categories list */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Categories ready for review:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {frozenCategories.map((catId) => {
                    const catDef = EMAIL_CATEGORIES.find((c) => c.id === catId);
                    const count = categorizedEmails.get(catId)?.length || 0;
                    const senders = categorySenders.get(catId)?.length || 0;
                    if (!catDef) return null;
                    return (
                      <div
                        key={catId}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-3.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${catDef.badgeBorder} ${catDef.color} bg-slate-800`}
                          >
                            {catDef.shortLabel}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{catDef.label}</p>
                            <p className="text-[11px] text-slate-400">{senders} top senders</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-white font-mono">{count} emails</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PHASE 2: CATEGORY SENDER AUDIT */}
          {phase === 'category' && activeCategoryDef && (
            <div className="space-y-5">
              {/* Category Header Banner with Spacious Layout */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`rounded-xl border px-3 py-1 text-xs font-bold ${activeCategoryDef.badgeBorder} ${activeCategoryDef.color} bg-slate-800`}
                    >
                      {activeCategoryDef.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {categorizedEmails.get(activeCategoryId)?.length || 0} emails · {activeCategorySenders.length} senders
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{activeCategoryDef.description}</p>
                </div>

                {/* Clear Quick Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={selectAllCategoryToClean}
                    className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-bold text-violet-200 hover:bg-violet-500/25 transition"
                  >
                    Select All to Clean
                  </button>
                  <button
                    onClick={resetAllCategoryToKeep}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    Keep All
                  </button>
                </div>
              </div>

              {/* Senders Drilldown List with Clean, Spacious Cards */}
              <div className="space-y-3">
                {activeCategorySenders.map((sender) => {
                  const key = sender.senderEmail.toLowerCase();
                  const decision = decisions[key] || {
                    action: 'keep',
                    autoDeleteFuture: false,
                  };

                  const isCleaning = decision.action !== 'keep';

                  return (
                    <div
                      key={sender.senderEmail}
                      className={`rounded-xl border p-4 transition-all space-y-3 ${
                        decision.action === 'unsub_and_trash'
                          ? 'border-violet-500/40 bg-violet-950/20 shadow-sm shadow-violet-950/30'
                          : decision.action === 'trash_only'
                          ? 'border-rose-500/40 bg-rose-950/20 shadow-sm shadow-rose-950/30'
                          : 'border-slate-800/80 bg-slate-900/40'
                      }`}
                    >
                      {/* Top Row: Sender Info + Segmented Action Buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Sender details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white truncate max-w-[220px]">
                              {sender.senderName}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              @{sender.senderDomain}
                            </span>
                            {sender.hasUnsubscribe && (
                              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" />
                                1-Click Unsub
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                            <span className="font-semibold text-slate-200">{sender.count} emails</span>
                            <span>·</span>
                            <span className="font-mono text-cyan-300">{formatBytes(sender.totalSizeBytes)}</span>
                          </div>
                        </div>

                        {/* Action Choices Segmented Control */}
                        <div className="flex items-center rounded-xl border border-slate-700 bg-slate-800/80 p-1 gap-1 shrink-0">
                          {/* Keep button */}
                          <button
                            onClick={() => setSenderAction(sender.senderEmail, 'keep')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              decision.action === 'keep'
                                ? 'bg-slate-700 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Keep
                          </button>

                          {/* Trash Only button */}
                          <button
                            onClick={() => setSenderAction(sender.senderEmail, 'trash_only')}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              decision.action === 'trash_only'
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                                : 'text-rose-300 hover:bg-rose-500/15'
                            }`}
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Trash Only</span>
                          </button>

                          {/* Unsub & Trash combo button (only if unsub available) */}
                          {sender.hasUnsubscribe && (
                            <button
                              onClick={() => setSenderAction(sender.senderEmail, 'unsub_and_trash')}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                decision.action === 'unsub_and_trash'
                                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                                  : 'text-violet-300 hover:bg-violet-500/15'
                              }`}
                            >
                              <ShieldCheck className="h-3 w-3 text-emerald-400" />
                              <span>+</span>
                              <Trash2 className="h-3 w-3 text-rose-400" />
                              <span>Unsub &amp; Trash</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Auto-Delete Future Emails Toggle (only shown when user chose to clean) */}
                      {isCleaning && (
                        <div className="pt-2.5 border-t border-slate-800/60 flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={decision.autoDeleteFuture}
                              onChange={() => toggleAutoDelete(sender.senderEmail)}
                              className="rounded border-slate-700 text-indigo-500 focus:ring-indigo-500 h-4 w-4 bg-slate-800"
                            />
                            <span className="text-xs text-slate-300 flex items-center gap-1.5">
                              <Zap className="h-3.5 w-3.5 text-amber-400" />
                              <span>Auto-delete future emails from this sender on sync</span>
                            </span>
                          </label>
                          <span className="text-[11px] text-slate-500 font-mono">
                            @{sender.senderDomain}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PHASE 3: REVIEW & CONFIRMATION */}
          {phase === 'review' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-slate-900/60 to-purple-950/30 p-5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-indigo-400" />
                  <span>Review Your Cleanup Plan</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Nothing has been deleted yet. Check the summary below and click execute when you are ready.
                </p>
              </div>

              {/* Review metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-center">
                  <div className="text-2xl font-bold text-rose-300">{toTrashEmailsCount}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Emails to Trash</div>
                </div>
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-300 font-mono">
                    {formatBytes(estimatedSavedBytes)}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Space Saved</div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-300">{toUnsubSendersCount}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Unsubscribes</div>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-center">
                  <div className="text-2xl font-bold text-amber-300">{toAutoDeleteRules.length}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Auto-Clean Rules</div>
                </div>
              </div>

              {toTrashEmailsCount === 0 && toUnsubSendersCount === 0 && (
                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5 text-center text-xs text-slate-400">
                  You have not selected any emails to trash or senders to unsubscribe from. You can go back to previous steps to choose senders, or close the wizard.
                </div>
              )}

              {/* Auto-delete rules preview */}
              {toAutoDeleteRules.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Zap className="h-4 w-4" />
                    <span>Auto-Delete Rules to Register ({toAutoDeleteRules.length})</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    On future syncs, MailCleaner will automatically move incoming emails from these senders to Trash:
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                    {toAutoDeleteRules.map((r) => (
                      <span
                        key={r.senderEmail}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-mono text-amber-200"
                      >
                        <Zap className="h-3 w-3 text-amber-400" />
                        {r.senderEmail}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Live progress indicator during execution */}
              {isExecuting && (
                <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-4 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-white">
                    <span className="font-semibold flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                      {executingStatus}
                    </span>
                    <span className="font-mono text-slate-400">
                      {executionProgress.current} / {executionProgress.total}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 transition-all duration-300"
                      style={{
                        width: `${
                          executionProgress.total > 0
                            ? (executionProgress.current / executionProgress.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PHASE 4: SUCCESS CELEBRATION */}
          {phase === 'success' && (
            <div className="text-center py-8 space-y-6">
              <div className="relative inline-flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-2xl shadow-emerald-500/30 animate-pulse-glow">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">
                  Inbox Cleaned &amp; Automated!
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto mt-1.5 leading-relaxed">
                  Successfully cleaned <span className="font-bold text-white">{toTrashEmailsCount} emails</span> and freed{' '}
                  <span className="font-mono font-bold text-cyan-300">{formatBytes(estimatedSavedBytes)}</span> of space.
                </p>
              </div>

              {toAutoDeleteRules.length > 0 && (
                <div className="inline-block rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-xs text-amber-200">
                  <p className="font-semibold flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span>{toAutoDeleteRules.length} Auto-Delete sync rules are now active!</span>
                  </p>
                  <p className="text-[11px] text-amber-300/80 mt-1">
                    Whenever you sync new batches of emails, these senders will be moved to Trash automatically.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between border-t border-slate-800/80 px-6 py-4 bg-slate-900/80">
          {phase !== 'success' ? (
            <>
              {/* Back button */}
              <button
                onClick={handleBack}
                disabled={phase === 'intro' || isExecuting}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              {/* Right: Next or Execute button */}
              {phase === 'review' ? (
                <button
                  onClick={handleExecuteCleanup}
                  disabled={isExecuting || (toTrashEmailsCount === 0 && toUnsubSendersCount === 0)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-indigo-600 to-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:brightness-110 transition disabled:opacity-50"
                >
                  {isExecuting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 text-amber-300" />
                  )}
                  <span>{isExecuting ? 'Cleaning…' : `Execute Cleanup (${toTrashEmailsCount} emails)`}</span>
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition"
                >
                  <span>{phase === 'intro' ? 'Start Guided Clean' : 'Next Category'}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-end gap-2.5">
              {onRefreshInbox && (
                <button
                  onClick={() => {
                    onRefreshInbox();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Refresh Inbox</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:brightness-110 transition"
              >
                <Check className="h-4 w-4" />
                <span>Done</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
