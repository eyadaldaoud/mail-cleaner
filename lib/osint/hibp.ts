import { HIBPBreach } from '../types';

const HIBP_API_KEY = process.env.HIBP_API_KEY || '';

/**
 * Curated offline historical breach catalog for demo testing & offline fallback
 */
export const KNOWN_HISTORICAL_BREACHES: Record<string, HIBPBreach[]> = {
  'user@example.com': [
    {
      Name: 'Adobe',
      Title: 'Adobe Systems',
      Domain: 'adobe.com',
      BreachDate: '2013-10-04',
      AddedDate: '2013-12-04T00:00:00Z',
      ModifiedDate: '2013-12-04T00:00:00Z',
      PwnCount: 152445165,
      Description:
        'In October 2013, 153 million Adobe accounts were breached with each containing an internal ID, username, email, encrypted password and password hint in plain text.',
      LogoPath: 'https://haveibeenpwned.com/Content/Images/PwnedLogos/Adobe.png',
      DataClasses: ['Email addresses', 'Password hints', 'Passwords', 'Usernames'],
      IsVerified: true,
      IsFabricated: false,
      IsSensitive: false,
      IsRetired: false,
      IsSpamList: false,
    },
    {
      Name: 'Canva',
      Title: 'Canva',
      Domain: 'canva.com',
      BreachDate: '2019-05-24',
      AddedDate: '2019-05-27T00:00:00Z',
      ModifiedDate: '2019-05-27T00:00:00Z',
      PwnCount: 137351147,
      Description:
        'In May 2019, the graphic-design tool website Canva suffered a data breach that impacted 137 million subscribers. The exposed data included email addresses, usernames, names, and passwords stored as bcrypt hashes.',
      LogoPath: 'https://haveibeenpwned.com/Content/Images/PwnedLogos/Canva.png',
      DataClasses: ['Email addresses', 'Geographic locations', 'Names', 'Passwords', 'Usernames'],
      IsVerified: true,
      IsFabricated: false,
      IsSensitive: false,
      IsRetired: false,
      IsSpamList: false,
    },
    {
      Name: 'Dropbox',
      Title: 'Dropbox',
      Domain: 'dropbox.com',
      BreachDate: '2012-07-01',
      AddedDate: '2016-08-31T00:31:47Z',
      ModifiedDate: '2016-08-31T00:31:47Z',
      PwnCount: 68648009,
      Description:
        'In mid-2012, Dropbox suffered a breach containing 68 million unique email addresses and salted SHA1/bcrypt hashed passwords.',
      LogoPath: 'https://haveibeenpwned.com/Content/Images/PwnedLogos/Dropbox.png',
      DataClasses: ['Email addresses', 'Passwords'],
      IsVerified: true,
      IsFabricated: false,
      IsSensitive: false,
      IsRetired: false,
      IsSpamList: false,
    },
    {
      Name: 'LinkedIn',
      Title: 'LinkedIn',
      Domain: 'linkedin.com',
      BreachDate: '2012-05-05',
      AddedDate: '2016-05-18T03:08:29Z',
      ModifiedDate: '2016-05-18T03:08:29Z',
      PwnCount: 164611595,
      Description:
        'In May 2016, LinkedIn had 164 million email addresses and passwords exposed. The breach occurred in 2012 and surfaced years later.',
      LogoPath: 'https://haveibeenpwned.com/Content/Images/PwnedLogos/LinkedIn.png',
      DataClasses: ['Email addresses', 'Passwords'],
      IsVerified: true,
      IsFabricated: false,
      IsSensitive: false,
      IsRetired: false,
      IsSpamList: false,
    },
  ],
};

export async function checkEmailBreaches(email: string): Promise<{
  breaches: HIBPBreach[];
  isLive: boolean;
  status: 'ok' | 'no_breaches' | 'api_error' | 'mock';
  message: string;
}> {
  const cleanEmail = email.trim().toLowerCase();

  // If live HIBP API Key is configured
  if (HIBP_API_KEY && !HIBP_API_KEY.includes('your-')) {
    try {
      const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(
        cleanEmail
      )}?truncateResponse=false`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'hibp-api-key': HIBP_API_KEY,
          'user-agent': 'MailCleaner-OSINT/1.0 (+https://github.com/eyad/mail-cleaner)',
        },
      });

      if (res.status === 404) {
        return {
          breaches: [],
          isLive: true,
          status: 'no_breaches',
          message: `Good news — no known pwnage found for ${cleanEmail} on Have I Been Pwned!`,
        };
      }

      if (res.ok) {
        const data = (await res.json()) as HIBPBreach[];
        return {
          breaches: data,
          isLive: true,
          status: 'ok',
          message: `Found ${data.length} breaches associated with ${cleanEmail}.`,
        };
      }

      console.warn(`HIBP API returned status ${res.status}`);
    } catch (err) {
      console.error('Failed to query Have I Been Pwned API:', err);
    }
  }

  // Fallback demo/catalog lookup
  const fallback = KNOWN_HISTORICAL_BREACHES[cleanEmail] || KNOWN_HISTORICAL_BREACHES['user@example.com'];
  return {
    breaches: fallback,
    isLive: false,
    status: 'mock',
    message: HIBP_API_KEY
      ? 'HIBP query returned simulated historical catalog.'
      : 'Demo Breach Catalog active. (Provide HIBP_API_KEY in .env.local for live verified queries).',
  };
}
