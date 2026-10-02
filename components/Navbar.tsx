'use client';

import React, { useState } from 'react';
import {
  Shield,
  Mail,
  Database,
  KeyRound,
  RefreshCw,
  LogOut,
  Sparkles,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { AuthSession } from '@/lib/types';

interface NavbarProps {
  session: AuthSession;
  activeTab: 'cleaner' | 'unsubscriber' | 'osint' | 'blocklist';
  setActiveTab: (tab: 'cleaner' | 'unsubscriber' | 'osint' | 'blocklist') => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenGuide: () => void;
  onToggleDemo: () => void;
  fetchLimit: number;
  onFetchLimitChange: (limit: number) => void;
  emailCount: number;
}

const FETCH_LIMIT_OPTIONS = [100, 250, 500, 1000];

export function Navbar({
  session,
  activeTab,
  setActiveTab,
  onRefresh,
  isRefreshing,
  onOpenGuide,
  onToggleDemo,
  fetchLimit,
  onFetchLimitChange,
  emailCount,
}: NavbarProps) {
  const [limitOpen, setLimitOpen] = useState(false);

  const tabs = [
    { id: 'cleaner', label: 'Cleaner', icon: Mail },
    { id: 'unsubscriber', label: 'Unsubscribe', icon: Shield },
    { id: 'osint', label: 'OSINT', icon: KeyRound },
    { id: 'blocklist', label: 'Blocklist', icon: Database },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-[#090d16]/90 backdrop-blur-xl border-b border-slate-800/80 shadow-lg shadow-black/30">
      {/* Top ambient highlight line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-indigo-500/80 to-cyan-400/80" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-3">

          {/* Left: Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white shadow-md shadow-indigo-600/20">
              <Mail className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              Mail<span className="text-cyan-400">Cleaner</span>
            </span>
            <span className="hidden sm:inline rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-indigo-300 uppercase">
              OSINT
            </span>
          </div>

          {/* Center: Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-0.5 rounded-xl border border-slate-800/80 bg-slate-950/60 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-300' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Fetch Limit Selector */}
            <div className="relative">
              <button
                onClick={() => setLimitOpen((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition"
                title="Set how many emails to scan"
              >
                <span className="text-cyan-400 font-bold">{emailCount}</span>
                <span className="text-slate-500">/</span>
                <span>{fetchLimit}</span>
                <ChevronDown className="h-3 w-3 text-slate-500 ml-0.5" />
              </button>
              {limitOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-slate-700 bg-slate-900 shadow-xl shadow-black/50 overflow-hidden z-50">
                  <p className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    Emails to scan
                  </p>
                  {FETCH_LIMIT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { onFetchLimitChange(opt); setLimitOpen(false); }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-xs transition ${
                        fetchLimit === opt
                          ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt} emails</span>
                      {fetchLimit === opt && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sync Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh inbox"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            {/* Guide Button */}
            <button
              onClick={onOpenGuide}
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
              title="Setup Guide"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>

            {/* Account / Connect */}
            {session.isAuthenticated ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 pl-2 pr-1.5 py-1 text-xs">
                {session.userPicture ? (
                  <img
                    src={session.userPicture}
                    alt="Profile"
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
                <span className="max-w-[110px] truncate font-medium text-slate-200 text-[11px]">
                  {session.userName || session.userEmail}
                </span>
                <a
                  href="/api/auth/logout"
                  title="Disconnect"
                  className="p-0.5 text-slate-400 hover:text-rose-400 transition ml-0.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onToggleDemo}
                  className="flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition"
                >
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  <span>Demo</span>
                </button>
                <a
                  href="/api/auth/google"
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/30 hover:brightness-110 transition"
                >
                  <span>Connect Gmail</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-1 border-t border-slate-800/80">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
