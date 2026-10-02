'use client';

import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Loader2, Wifi, FileSearch, X } from 'lucide-react';

export type FetchPhase = 'listing' | 'metadata' | 'done' | 'error' | 'demo' | 'idle';

export interface FetchProgressState {
  phase: FetchPhase;
  fetched: number;
  target: number;
  message: string;
}

interface FetchProgressProps {
  progress: FetchProgressState | null;
  onDismiss?: () => void;
}

const PHASE_CONFIG: Record<
  FetchPhase,
  { label: string; emoji: string; color: string; bgColor: string; borderColor: string }
> = {
  idle: {
    label: 'Idle',
    emoji: '💤',
    color: 'text-slate-400',
    bgColor: 'bg-slate-900/80',
    borderColor: 'border-slate-700/60',
  },
  listing: {
    label: 'Listing IDs',
    emoji: '📡',
    color: 'text-cyan-300',
    bgColor: 'bg-slate-900/90',
    borderColor: 'border-cyan-500/40',
  },
  metadata: {
    label: 'Reading metadata',
    emoji: '📬',
    color: 'text-indigo-300',
    bgColor: 'bg-slate-900/90',
    borderColor: 'border-indigo-500/40',
  },
  done: {
    label: 'Complete',
    emoji: '✅',
    color: 'text-emerald-300',
    bgColor: 'bg-emerald-950/60',
    borderColor: 'border-emerald-500/40',
  },
  error: {
    label: 'Error',
    emoji: '⚠️',
    color: 'text-rose-300',
    bgColor: 'bg-rose-950/60',
    borderColor: 'border-rose-500/40',
  },
  demo: {
    label: 'Demo mode',
    emoji: '🎭',
    color: 'text-amber-300',
    bgColor: 'bg-amber-950/60',
    borderColor: 'border-amber-500/40',
  },
};

// Animated email emoji parade — shown while metadata is being fetched
function EmailParade({ count }: { count: number }) {
  const emojis = ['📧', '📨', '📩', '📬', '📭', '📮', '💌', '📝'];
  const visibleCount = Math.min(Math.ceil(count / 20), 8);
  return (
    <div className="flex items-center gap-1 h-5 overflow-hidden">
      {emojis.slice(0, Math.max(1, visibleCount)).map((emoji, i) => (
        <span
          key={i}
          className="text-sm animate-bounce"
          style={{
            animationDelay: `${i * 120}ms`,
            animationDuration: '1s',
            opacity: i < visibleCount ? 1 : 0.2,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

// Segmented progress bar like App Store download
function SegmentedBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const segments = 20;
  const filledSegments = Math.round((pct / 100) * segments);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: segments }).map((_, i) => {
        const filled = i < filledSegments;
        const isActive = i === filledSegments - 1;
        return (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              filled
                ? isActive
                  ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]'
                  : 'bg-indigo-500'
                : 'bg-slate-700/60'
            }`}
            style={{
              transitionDelay: `${i * 15}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

export function FetchProgress({ progress, onDismiss }: FetchProgressProps) {
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (progress?.fetched) prevCountRef.current = progress.fetched;
  }, [progress?.fetched]);

  if (!progress || progress.phase === 'idle') return null;

  const config = PHASE_CONFIG[progress.phase];
  const pct = progress.target > 0 ? Math.min((progress.fetched / progress.target) * 100, 100) : 0;
  const isDone = progress.phase === 'done' || progress.phase === 'demo' || progress.phase === 'error';
  const isActive = progress.phase === 'listing' || progress.phase === 'metadata';

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 
        animate-in slide-in-from-bottom-4 duration-300`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`rounded-2xl border ${config.borderColor} ${config.bgColor} 
          backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden`}
      >
        {/* Animated glow border on top */}
        {isActive && (
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-indigo-500 to-cyan-400 animate-pulse" />
        )}
        {isDone && progress.phase === 'done' && (
          <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 to-teal-400" />
        )}

        <div className="px-4 py-3.5 space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {isActive ? (
                <div className="relative flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40">
                  <Loader2 className="h-3.5 w-3.5 text-indigo-300 animate-spin" />
                </div>
              ) : progress.phase === 'done' ? (
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-600/30 border border-emerald-500/40">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                </div>
              ) : progress.phase === 'error' ? (
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-rose-600/30 border border-rose-500/40">
                  <span className="text-sm">⚠️</span>
                </div>
              ) : (
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-600/30 border border-amber-500/40">
                  <span className="text-sm">🎭</span>
                </div>
              )}

              <div>
                <p className={`text-xs font-bold tracking-wide ${config.color}`}>
                  {isActive
                    ? progress.phase === 'listing'
                      ? '📡 Contacting Gmail API...'
                      : '📬 Fetching your emails'
                    : progress.phase === 'done'
                    ? '✅ Inbox loaded!'
                    : progress.phase === 'demo'
                    ? '🎭 Demo data loaded'
                    : '⚠️ Fetch error'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[260px]">
                  {progress.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Live counter badge */}
              {progress.target > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-slate-800/80 border border-slate-700/60 px-2 py-1">
                  <span className="text-[11px] font-bold text-white tabular-nums">
                    {progress.fetched.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500">/</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {progress.target.toLocaleString()}
                  </span>
                </div>
              )}

              {isDone && onDismiss && (
                <button
                  onClick={onDismiss}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar + parade */}
          {!isDone && progress.target > 0 && (
            <div className="space-y-2">
              <SegmentedBar value={progress.fetched} max={progress.target} />
              <div className="flex items-center justify-between">
                <EmailParade count={progress.fetched} />
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  {progress.phase === 'listing' ? (
                    <>
                      <Wifi className="h-3 w-3 text-cyan-500 animate-pulse" />
                      <span>Fetching IDs</span>
                    </>
                  ) : (
                    <>
                      <FileSearch className="h-3 w-3 text-indigo-400" />
                      <span>{Math.round(pct)}% complete</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Done: filled bar */}
          {isDone && progress.phase === 'done' && (
            <div>
              <div className="h-1.5 w-full rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <p className="text-[10px] text-emerald-400/70 mt-1.5 text-center">
                All done — {progress.fetched} emails ready to analyze
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
