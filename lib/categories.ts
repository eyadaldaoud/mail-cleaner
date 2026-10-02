import { EmailMetadata } from './types';

export type EmailCategoryId =
  | 'all'
  | 'promotions'
  | 'social'
  | 'updates'
  | 'newsletters'
  | 'finance'
  | 'dev_work'
  | 'personal';

export interface EmailCategoryDefinition {
  id: EmailCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  iconName: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  glowColor: string;
}

export const EMAIL_CATEGORIES: EmailCategoryDefinition[] = [
  {
    id: 'all',
    label: 'All Categories',
    shortLabel: 'All',
    description: 'Every email in your scanned inbox',
    iconName: 'Inbox',
    color: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/10 hover:bg-indigo-500/20',
    badgeBorder: 'border-indigo-500/30',
    glowColor: 'rgba(99, 102, 241, 0.25)',
  },
  {
    id: 'promotions',
    label: 'Promotions & Deals',
    shortLabel: 'Promotions',
    description: 'Marketing, sales, discount offers & shop promos',
    iconName: 'Tag',
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    badgeBorder: 'border-emerald-500/30',
    glowColor: 'rgba(16, 185, 129, 0.25)',
  },
  {
    id: 'social',
    label: 'Social & Networks',
    shortLabel: 'Social',
    description: 'LinkedIn, Twitter/X, Reddit, YouTube, Discord',
    iconName: 'Users',
    color: 'text-sky-400',
    badgeBg: 'bg-sky-500/10 hover:bg-sky-500/20',
    badgeBorder: 'border-sky-500/30',
    glowColor: 'rgba(14, 165, 233, 0.25)',
  },
  {
    id: 'updates',
    label: 'Alerts & Updates',
    shortLabel: 'Updates',
    description: 'Security codes, terms changes, service alerts',
    iconName: 'BellRing',
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 hover:bg-amber-500/20',
    badgeBorder: 'border-amber-500/30',
    glowColor: 'rgba(245, 158, 11, 0.25)',
  },
  {
    id: 'newsletters',
    label: 'Newsletters & Reads',
    shortLabel: 'Newsletters',
    description: 'Substack, digests, blogs, publications',
    iconName: 'Newspaper',
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 hover:bg-purple-500/20',
    badgeBorder: 'border-purple-500/30',
    glowColor: 'rgba(168, 85, 247, 0.25)',
  },
  {
    id: 'finance',
    label: 'Receipts & Finance',
    shortLabel: 'Finance',
    description: 'Invoices, orders, subscriptions, payment receipts',
    iconName: 'Receipt',
    color: 'text-teal-400',
    badgeBg: 'bg-teal-500/10 hover:bg-teal-500/20',
    badgeBorder: 'border-teal-500/30',
    glowColor: 'rgba(20, 184, 166, 0.25)',
  },
  {
    id: 'dev_work',
    label: 'Dev & SaaS Tools',
    shortLabel: 'Dev / Work',
    description: 'GitHub, Vercel, AWS, Slack, Jira, Notion',
    iconName: 'Code2',
    color: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 hover:bg-cyan-500/20',
    badgeBorder: 'border-cyan-500/30',
    glowColor: 'rgba(6, 182, 212, 0.25)',
  },
  {
    id: 'personal',
    label: 'Personal & Direct',
    shortLabel: 'Personal',
    description: 'Direct human emails and personal conversations',
    iconName: 'UserCheck',
    color: 'text-pink-400',
    badgeBg: 'bg-pink-500/10 hover:bg-pink-500/20',
    badgeBorder: 'border-pink-500/30',
    glowColor: 'rgba(236, 72, 153, 0.25)',
  },
];

const PROMOTION_KEYWORDS = [
  'discount',
  'promo',
  'deal',
  'sale',
  'off your',
  'black friday',
  'cyber monday',
  'coupon',
  'free shipping',
  'clearance',
  'save up to',
  'limited time',
  'special offer',
  'flash sale',
  'voucher',
  'shop now',
  '% off',
];

const SOCIAL_DOMAINS = [
  'linkedin.com',
  'twitter.com',
  'x.com',
  'facebookmail.com',
  'facebook.com',
  'instagram.com',
  'reddit.com',
  'redditmail.com',
  'tiktok.com',
  'discord.com',
  'discordapp.com',
  'youtube.com',
  'pinterest.com',
  'meetup.com',
  'twitch.tv',
];

const FINANCE_KEYWORDS = [
  'receipt',
  'invoice',
  'payment received',
  'payment confirmation',
  'order confirmed',
  'order summary',
  'order #',
  'billing',
  'your subscription',
  'transaction',
  'tax invoice',
  'bank',
  'paypal',
  'stripe',
  'apple.com/bill',
  'charged',
  'refund',
];

