'use client';

import React from 'react';
import {
  Inbox,
  HardDrive,
  BellRing,
  History,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { EmailMetadata, UserAccountRecord } from '@/lib/types';
import { formatBytes } from '@/lib/gmail/parser';

interface KpiMetricsProps {
  emails: EmailMetadata[];
  accounts: UserAccountRecord[];
  onSelectFilter: (filter: string) => void;
  activeFilter: string;
}

export function KpiMetrics({
  emails,
  accounts,
  onSelectFilter,
  activeFilter,
}: KpiMetricsProps) {
  const totalCount = emails.length;
  const totalSizeBytes = emails.reduce((acc, e) => acc + (e.sizeBytes || 0), 0);
  const totalSizeFormatted = formatBytes(totalSizeBytes);

  const heavyEmails = emails.filter((e) => e.isHeavy5MB);
  const heavySizeBytes = heavyEmails.reduce((acc, e) => acc + (e.sizeBytes || 0), 0);
  const heavySizeFormatted = formatBytes(heavySizeBytes);

  const massNotifications = emails.filter((e) => e.isMassNotification);
  const ancientEmails = emails.filter((e) => e.isAncient1Year);
  const unsubscribable = emails.filter((e) => e.hasUnsubscribe);

  const totalBreached = accounts.filter((a) => a.breach_count > 0).length;

  const cards = [
    {
      id: 'all',
      title: 'Inbox Analyzed',
      value: totalCount.toLocaleString(),
      subtext: `${totalSizeFormatted} total storage`,
      icon: Inbox,
      gradient: 'from-blue-500/20 to-indigo-500/10',
      border: 'border-blue-500/20',
      iconColor: 'text-blue-400',
    },
    {
      id: 'heavy_5mb',
      title: 'Heavy Files (>5MB)',
      value: heavyEmails.length.toLocaleString(),
      subtext: `${heavySizeFormatted} recoverable`,
      icon: HardDrive,
      gradient: 'from-amber-500/20 to-rose-500/10',
      border: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
    {
      id: 'mass_notifications',
      title: 'Mass Notifications',
      value: massNotifications.length.toLocaleString(),
      subtext: 'noreply & automated alerts',
      icon: BellRing,
      gradient: 'from-purple-500/20 to-pink-500/10',
      border: 'border-purple-500/30',
      iconColor: 'text-purple-400',
    },
    {
      id: 'ancient_1yr',
      title: 'Ancient History',
      value: ancientEmails.length.toLocaleString(),
      subtext: 'Older than 1–2 years',
      icon: History,
      gradient: 'from-cyan-500/20 to-blue-500/10',
      border: 'border-cyan-500/30',
      iconColor: 'text-cyan-400',
    },
    {
      id: 'unsubscribable',
      title: '1-Click Unsubscribes',
      value: unsubscribable.length.toLocaleString(),
      subtext: 'Detected mailing lists',
      icon: CheckCircle2,
      gradient: 'from-emerald-500/20 to-teal-500/10',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'osint_breached',
      title: 'Digital Footprint',
      value: accounts.length > 0 ? accounts.length.toLocaleString() : 'Ready',
      subtext: totalBreached > 0 ? `${totalBreached} compromised` : 'Password CSV & HIBP',
      icon: AlertTriangle,
      gradient: 'from-rose-500/20 to-red-500/10',
      border: 'border-rose-500/30',
      iconColor: 'text-rose-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => {
        const Icon = c.icon;
        const isSelected = activeFilter === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onSelectFilter(c.id)}
            className={`text-left rounded-xl p-3.5 transition-all relative overflow-hidden group cursor-pointer ${
              isSelected
                ? 'bg-slate-800/90 ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10'
                : 'bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* Ambient subtle glow background */}
            <div
              className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-xl opacity-30 bg-gradient-to-br ${c.gradient}`}
            />

            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium tracking-tight text-slate-400 truncate">
                {c.title}
              </span>
              <Icon className={`h-4 w-4 ${c.iconColor}`} />
            </div>

            <div className="text-xl font-bold tracking-tight text-white mb-0.5">
              {c.value}
            </div>

            <div className="text-[11px] text-slate-400 truncate">
              {c.subtext}
            </div>
          </button>
        );
      })}
    </div>
  );
}
