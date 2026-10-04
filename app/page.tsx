'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { KpiMetrics } from '@/components/KpiMetrics';
import { InboxCleanerTab } from '@/components/InboxCleanerTab';
import { UnsubscriberTab } from '@/components/UnsubscriberTab';
import { OsintTab } from '@/components/OsintTab';
import { BlocklistTab } from '@/components/BlocklistTab';
import { SetupGuideModal } from '@/components/SetupGuideModal';
import { FetchProgress, FetchProgressState } from '@/components/FetchProgress';
import { CleaningWizardModal } from '@/components/CleaningWizardModal';
import { AutoRulesModal } from '@/components/AutoRulesModal';
import {
  evaluateAutoDeleteRules,
  recordRuleDeletions,
  getAutoRules,
  RuleMatchResult,
} from '@/lib/autoRules';
import {
  AuthSession,
  EmailMetadata,
  BlockedSenderRecord,
  UserAccountRecord,
} from '@/lib/types';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  ExternalLink,
} from 'lucide-react';

export default function DashboardPage() {
  // Navigation & Filter state
  const [activeTab, setActiveTab] = useState<
    'cleaner' | 'unsubscriber' | 'osint' | 'blocklist'
  >('cleaner');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isAutoRulesOpen, setIsAutoRulesOpen] = useState(false);
  const [autoRulesCount, setAutoRulesCount] = useState(0);

  // Data states
  const [session, setSession] = useState<AuthSession>({
    isAuthenticated: false,
    isDemoMode: true,
    userEmail: 'demo@mailcleaner.app',
    userName: 'Demo Mode User',
  });
  const [emails, setEmails] = useState<EmailMetadata[]>([]);
  const [blockedSenders, setBlockedSenders] = useState<BlockedSenderRecord[]>([]);
  const [accounts, setAccounts] = useState<UserAccountRecord[]>([]);

  // Config check flags
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [dbConfigured, setDbConfigured] = useState(false);
  const [hibpConfigured, setHibpConfigured] = useState(false);

  // Loading & action states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fetchLimit, setFetchLimit] = useState(100);
  const fetchLimitRef = useRef(100);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<FetchProgressState | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const [apiNotice, setApiNotice] = useState<{
    message: string;
    link?: string;
    linkText?: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Helper to trigger toast
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ type, message });
      setTimeout(() => setToast(null), 4500);
    },
    []
  );

  const refreshAutoRulesCount = useCallback(() => {
    setAutoRulesCount(getAutoRules().filter((r) => r.enabled).length);
  }, []);

  useEffect(() => {
    refreshAutoRulesCount();
  }, [refreshAutoRulesCount]);

  // Execute Auto-Delete Rules on newly synced emails
  const runAutoClean = useCallback(
    async (matches: RuleMatchResult) => {
      const ids = matches.matchedEmailIds;
      if (ids.length === 0) return;

      try {
        const res = await fetch('/api/gmail/batch-trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
        const result = await res.json();
        if (result.success) {
          setEmails((prev) => prev.filter((e) => !ids.includes(e.id)));
          const ruleCounts: Record<string, number> = {};
          for (const summary of matches.ruleSummary) {
            ruleCounts[summary.rule.id] = summary.count;
          }
          recordRuleDeletions(ruleCounts);
          refreshAutoRulesCount();
          showToast(
            `⚡ Auto-Clean: Automatically trashed ${ids.length} new email(s) matching your saved rules!`,
            'success'
          );
        }
      } catch (err) {
        console.error('Auto clean error:', err);
      }
    },
    [showToast, refreshAutoRulesCount]
  );

  // Fetch all initial data
  // NOTE: We use fetchLimitRef to avoid stale closure on fetchLimit
  const loadDashboardData = useCallback(async (silent = false, limitOverride?: number) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Session & environment config
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      setSession({
        isAuthenticated: sessionData.isAuthenticated,
        isDemoMode: sessionData.isDemoMode,
        userEmail: sessionData.userEmail,
        userName: sessionData.userName,
        userPicture: sessionData.userPicture,
      });
      setOauthConfigured(sessionData.oauthConfigured);
      setDbConfigured(sessionData.dbConfigured);
      setHibpConfigured(sessionData.hibpConfigured);

      // 2. Fetch email metadata via SSE stream for live progress
      const limit = limitOverride ?? fetchLimitRef.current;

      await new Promise<void>((resolve) => {
        // Close any existing SSE connection
        if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }

        const sse = new EventSource(`/api/gmail/emails/stream?maxResults=${limit}`);
        sseRef.current = sse;

        // Set initial loading state so the drawer appears immediately
        setFetchProgress({ phase: 'listing', fetched: 0, target: limit, message: 'Contacting Gmail...' });

        sse.addEventListener('progress', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as FetchProgressState;
            setFetchProgress(data);
          } catch { /* ignore parse errors */ }
        });

        sse.addEventListener('done', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            setFetchProgress({ phase: 'done', fetched: data.fetched, target: limit, message: data.message });

            if (data.isApiDisabled) {
              setApiNotice({
                message: 'Gmail API is not yet enabled in your Google Cloud Project. Click to enable it:',
                link: 'https://console.developers.google.com/apis/api/gmail.googleapis.com/overview',
                linkText: 'Enable Gmail API in Google Cloud',
              });
            } else {
              setApiNotice(null);
            }

            if (data.emails && data.emails.length > 0) {
              setEmails(data.emails);
              setNextPageToken(data.nextPageToken);

              // Automatically evaluate and execute active auto-delete rules on new batch
              const autoMatches = evaluateAutoDeleteRules(data.emails);
              if (autoMatches.matchedEmailIds.length > 0) {
                runAutoClean(autoMatches);
              }
            } else if (data.apiError && !data.emails?.length) {
              showToast(data.apiError || 'Sync returned no emails — keeping existing data.', 'info');
            } else if (data.emails?.length === 0 && !data.apiError) {
              setEmails([]);
              setNextPageToken(undefined);
            }
          } catch { /* ignore */ } finally {
            sse.close();
            sseRef.current = null;
            // Auto-dismiss the progress drawer after 2.5s
            setTimeout(() => setFetchProgress(null), 2500);
            resolve();
          }
        });

        sse.addEventListener('error', () => {
          setFetchProgress(prev => prev ? { ...prev, phase: 'error', message: 'Connection error' } : null);
          sse.close();
          sseRef.current = null;
          resolve();
        });
      });

      // 3. Fetch blocked senders from Supabase
      const blockedRes = await fetch('/api/senders/blocked');
      const blockedData = await blockedRes.json();
      if (blockedData.blockedSenders) {
        setBlockedSenders(blockedData.blockedSenders);
      }

      // 4. Fetch discovered accounts from Supabase
      const accountsRes = await fetch('/api/accounts');
      const accountsData = await accountsRes.json();
      if (accountsData.accounts) {
        setAccounts(accountsData.accounts);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      showToast('Failed to sync with API. Check connection.', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle KPI click filter mapping
  const handleSelectKpiFilter = (filterId: string) => {
    if (filterId === 'unsubscribable') {
      setActiveTab('unsubscriber');
    } else if (filterId === 'osint_breached') {
      setActiveTab('osint');
    } else {
      setActiveTab('cleaner');
      setActiveFilter(filterId);
    }
  };

  // Bulk Trash action
  const handleBatchTrash = async (ids: string[]) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/gmail/batch-trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();

      if (data.success) {
        setEmails((prev) => prev.filter((e) => !ids.includes(e.id)));
        showToast(`Successfully moved ${ids.length} email(s) to Trash!`, 'success');
      } else {
        showToast(data.error || 'Failed to trash emails', 'error');
      }
    } catch {
      showToast('Batch trash request failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Unsubscribe action
  const handleUnsubscribe = async (
    email: EmailMetadata
  ): Promise<{ success: boolean; message: string }> => {
    if (!email.unsubscribeOptions) {
      return { success: false, message: 'No unsubscribe headers found.' };
    }

    try {
      const res = await fetch('/api/gmail/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: email.unsubscribeOptions }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Unsubscribed: ${data.message}`, 'success');
        return { success: true, message: data.message };
      } else {
        showToast(data.error || 'Unsubscribe attempt failed', 'error');
        return { success: false, message: data.error || 'Failed' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  // Block sender domain action
  const handleBlockSender = async (domain: string, senderEmail?: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/senders/blocked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          senderEmail,
          reason: 'Blocked via MailCleaner UI',
          autoTrash: true,
        }),
      });
      const data = await res.json();

      if (data.success && data.record) {
        setBlockedSenders((prev) => [data.record, ...prev]);
        showToast(`Domain @${domain} added to Supabase blocked list & auto-trash rule!`, 'success');
      } else {
        showToast(data.error || 'Failed to block sender', 'error');
      }
    } catch {
      showToast('Failed to block sender', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove blocked sender
  const handleRemoveBlockedSender = async (id: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/senders/blocked?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        setBlockedSenders((prev) => prev.filter((b) => b.id !== id));
        showToast('Block rule removed successfully', 'success');
      }
    } catch {
      showToast('Failed to remove block rule', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save discovered accounts batch (from Chrome CSV or scan)
  const handleSaveDiscoveredAccounts = async (
    newAccounts: Partial<UserAccountRecord>[]
  ) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: newAccounts }),
      });
      const data = await res.json();

      if (data.success && data.accounts) {
        setAccounts((prev) => {
          const map = new Map<string, UserAccountRecord>();
          for (const a of [...data.accounts, ...prev]) {
            map.set(`${a.domain}:${a.username || ''}`, a);
          }
          return Array.from(map.values());
        });
        showToast(
          `Aggregated ${data.count} discovered accounts into Supabase & JustDelete.me!`,
          'success'
        );
      }
    } catch {
      showToast('Failed to save discovered accounts', 'error');
    }
  };

  // Update account deletion status
  const handleUpdateAccountStatus = async (
    id: string,
    status: UserAccountRecord['status']
  ) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();

      if (data.success) {
        setAccounts((prev) =>
          prev.map((acc) => (acc.id === id ? { ...acc, status } : acc))
        );
        showToast(`Account status updated to ${status}`, 'success');
      }
    } catch {
      showToast('Failed to update account status', 'error');
    }
  };

  // Toggle Demo Mode
  const handleToggleDemo = async () => {
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable_demo' }),
      });
      await loadDashboardData(false);
      showToast('Switched to Demo Simulator Mode', 'info');
    } catch {
      showToast('Failed to activate demo mode', 'error');
    }
  };

  // Change fetch limit preset
  const handleFetchLimitChange = (newLimit: number) => {
    fetchLimitRef.current = newLimit;
    setFetchLimit(newLimit);
    loadDashboardData(false, newLimit);
    showToast(`Scanning latest ${newLimit} emails...`, 'info');
  };

  // Load more emails incrementally via pageToken
  const handleLoadMore = async () => {
    if (!nextPageToken || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/gmail/emails?maxResults=100&pageToken=${encodeURIComponent(nextPageToken)}`
      );
      const data = await res.json();
      if (data.emails && data.emails.length > 0) {
        setEmails((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEmails = data.emails.filter((e: EmailMetadata) => !existingIds.has(e.id));
          return [...prev, ...newEmails];
        });
        setNextPageToken(data.nextPageToken);
        showToast(`Loaded ${data.emails.length} additional emails!`, 'success');

        // Automatically evaluate and execute active auto-delete rules on incremental batch
        const autoMatches = evaluateAutoDeleteRules(data.emails);
        if (autoMatches.matchedEmailIds.length > 0) {
          runAutoClean(autoMatches);
        }
      } else {
        setNextPageToken(undefined);
        showToast('All available emails have been fetched', 'info');
      }
    } catch {
      showToast('Failed to load more emails', 'error');
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        session={session}
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab as 'cleaner' | 'unsubscriber' | 'osint' | 'blocklist')}
        onRefresh={() => loadDashboardData(true)}
        isRefreshing={isRefreshing}
        onOpenGuide={() => setIsGuideOpen(true)}
        onToggleDemo={handleToggleDemo}
        fetchLimit={fetchLimit}
        onFetchLimitChange={handleFetchLimitChange}
        emailCount={emails.length}
        onOpenWizard={() => setIsWizardOpen(true)}
        onOpenAutoRules={() => setIsAutoRulesOpen(true)}
        autoRulesCount={autoRulesCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* API Notification Banner */}
        {apiNotice && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-xs backdrop-blur-md shadow-lg shadow-amber-950/30 animate-in fade-in">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold text-amber-200">Action Required: </span>
                <span className="text-amber-100">{apiNotice.message}</span>
              </div>
            </div>
            {apiNotice.link && (
              <a
                href={apiNotice.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-md transition"
              >
                <span>{apiNotice.linkText || 'Enable Now'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* KPI Metrics Dashboard Bar */}
        <KpiMetrics
          emails={emails}
          accounts={accounts}
          activeFilter={activeFilter}
          onSelectFilter={handleSelectKpiFilter}
        />

        {/* Tab Viewport */}
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/30">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <p className="text-xs font-medium text-slate-400">
              Analyzing inbox metadata & syncing Supabase database...
            </p>
          </div>
        ) : (
          <div>
            {activeTab === 'cleaner' && (
              <InboxCleanerTab
                emails={emails}
                blockedSenders={blockedSenders}
                onBatchTrash={handleBatchTrash}
                onUnsubscribe={handleUnsubscribe}
                onBlockSender={handleBlockSender}
                isProcessing={isProcessing}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                nextPageToken={nextPageToken}
                onLoadMore={handleLoadMore}
                isLoadingMore={isLoadingMore}
                fetchLimit={fetchLimit}
                onFetchLimitChange={handleFetchLimitChange}
                onOpenWizard={() => setIsWizardOpen(true)}
                onOpenAutoRules={() => setIsAutoRulesOpen(true)}
                autoRulesCount={autoRulesCount}
              />
            )}

            {activeTab === 'unsubscriber' && (
              <UnsubscriberTab
                emails={emails}
                blockedSenders={blockedSenders}
                onUnsubscribe={handleUnsubscribe}
                onBlockSender={handleBlockSender}
                onBatchTrash={handleBatchTrash}
              />
            )}

            {activeTab === 'osint' && (
              <OsintTab
                accounts={accounts}
                onSaveDiscoveredAccounts={handleSaveDiscoveredAccounts}
                onUpdateAccountStatus={handleUpdateAccountStatus}
                userEmail={session.userEmail}
                isSaving={isProcessing}
              />
            )}

            {activeTab === 'blocklist' && (
              <BlocklistTab
                blockedSenders={blockedSenders}
                onAddBlockedSender={handleBlockSender}
                onRemoveBlockedSender={handleRemoveBlockedSender}
                isProcessing={isProcessing}
              />
            )}
          </div>
        )}
      </main>

      {/* Toast Notification Banner — bottom right */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-xs font-semibold text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200">
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="h-4 w-4 text-cyan-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Live Fetch Progress Drawer — center bottom */}
      <FetchProgress
        progress={fetchProgress}
        onDismiss={() => setFetchProgress(null)}
      />

      {/* Setup Guide Modal */}
      <SetupGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        oauthConfigured={oauthConfigured}
        dbConfigured={dbConfigured}
        hibpConfigured={hibpConfigured}
      />

      {/* Step-by-Step Onboarding Cleaning Wizard Modal */}
      <CleaningWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        emails={emails}
        onBatchTrash={handleBatchTrash}
        onUnsubscribe={handleUnsubscribe}
        onRefreshInbox={() => loadDashboardData(true)}
        onAutoRulesUpdated={refreshAutoRulesCount}
      />

      {/* Auto-Delete Rules Modal */}
      <AutoRulesModal
        isOpen={isAutoRulesOpen}
        onClose={() => setIsAutoRulesOpen(false)}
        onRulesChanged={refreshAutoRulesCount}
      />
    </div>
  );
}
