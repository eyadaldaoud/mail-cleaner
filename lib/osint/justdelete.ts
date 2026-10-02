import { JustDeleteDirectoryItem, DeleteDifficulty } from '../types';

/**
 * Curated offline dataset of JustDelete.me directory for popular services.
 * Cross-references domain names to direct account deletion instructions & URLs.
 */
export const JUST_DELETE_DIRECTORY: JustDeleteDirectoryItem[] = [
  {
    name: 'Adobe',
    url: 'https://account.adobe.com/privacy',
    difficulty: 'easy',
    notes: 'Go to Privacy settings and click Delete Adobe Account. All active subscriptions must be cancelled first.',
    domains: ['adobe.com', 'behance.net'],
  },
  {
    name: 'Spotify',
    url: 'https://support.spotify.com/article/close-account/',
    difficulty: 'medium',
    notes: 'Free users can close account via link. Premium subscribers must cancel premium before deleting.',
    domains: ['spotify.com'],
  },
  {
    name: 'Canva',
    url: 'https://www.canva.com/settings/account-settings',
    difficulty: 'easy',
    notes: 'Go to Account Settings -> Your Account -> Close Account.',
    domains: ['canva.com'],
  },
  {
    name: 'Dropbox',
    url: 'https://www.dropbox.com/account/delete',
    difficulty: 'easy',
    notes: 'Direct one-click deletion page after re-authenticating password.',
    domains: ['dropbox.com'],
  },
  {
    name: 'Twitter / X',
    url: 'https://twitter.com/settings/deactivate',
    difficulty: 'easy',
    notes: 'Deactivate account. After 30 days of inactivity, the account is permanently deleted.',
    domains: ['twitter.com', 'x.com'],
  },
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/psettings/account',
    difficulty: 'easy',
    notes: 'Account preferences -> Account management -> Close account.',
    domains: ['linkedin.com'],
  },
  {
    name: 'Amazon',
    url: 'https://www.amazon.com/privacy/data-deletion',
    difficulty: 'hard',
    notes: 'Submit a deletion request under Your Account -> Close Your Amazon Account. Requires email or SMS confirmation.',
    domains: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'aws.amazon.com'],
  },
  {
    name: 'Netflix',
    url: 'https://www.netflix.com/youraccount',
    difficulty: 'hard',
    notes: 'Cancel membership. Account automatically deletes after 10 months or you can email privacy@netflix.com for immediate wipe.',
    domains: ['netflix.com'],
  },
  {
    name: 'GitHub',
    url: 'https://github.com/settings/admin',
    difficulty: 'easy',
    notes: 'Under Settings -> Account -> Delete Account.',
    domains: ['github.com'],
  },
  {
    name: 'Uber',
    url: 'https://myprivacy.uber.com/privacy/account-deletion',
    difficulty: 'easy',
    notes: 'Direct privacy account deletion link. Account is permanently deleted after 30 days.',
    domains: ['uber.com'],
  },
  {
    name: 'Zoom',
    url: 'https://zoom.us/account',
    difficulty: 'easy',
    notes: 'Account Management -> Account Profile -> Terminate my account.',
    domains: ['zoom.us'],
  },
  {
    name: 'Slack',
    url: 'https://slack.com/help/articles/204092246-Deactivate-your-Slack-account',
    difficulty: 'medium',
    notes: 'You must deactivate individual workspace profiles or contact workspace Primary Owner.',
    domains: ['slack.com'],
  },
  {
    name: 'Pinterest',
    url: 'https://www.pinterest.com/settings/account-settings',
    difficulty: 'easy',
    notes: 'Settings -> Account management -> Delete account.',
    domains: ['pinterest.com'],
  },
  {
    name: 'Reddit',
    url: 'https://www.reddit.com/settings',
    difficulty: 'easy',
    notes: 'Scroll to bottom of User Settings and click Delete Account.',
    domains: ['reddit.com'],
  },
  {
    name: 'Discord',
    url: 'https://support.discord.com/hc/en-us/articles/212519838-How-do-I-delete-my-account',
    difficulty: 'easy',
    notes: 'User Settings -> My Account -> Delete Account (Ownership of servers must be transferred first).',
    domains: ['discord.com', 'discordapp.com'],
  },
  {
    name: 'Coursera',
    url: 'https://www.coursera.org/account-profile',
    difficulty: 'easy',
    notes: 'Scroll to the bottom of the Account Profile settings and click "Delete Account".',
    domains: ['coursera.org'],
  },
  {
    name: 'Substack',
    url: 'https://substack.com/settings',
    difficulty: 'medium',
    notes: 'Under Settings -> Delete Account. Must cancel active paid newsletter subscriptions first.',
    domains: ['substack.com'],
  },
  {
    name: 'WeTransfer',
    url: 'https://help.wetransfer.com/hc/en-us/articles/202703813-How-do-I-delete-my-account',
    difficulty: 'easy',
    notes: 'Account Settings -> Delete Account.',
    domains: ['wetransfer.com'],
  },
  {
    name: 'Figma',
    url: 'https://help.figma.com/hc/en-us/articles/360040328273-Delete-your-Figma-account',
    difficulty: 'easy',
    notes: 'Profile menu -> Settings -> Account -> Delete account.',
    domains: ['figma.com'],
  },
  {
    name: 'Steam',
    url: 'https://help.steampowered.com/en/wizard/HelpDeleteAccount',
    difficulty: 'hard',
    notes: 'Requires contacting Steam Support with proof of ownership and waiting up to 30 days.',
    domains: ['steampowered.com', 'steamcommunity.com'],
  },
  {
    name: 'PlayStation Network',
    url: 'https://www.playstation.com/support/account/close-account-for-psn/',
    difficulty: 'impossible',
    notes: 'PlayStation does not provide automated self-serve deletion. You must call phone support or chat with live agent.',
    domains: ['playstation.com', 'sony.com'],
  }
];