const DEV_DOMAINS = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'vercel.com',
  'amazonaws.com',
  'aws.amazon.com',
  'digitalocean.com',
  'cloudflare.com',
  'slack.com',
  'atlassian.net',
  'jira',
  'linear.app',
  'figma.com',
  'notion.so',
  'sentry.io',
  'supabase.co',
  'docker.com',
  'npm',
  'postman.com',
];

const UPDATE_KEYWORDS = [
  'security alert',
  'verification code',
  'verify your',
  'two-factor',
  'login attempt',
  'password reset',
  'terms of service',
  'privacy policy',
  'status update',
  'notice of',
  'action required',
  'critical alert',
];

/**
 * Classifies an email into a category ID based on Gmail labels, domain, headers & keywords
 */
export function classifyEmailCategory(email: EmailMetadata): EmailCategoryId {
  const labels = email.labels || [];
  const domain = email.senderDomain.toLowerCase();
  const searchTarget = `${email.senderName} ${email.senderEmail} ${email.subject} ${email.snippet || ''}`.toLowerCase();

  // 1. Gmail Native Categories
  if (labels.includes('CATEGORY_PROMOTIONS')) return 'promotions';
  if (labels.includes('CATEGORY_SOCIAL') || labels.includes('CATEGORY_FORUMS')) return 'social';
  if (labels.includes('CATEGORY_UPDATES')) return 'updates';

  // 2. Dev / SaaS
  if (DEV_DOMAINS.some((d) => domain.includes(d) || searchTarget.includes(d))) {
    return 'dev_work';
  }

  // 3. Social
  if (SOCIAL_DOMAINS.some((d) => domain.includes(d))) {
    return 'social';
  }

  // 4. Receipts & Finance
  if (FINANCE_KEYWORDS.some((kw) => searchTarget.includes(kw))) {
    return 'finance';
  }

  // 5. Promotions
  if (PROMOTION_KEYWORDS.some((kw) => searchTarget.includes(kw))) {
    return 'promotions';
  }

  // 6. Security & Updates
  if (UPDATE_KEYWORDS.some((kw) => searchTarget.includes(kw))) {
    return 'updates';
  }

  // 7. Newsletters (Has unsubscribe + newsletter/digest keywords or substack/medium)
  if (
    email.hasUnsubscribe &&
    (searchTarget.includes('newsletter') ||
      searchTarget.includes('digest') ||
      searchTarget.includes('weekly') ||
      searchTarget.includes('substack') ||
      searchTarget.includes('medium.com'))
  ) {
    return 'newsletters';
  }

  // 8. If mass notification + has unsubscribe -> promotions or newsletters
  if (email.isMassNotification && email.hasUnsubscribe) {
    return 'promotions';
  }

  // 9. Personal direct if native label or direct sender with no bulk tags
  if (labels.includes('CATEGORY_PERSONAL')) {
    return 'personal';
  }

  if (!email.isMassNotification && !email.hasUnsubscribe && email.ageDays < 365) {
    return 'personal';
  }

  // Default fallback for general notifications
  if (email.isMassNotification) {
    return 'updates';
  }

  return 'personal';
}

export interface SenderAggregate {
  senderEmail: string;
  senderName: string;
  senderDomain: string;
  count: number;
  totalSizeBytes: number;
  hasUnsubscribe: boolean;
  categories: Set<EmailCategoryId>;
  latestTimestamp: number;
  sampleSubject: string;
  emailIds: string[];
}

/**
 * Aggregates emails by sender with statistics
 */
export function aggregateSenders(emails: EmailMetadata[]): SenderAggregate[] {
  const map = new Map<string, SenderAggregate>();

  for (const email of emails) {
    const key = email.senderEmail.toLowerCase() || email.senderDomain.toLowerCase();
    const cat = classifyEmailCategory(email);

    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalSizeBytes += email.sizeBytes || 0;
      existing.categories.add(cat);
      existing.emailIds.push(email.id);
      if (email.hasUnsubscribe) existing.hasUnsubscribe = true;
      if (email.internalDate > existing.latestTimestamp) {
        existing.latestTimestamp = email.internalDate;
        existing.sampleSubject = email.subject;
      }
    } else {
      map.set(key, {
        senderEmail: email.senderEmail,
        senderName: email.senderName || email.senderEmail.split('@')[0],
        senderDomain: email.senderDomain,
        count: 1,
        totalSizeBytes: email.sizeBytes || 0,
        hasUnsubscribe: email.hasUnsubscribe,
        categories: new Set([cat]),
        latestTimestamp: email.internalDate,
        sampleSubject: email.subject,
        emailIds: [email.id],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
