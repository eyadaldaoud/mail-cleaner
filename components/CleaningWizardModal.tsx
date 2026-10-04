'use client';

import React, { useState, useMemo } from 'react';
import {
  EmailMetadata,
} from '@/lib/types';
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
  ArrowRight,
  HardDrive,
  RefreshCw,
  Mail,
  SlidersHorizontal,
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

type SenderActionChoice = 'unsub_and_trash' | 'trash_only' | 'unsub_only' | 'keep';

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
  // Step navigation:
  // 0 = Intro & Health Scan
  // 1..N = Categories
  // N+1 = Review & Confirmation
  // N+2 = Success celebration
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingStatus, setExecutingStatus] = useState<string>('');
  const [executionProgress, setExecutionProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // Group emails by category
  const categorizedEmails = useMemo(() => {
    const map = new Map<EmailCategoryId, EmailMetadata[]>();
    for (const cat of EMAIL_CATEGORIES) {
      if (cat.id !== 'all') {
        map.set(cat.id, []);
      }
    }
    for (const email of emails) {
      const cat = classifyEmailCategory(email);
      const list = map.get(cat) || [];
      list.push(email);
      map.set(cat, list);
    }
    return map;
  }, [emails]);

  // Determine active categories that have emails (prioritize marketing/clutter first)
  const activeCategories = useMemo(() => {
    const priorityOrder: EmailCategoryId[] = [
      'promotions',
      'newsletters',
      'social',
      'updates',
      'finance',
      'dev_work',
      'personal',
    ];
    return priorityOrder.filter((catId) => {
      const list = categorizedEmails.get(catId);
      return list && list.length > 0;
    });
  }, [categorizedEmails]);

  // Aggregate senders per category
  const categorySenders = useMemo(() => {
    const map = new Map<EmailCategoryId, SenderAggregate[]>();
    for (const catId of activeCategories) {
      const catEmails = categorizedEmails.get(catId) || [];
      const senders = aggregateSenders(catEmails);
      // Sort by email count descending
      senders.sort((a, b) => b.count - a.count);
      map.set(catId, senders);
    }
    return map;
  }, [activeCategories, categorizedEmails]);

  // User decisions state keyed by senderEmail
  const [decisions, setDecisions] = useState<Record<string, SenderDecision>>(() => {
    const initial: Record<string, SenderDecision> = {};
    for (const catId of activeCategories) {
      const senders = categorySenders.get(catId) || [];
      for (const s of senders) {
        // High-clutter categories default to 'unsub_and_trash' if unsub exists, else 'trash_only'
        const isClutterCat = ['promotions', 'newsletters', 'social', 'updates'].includes(catId);
        const defaultAction: SenderActionChoice = isClutterCat
          ? s.hasUnsubscribe
            ? 'unsub_and_trash'
            : 'trash_only'
          : 'keep';

        initial[s.senderEmail.toLowerCase()] = {
          senderEmail: s.senderEmail,
          senderDomain: s.senderDomain,
          senderName: s.senderName,
          category: catId,
          emailIds: s.emailIds,
          action: defaultAction,
          autoDeleteFuture: defaultAction === 'unsub_and_trash' || defaultAction === 'trash_only',
          hasUnsubscribe: s.hasUnsubscribe,
          count: s.count,
          totalSizeBytes: s.totalSizeBytes,
        };
      }
    }
    return initial;
  });

  // Re-sync decisions if senders change
  React.useEffect(() => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const catId of activeCategories) {
        const senders = categorySenders.get(catId) || [];
        for (const s of senders) {
          const key = s.senderEmail.toLowerCase();
          if (!next[key]) {
            const isClutterCat = ['promotions', 'newsletters', 'social', 'updates'].includes(catId);
            const defaultAction: SenderActionChoice = isClutterCat
              ? s.hasUnsubscribe
                ? 'unsub_and_trash'
                : 'trash_only'
              : 'keep';

            next[key] = {
              senderEmail: s.senderEmail,
              senderDomain: s.senderDomain,
              senderName: s.senderName,
              category: catId,
              emailIds: s.emailIds,
              action: defaultAction,
              autoDeleteFuture: defaultAction === 'unsub_and_trash' || defaultAction === 'trash_only',
              hasUnsubscribe: s.hasUnsubscribe,
              count: s.count,
              totalSizeBytes: s.totalSizeBytes,
            };
          }
        }
      }
      return next;
    });
  }, [activeCategories, categorySenders]);

  if (!isOpen) return null;

  const totalSteps = activeCategories.length + 2; // Step 0 (Intro) + Categories (1..N) + Review (N+1)
  const isIntroStep = currentStep === 0;
  const isReviewStep = currentStep === activeCategories.length + 1;
  const isSuccessStep = currentStep === activeCategories.length + 2;

  // Current category (for steps 1..activeCategories.length)
  const currentCategoryIdx = currentStep - 1;
  const currentCategoryId = activeCategories[currentCategoryIdx];
  const currentCategoryDef = EMAIL_CATEGORIES.find((c) => c.id === currentCategoryId);
  const currentCategorySenders = currentCategoryId ? categorySenders.get(currentCategoryId) || [] : [];

  // Summary statistics of decisions
  const totalEmailsScanned = emails.length;
  const totalBytesScanned = emails.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);

  const pendingDecisions = Object.values(decisions);
  const toTrashEmailsCount = pendingDecisions
    .filter((d) => d.action === 'unsub_and_trash' || d.action === 'trash_only')
    .reduce((sum, d) => sum + d.count, 0);

  const toUnsubSendersCount = pendingDecisions.filter(
    (d) => (d.action === 'unsub_and_trash' || d.action === 'unsub_only') && d.hasUnsubscribe
  ).length;

  const toAutoDeleteRules = pendingDecisions.filter(
    (d) => d.autoDeleteFuture && (d.action === 'unsub_and_trash' || d.action === 'trash_only')
  );

  const estimatedSavedBytes = pendingDecisions
    .filter((d) => d.action === 'unsub_and_trash' || d.action === 'trash_only')
    .reduce((sum, d) => sum + d.totalSizeBytes, 0);

  // Helper to update individual sender decision
  const updateSenderAction = (
    senderEmail: string,
    action: SenderActionChoice,
    autoDelete?: boolean
  ) => {
    setDecisions((prev) => {
      const key = senderEmail.toLowerCase();
      const existing = prev[key];
      if (!existing) return prev;
      return {
        ...prev,
        [key]: {
          ...existing,
          action,
          autoDeleteFuture:
            autoDelete !== undefined
              ? autoDelete
              : action === 'unsub_and_trash' || action === 'trash_only'
              ? existing.autoDeleteFuture
              : false,
        },
      };
    });
  };

  const toggleAutoDeleteForSender = (senderEmail: string) => {
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

  // Bulk actions for current category
  const setAllCategoryActions = (action: SenderActionChoice) => {
    if (!currentCategoryId) return;
    const senders = currentCategorySenders;
    setDecisions((prev) => {
      const next = { ...prev };
      for (const s of senders) {
        const key = s.senderEmail.toLowerCase();
        if (next[key]) {
          const finalAction =
            action === 'unsub_and_trash' && !s.hasUnsubscribe ? 'trash_only' : action;
          next[key] = {
            ...next[key],
            action: finalAction,
            autoDeleteFuture: finalAction === 'unsub_and_trash' || finalAction === 'trash_only',
          };
        }
      }
      return next;
    });
  };

  // Execution flow
  const handleExecuteCleanup = async () => {
    setIsExecuting(true);
    const toTrashIds: string[] = [];
    const unsubEmailTargets: EmailMetadata[] = [];
    const autoRulesToSave: Array<Omit<AutoDeleteRule, 'id' | 'createdAt' | 'deletedCount'>> = [];

    // Map emails for quick lookup
    const emailMap = new Map<string, EmailMetadata>();
    for (const e of emails) emailMap.set(e.id, e);

    for (const d of Object.values(decisions)) {
      // 1. Trash targets
      if (d.action === 'unsub_and_trash' || d.action === 'trash_only') {
        toTrashIds.push(...d.emailIds);
      }

      // 2. Unsubscribe targets
      if ((d.action === 'unsub_and_trash' || d.action === 'unsub_only') && d.hasUnsubscribe) {
        const sampleEmail = emails.find(
          (e) => e.senderEmail.toLowerCase() === d.senderEmail.toLowerCase() && e.hasUnsubscribe
        );
        if (sampleEmail) unsubEmailTargets.push(sampleEmail);
      }

      // 3. Auto-delete rules
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

    const totalOperations = unsubEmailTargets.length + (toTrashIds.length > 0 ? 1 : 0) + 1;
    let completedOps = 0;
    setExecutionProgress({ current: 0, total: totalOperations });

    try {
      // Phase A: Unsubscribe
      if (unsubEmailTargets.length > 0) {
        setExecutingStatus(`Sending unsubscribe requests (0/${unsubEmailTargets.length})…`);
        for (let i = 0; i < unsubEmailTargets.length; i++) {
          try {
            await onUnsubscribe(unsubEmailTargets[i]);
          } catch {
            /* ignore individual unsub failure */
          }
          completedOps++;
          setExecutionProgress({ current: completedOps, total: totalOperations });
          setExecutingStatus(`Sending unsubscribe requests (${i + 1}/${unsubEmailTargets.length})…`);
        }
      }

      // Phase B: Trash emails
      if (toTrashIds.length > 0) {
        setExecutingStatus(`Moving ${toTrashIds.length} emails to Trash…`);
        await onBatchTrash(toTrashIds);
        completedOps++;
        setExecutionProgress({ current: completedOps, total: totalOperations });
      }

      // Phase C: Save Auto-Delete Rules
      if (autoRulesToSave.length > 0) {
        setExecutingStatus(`Saving ${autoRulesToSave.length} Auto-Delete sync rules…`);
        saveBulkAutoRules(autoRulesToSave);
        if (onAutoRulesUpdated) onAutoRulesUpdated();
      }

      completedOps++;
      setExecutionProgress({ current: completedOps, total: totalOperations });
      setExecutingStatus('Cleanup complete!');

      // Move to celebration screen
      setCurrentStep(activeCategories.length + 2);
    } catch (err) {
      console.error('Wizard execution error:', err);
      setExecutingStatus('An error occurred during cleanup.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#0c1220] shadow-2xl shadow-indigo-950/60">
        {/* Glow ambient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-600/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>Inbox Cleaning Wizard</span>
                <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                  Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Audit categories, bulk delete junk, unsubscribe, and set auto-clean rules.
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

        {/* Step Progress Tracker */}
        {!isSuccessStep && (
          <div className="px-6 py-2 border-b border-slate-800/50 bg-slate-950/40">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1.5">
              <span>
                {isIntroStep
                  ? 'Overview & Inbox Scan'
                  : isReviewStep
                  ? 'Review & Execute Cleanup'
                  : currentCategoryDef?.label || 'Category Review'}
              </span>
              <span>
                {Math.round(((currentStep) / (totalSteps - 1)) * 100)}% Complete
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${((currentStep) / (totalSteps - 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* STEP 0: INTRO & DIAGNOSTIC */}
          {isIntroStep && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 via-slate-900/60 to-purple-950/20 p-5 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-3 shadow-lg shadow-indigo-600/20">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">Let&apos;s clean up your inbox together</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
                  We scanned <span className="font-bold text-white">{totalEmailsScanned}</span> emails (
                  <span className="font-mono text-cyan-300">{formatBytes(totalBytesScanned)}</span>) across your
                  inbox. We will guide you through each category, unsubscribe from junk, and configure auto-delete rules.
                </p>
              </div>

              {/* Stats Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-center">
                  <div className="text-lg font-bold text-white">{totalEmailsScanned}</div>
                  <div className="text-[10px] text-slate-400">Total Scanned</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-center">
                  <div className="text-lg font-bold text-cyan-400">{formatBytes(totalBytesScanned)}</div>
                  <div className="text-[10px] text-slate-400">Storage Used</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-center">
                  <div className="text-lg font-bold text-emerald-400">
                    {emails.filter((e) => e.hasUnsubscribe).length}
                  </div>
                  <div className="text-[10px] text-slate-400">Unsubscribable</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-center">
                  <div className="text-lg font-bold text-purple-400">{activeCategories.length}</div>
                  <div className="text-[10px] text-slate-400">Active Categories</div>
                </div>
              </div>

              {/* Categories Found */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Categories to clean:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeCategories.map((catId) => {
                    const catDef = EMAIL_CATEGORIES.find((c) => c.id === catId);
                    const count = categorizedEmails.get(catId)?.length || 0;
                    const senders = categorySenders.get(catId)?.length || 0;
                    if (!catDef) return null;
                    return (
                      <div
                        key={catId}
                        className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${catDef.badgeBorder} ${catDef.color} bg-slate-800`}
                          >
                            {catDef.shortLabel}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{catDef.label}</p>
                            <p className="text-[10px] text-slate-400">{senders} top senders</p>
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

          {/* STEPS 1..N: CATEGORY SENDER AUDIT */}
          {!isIntroStep && !isReviewStep && !isSuccessStep && currentCategoryDef && (
            <div className="space-y-4">
              {/* Category Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-xl border px-3 py-1.5 text-sm font-bold ${currentCategoryDef.badgeBorder} ${currentCategoryDef.color} bg-slate-800/90 shadow-sm`}
                  >
                    {currentCategoryDef.label}
                  </span>
                  <div>
                    <p className="text-xs text-slate-300">{currentCategoryDef.description}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {categorizedEmails.get(currentCategoryId)?.length || 0} emails from {currentCategorySenders.length} senders
                    </p>
                  </div>
                </div>

                {/* Category quick selectors */}
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setAllCategoryActions('unsub_and_trash')}
                    className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/20 transition"
                  >
                    Unsub & Trash All
                  </button>
                  <button
                    onClick={() => setAllCategoryActions('trash_only')}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                  >
                    Trash All (No Unsub)
                  </button>
                  <button
                    onClick={() => setAllCategoryActions('keep')}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white transition"
                  >
                    Keep All
                  </button>
                </div>
              </div>

              {/* Senders Drilldown List */}
              <div className="space-y-2">
                {currentCategorySenders.map((sender) => {
                  const key = sender.senderEmail.toLowerCase();
                  const decision = decisions[key] || {
                    action: sender.hasUnsubscribe ? 'unsub_and_trash' : 'trash_only',
                    autoDeleteFuture: true,
                  };

                  return (
                    <div
                      key={sender.senderEmail}
                      className={`rounded-xl border p-3.5 transition-all ${
                        decision.action === 'unsub_and_trash'
                          ? 'border-violet-500/40 bg-violet-950/15'
                          : decision.action === 'trash_only'
                          ? 'border-rose-500/40 bg-rose-950/15'
                          : decision.action === 'unsub_only'
                          ? 'border-emerald-500/40 bg-emerald-950/15'
                          : 'border-slate-800/80 bg-slate-900/40 opacity-70'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Sender info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate max-w-[200px]">
                              {sender.senderName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              @{sender.senderDomain}
                            </span>
                            {sender.hasUnsubscribe && (
                              <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400">
                                <ShieldCheck className="h-2.5 w-2.5" />
                                Unsub
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            <span className="font-semibold text-slate-300">{sender.count} emails</span>
                            <span>·</span>
                            <span className="font-mono text-cyan-300">{formatBytes(sender.totalSizeBytes)}</span>
                            {sender.sampleSubject && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[220px] text-slate-500">
                                  &ldquo;{sender.sampleSubject}&rdquo;
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action buttons choices */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {sender.hasUnsubscribe && (
                            <button
                              onClick={() => updateSenderAction(sender.senderEmail, 'unsub_and_trash')}
                              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                                decision.action === 'unsub_and_trash'
                                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 border border-violet-400/50'
                                  : 'border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
                              }`}
                              title="Unsubscribe and Trash past emails"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              <span>+</span>
                              <Trash2 className="h-3 w-3" />
                              <span>Unsub & Trash</span>
                            </button>
                          )}

                          <button
                            onClick={() => updateSenderAction(sender.senderEmail, 'trash_only')}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                              decision.action === 'trash_only'
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 border border-rose-400/50'
                                : 'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                            }`}
                            title="Move all emails to Trash without unsubscribing"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Trash Only</span>
                          </button>

                          {sender.hasUnsubscribe && (
                            <button
                              onClick={() => updateSenderAction(sender.senderEmail, 'unsub_only')}
                              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                                decision.action === 'unsub_only'
                                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/50'
                                  : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              }`}
                              title="Unsubscribe only (keep existing emails in inbox)"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              <span>Unsub Only</span>
                            </button>
                          )}

                          <button
                            onClick={() => updateSenderAction(sender.senderEmail, 'keep')}
                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                              decision.action === 'keep'
                                ? 'bg-slate-700 text-white border border-slate-500'
                                : 'border border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white'
                            }`}
                          >
                            Keep
                          </button>
                        </div>
                      </div>

                      {/* Auto-Delete Future Emails Toggle */}
                      {(decision.action === 'unsub_and_trash' || decision.action === 'trash_only') && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={decision.autoDeleteFuture}
                              onChange={() => toggleAutoDeleteForSender(sender.senderEmail)}
                              className="rounded border-slate-700 text-indigo-500 focus:ring-indigo-500 h-3.5 w-3.5 bg-slate-800"
                            />
                            <span className="text-[11px] text-slate-300 group-hover:text-white transition flex items-center gap-1">
                              <Zap className="h-3 w-3 text-amber-400" />
                              <span>Auto-delete future emails from this sender on sync</span>
                            </span>
                          </label>
                          <span className="text-[9px] text-slate-500 font-mono">
                            rule: {sender.senderEmail}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP N+1: REVIEW & EXECUTION CONFIRMATION */}
          {isReviewStep && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-slate-900/60 to-purple-950/30 p-5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-indigo-400" />
                  <span>Ready to Clean Your Inbox</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Here is the summary of actions you configured. Review your cleanup plan and click execute to proceed.
                </p>
              </div>

              {/* Review metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-center">
                  <div className="text-xl font-bold text-rose-300">{toTrashEmailsCount}</div>
                  <div className="text-[11px] text-slate-400">Emails to Trash</div>
                </div>
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-center">
                  <div className="text-xl font-bold text-cyan-300 font-mono">
                    {formatBytes(estimatedSavedBytes)}
                  </div>
                  <div className="text-[11px] text-slate-400">Space Saved</div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-center">
                  <div className="text-xl font-bold text-emerald-300">{toUnsubSendersCount}</div>
                  <div className="text-[11px] text-slate-400">Unsubscribes</div>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-center">
                  <div className="text-xl font-bold text-amber-300">{toAutoDeleteRules.length}</div>
                  <div className="text-[11px] text-slate-400">Auto-Clean Rules</div>
                </div>
              </div>

              {/* Auto-Delete Rules preview */}
              {toAutoDeleteRules.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Zap className="h-4 w-4" />
                    <span>Active Automation Rules to Save ({toAutoDeleteRules.length})</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Whenever you sync or fetch new batches of emails in the future, MailCleaner will automatically trash incoming messages matching these senders:
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                    {toAutoDeleteRules.map((r) => (
                      <span
                        key={r.senderEmail}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-200"
                      >
                        <Zap className="h-2.5 w-2.5 text-amber-400" />
                        {r.senderEmail}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress bar during execution */}
              {isExecuting && (
                <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-4 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-white">
                    <span className="font-semibold flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400" />
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

          {/* STEP N+2: SUCCESS CELEBRATION */}
          {isSuccessStep && (
            <div className="text-center py-8 space-y-5">
              <div className="relative inline-flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-2xl shadow-emerald-500/30 animate-pulse-glow">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">
                  Inbox Cleaned &amp; Automated!
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
                  Successfully cleaned <span className="font-bold text-white">{toTrashEmailsCount} emails</span> and freed{' '}
                  <span className="font-mono font-bold text-cyan-300">{formatBytes(estimatedSavedBytes)}</span> of space.
                </p>
              </div>

              {toAutoDeleteRules.length > 0 && (
                <div className="inline-block rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                  <p className="font-semibold flex items-center justify-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    <span>{toAutoDeleteRules.length} Auto-Delete sync rules are now active!</span>
                  </p>
                  <p className="text-[10px] text-amber-300/80 mt-0.5">
                    Next time new emails are fetched, these senders will be trashed automatically.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between border-t border-slate-800/80 px-6 py-4 bg-slate-900/80">
          {!isSuccessStep ? (
            <>
              {/* Back button */}
              <button
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                disabled={currentStep === 0 || isExecuting}
                className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>

              {/* Right: Next or Execute button */}
              {isReviewStep ? (
                <button
                  onClick={handleExecuteCleanup}
                  disabled={isExecuting || (toTrashEmailsCount === 0 && toUnsubSendersCount === 0)}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-indigo-600 to-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:brightness-110 transition disabled:opacity-50"
                >
                  {isExecuting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 text-amber-300" />
                  )}
                  <span>{isExecuting ? 'Cleaning…' : `Execute Cleanup (${toTrashEmailsCount} emails)`}</span>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition"
                >
                  <span>{isIntroStep ? 'Start Guided Clean' : 'Next Category'}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-end gap-2">
              {onRefreshInbox && (
                <button
                  onClick={() => {
                    onRefreshInbox();
                    onClose();
                  }}
                  className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh Inbox</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:brightness-110 transition"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Done</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
