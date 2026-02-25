import type { FineAmount } from '@/types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parse a string like "500", "Uyarı", or "1000 + dava" into a FineAmount.
 */
export function parseFineAmountString(str: string): FineAmount {
  const trimmed = str.trim();
  if (!trimmed) return { monetary: 0, label: '' };

  // Try "number + label" composite format: "1000 + dava"
  const compositeMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*\+\s*(.+)$/);
  if (compositeMatch) {
    return {
      monetary: parseFloat(compositeMatch[1].replace(',', '.')),
      label: compositeMatch[2].trim(),
    };
  }

  // Try pure numeric: "500", "1000.50"
  const num = parseFloat(trimmed.replace(',', '.'));
  if (!isNaN(num) && /^[\d.,]+$/.test(trimmed)) {
    return { monetary: num, label: '' };
  }

  // Text-only (e.g. "Uyarı")
  return { monetary: 0, label: trimmed };
}

/**
 * Serialize a FineAmount back to string for storage.
 */
export function fineAmountToString(fa: FineAmount): string {
  if (fa.monetary > 0 && fa.label) return `${fa.monetary} + ${fa.label}`;
  if (fa.monetary > 0) return String(fa.monetary);
  if (fa.label) return fa.label;
  return '0';
}

/**
 * Format a FineAmount for display.
 */
export function formatFineAmount(fa: FineAmount): string {
  if (fa.monetary > 0 && fa.label) return `${formatCurrency(fa.monetary)} + ${fa.label}`;
  if (fa.monetary > 0) return formatCurrency(fa.monetary);
  if (fa.label) return fa.label;
  return formatCurrency(0);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function toISODate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}