/**
 * Normalizes a hostname or domain string (e.g. "auth.accounts.spotify.com" -> "spotify.com")
 */
export function extractRootDomain(rawUrlOrDomain: string): string {
  if (!rawUrlOrDomain) return '';

  let cleaned = rawUrlOrDomain.trim().toLowerCase();

  // If full URL, extract hostname
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const parsed = new URL(cleaned);
      cleaned = parsed.hostname;
    } catch {
      cleaned = cleaned.replace(/^https?:\/\//, '').split('/')[0];
    }
  }

  // Remove port and query
  cleaned = cleaned.split(':')[0].split('/')[0].split('?')[0];

  // Strip leading subdomains like www, login, auth, mail, accounts, app
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    // Check known two-part TLDs (co.uk, com.au, etc.)
    const isTwoPartTld = ['co.uk', 'com.au', 'co.nz', 'gov.uk', 'org.uk'].some((tld) =>
      cleaned.endsWith(tld)
    );

    if (isTwoPartTld && parts.length >= 3) {
      cleaned = parts.slice(-3).join('.');
    } else {
      cleaned = parts.slice(-2).join('.');
    }
  }

  return cleaned;
}

/**
 * Looks up direct JustDelete.me deletion info by domain
 */
export function lookupJustDeleteInfo(domainOrUrl: string): {
  matchFound: boolean;
  item?: JustDeleteDirectoryItem;
  deleteUrl?: string;
  difficulty: DeleteDifficulty;
  notes?: string;
} {
  const rootDomain = extractRootDomain(domainOrUrl);

  const found = JUST_DELETE_DIRECTORY.find((item) =>
    item.domains.some((d) => d === rootDomain || rootDomain.endsWith(`.${d}`) || d.endsWith(`.${rootDomain}`))
  );

  if (found) {
    return {
      matchFound: true,
      item: found,
      deleteUrl: found.url,
      difficulty: found.difficulty,
      notes: found.notes,
    };
  }

  // Generic fallback: direct privacy/settings url guess
  return {
    matchFound: false,
    deleteUrl: `https://${rootDomain}/settings`,
    difficulty: 'unknown',
    notes: 'No automated directory entry. Check website settings or privacy policy for data erasure request.',
  };
}
