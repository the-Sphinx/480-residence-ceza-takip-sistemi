import type { Fine, InfractionType, FineAmount } from '@/types';

const REPEAT_PERIOD_KEY = 'ceza_repeat_period_months';
const DEFAULT_REPEAT_PERIOD = 12;

export function getRepeatPeriod(): number {
  const stored = localStorage.getItem(REPEAT_PERIOD_KEY);
  if (stored) {
    const val = parseInt(stored, 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return DEFAULT_REPEAT_PERIOD;
}

export function setRepeatPeriod(months: number): void {
  localStorage.setItem(REPEAT_PERIOD_KEY, String(months));
}

/**
 * Calculate the fine amount for a new fine based on escalating tiers.
 * Counts how many non-deleted fines of the same infractionTypeId exist
 * for this tenant within the repeat period.
 */
export function calculateFineAmount(
  tenantId: string,
  infractionTypeId: string,
  existingFines: Fine[],
  infraction: InfractionType,
  repeatPeriodMonths?: number,
): { amount: FineAmount; tierIndex: number } {
  const period = repeatPeriodMonths ?? getRepeatPeriod();
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - period);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const priorCount = existingFines.filter(
    (f) =>
      f.tenantId === tenantId &&
      f.infractionTypeId === infractionTypeId &&
      !f.isDeleted &&
      f.date >= cutoffStr,
  ).length;

  // Index capped at 4 (5th+ tier)
  const tierIndex = Math.min(priorCount, 4);
  const amount = infraction.fineAmounts[tierIndex] ?? infraction.fineAmounts[0] ?? { monetary: 0, label: '' };

  return { amount, tierIndex };
}
