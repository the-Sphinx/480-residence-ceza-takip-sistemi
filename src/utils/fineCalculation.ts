import type { Fine, InfractionType, FineAmount } from '@/types';

const TIER_LABELS = [
  'Birinci Kademe Yaptırım',
  'İkinci Kademe Yaptırım',
  'Üçüncü Kademe Yaptırım',
  'Dördüncü Kademe Yaptırım',
  'Beşinci Kademe Yaptırım',
];

export function getTierLabel(tierIndex: number): string {
  return TIER_LABELS[Math.min(Math.max(tierIndex, 0), TIER_LABELS.length - 1)];
}

export function getFineTypeLabel(amountLabel: string): string {
  if (amountLabel) {
    return amountLabel.charAt(0).toUpperCase() + amountLabel.slice(1);
  }
  return 'Maddi yaptırım';
}

/**
 * Calculate the fine amount for a new fine based on escalating tiers.
 * Counts how many non-deleted fines of the same infractionTypeId exist
 * for this tenant within the current calendar year (resets on Jan 1).
 */
export function calculateFineAmount(
  tenantId: string,
  infractionTypeId: string,
  existingFines: Fine[],
  infraction: InfractionType,
): { amount: FineAmount; tierIndex: number } {
  const currentYear = new Date().getFullYear();
  const cutoffStr = `${currentYear}-01-01`;

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
