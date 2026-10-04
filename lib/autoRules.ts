import { EmailMetadata } from './types';

export interface AutoDeleteRule {
  id: string;
  target: 'sender' | 'domain';
  pattern: string; // sender email (lowercase) or domain (lowercase)
  senderName: string;
  action: 'trash' | 'trash_and_unsub';
  enabled: boolean;
  createdAt: string;
  deletedCount: number;
  category?: string;
}

const STORAGE_KEY = 'mailcleaner_auto_rules_v1';

export function getAutoRules(): AutoDeleteRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AutoDeleteRule[];
  } catch (err) {
    console.error('Failed to load auto-delete rules from localStorage:', err);
    return [];
  }
}

export function saveAutoRule(
  ruleData: Omit<AutoDeleteRule, 'id' | 'createdAt' | 'deletedCount'>
): AutoDeleteRule {
  const existing = getAutoRules();
  const patternClean = ruleData.pattern.toLowerCase().trim();

  // Check if rule already exists for this pattern
  const existingIdx = existing.findIndex(
    (r) => r.target === ruleData.target && r.pattern.toLowerCase() === patternClean
  );

  let updatedRule: AutoDeleteRule;

  if (existingIdx >= 0) {
    updatedRule = {
      ...existing[existingIdx],
      ...ruleData,
      pattern: patternClean,
      enabled: true,
    };
    existing[existingIdx] = updatedRule;
  } else {
    updatedRule = {
      ...ruleData,
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      pattern: patternClean,
      createdAt: new Date().toISOString(),
      deletedCount: 0,
    };
    existing.unshift(updatedRule);
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (err) {
      console.error('Failed to save auto-delete rule:', err);
    }
  }

  return updatedRule;
}

export function saveBulkAutoRules(
  rulesData: Array<Omit<AutoDeleteRule, 'id' | 'createdAt' | 'deletedCount'>>
): AutoDeleteRule[] {
  const results: AutoDeleteRule[] = [];
  for (const r of rulesData) {
    results.push(saveAutoRule(r));
  }
  return results;
}

export function deleteAutoRule(id: string): void {
  const existing = getAutoRules().filter((r) => r.id !== id);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (err) {
      console.error('Failed to remove auto-delete rule:', err);
    }
  }
}

export function toggleAutoRule(id: string): boolean {
  const existing = getAutoRules();
  const target = existing.find((r) => r.id === id);
  if (!target) return false;

  target.enabled = !target.enabled;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (err) {
      console.error('Failed to toggle auto-delete rule:', err);
    }
  }
  return target.enabled;
}

export function recordRuleDeletions(ruleIdsWithCounts: Record<string, number>): void {
  const existing = getAutoRules();
  let changed = false;

  for (const rule of existing) {
    const addedCount = ruleIdsWithCounts[rule.id];
    if (addedCount && addedCount > 0) {
      rule.deletedCount += addedCount;
      changed = true;
    }
  }

  if (changed && typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (err) {
      console.error('Failed to update rule deletion counts:', err);
    }
  }
}

export interface RuleMatchResult {
  matchedEmailIds: string[];
  matchedEmails: EmailMetadata[];
  ruleSummary: Array<{
    rule: AutoDeleteRule;
    count: number;
    emailIds: string[];
  }>;
}

export function evaluateAutoDeleteRules(
  emails: EmailMetadata[],
  rules?: AutoDeleteRule[]
): RuleMatchResult {
  const activeRules = (rules ?? getAutoRules()).filter((r) => r.enabled);
  if (activeRules.length === 0 || emails.length === 0) {
    return { matchedEmailIds: [], matchedEmails: [], ruleSummary: [] };
  }

  const allMatchedIds = new Set<string>();
  const allMatchedEmails: EmailMetadata[] = [];
  const summary: RuleMatchResult['ruleSummary'] = [];

  for (const rule of activeRules) {
    const pattern = rule.pattern.toLowerCase();
    const matchedForThisRule: EmailMetadata[] = [];

    for (const email of emails) {
      let isMatch = false;
      if (rule.target === 'sender') {
        isMatch = email.senderEmail.toLowerCase() === pattern;
      } else if (rule.target === 'domain') {
        isMatch =
          email.senderDomain.toLowerCase() === pattern ||
          email.senderEmail.toLowerCase().endsWith(`@${pattern}`);
      }

      if (isMatch) {
        matchedForThisRule.push(email);
        if (!allMatchedIds.has(email.id)) {
          allMatchedIds.add(email.id);
          allMatchedEmails.push(email);
        }
      }
    }

    if (matchedForThisRule.length > 0) {
      summary.push({
        rule,
        count: matchedForThisRule.length,
        emailIds: matchedForThisRule.map((e) => e.id),
      });
    }
  }

  return {
    matchedEmailIds: Array.from(allMatchedIds),
    matchedEmails: allMatchedEmails,
    ruleSummary: summary,
  };
}
