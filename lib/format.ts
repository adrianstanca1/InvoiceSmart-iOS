// Format helpers — single source of truth for converting backend
// DECIMAL strings to UI-friendly numbers and money/date strings.
//
// The backend returns all amounts and rates as `DECIMAL(12,2)`
// stringified (e.g. "1500.00"). Anywhere a screen does arithmetic on
// these, it MUST go through `toNum()` first or it'll silently get the
// wrong answer (`"5" + 3 === "53"`).

import type { InvoiceStatus, TransactionType, UserProfile } from '../types';

export function toNum(s: string | number | null | undefined): number {
  if (s == null) return 0;
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function currencySymbol(code: string | null | undefined): string {
  switch (code) {
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'USD': return '$';
    default: return code || '';
  }
}

export function fmtMoney(
  s: string | number | null | undefined,
  currency: string = 'GBP'
): string {
  const n = toNum(s);
  const symbol = currencySymbol(currency);
  // Format with two decimals + thousands separator
  const formatted = n.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function fmtPercent(s: string | number | null | undefined): string {
  return `${toNum(s).toFixed(2)}%`;
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partial: 'Partial',
  paid: 'Paid',
};

export function statusLabel(s: InvoiceStatus | string | null | undefined): string {
  if (!s) return '';
  return STATUS_LABELS[s as InvoiceStatus] || s;
}

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
};

export function statusClasses(s: InvoiceStatus | string | null | undefined): string {
  if (!s) return STATUS_CLASSES.draft;
  return STATUS_CLASSES[s as InvoiceStatus] || STATUS_CLASSES.draft;
}

const TXN_LABELS: Record<TransactionType, string> = {
  expense: 'Expense',
  payment: 'Payment',
};

export function txnLabel(t: TransactionType | string | null | undefined): string {
  if (!t) return '';
  return TXN_LABELS[t as TransactionType] || t;
}

export function displayName(
  u: Pick<UserProfile, 'first_name' | 'last_name' | 'email'> | null | undefined
): string {
  if (!u) return '';
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return full || u.email;
}

// Best-effort date formatter for "YYYY-MM-DD" or ISO timestamps.
// Returns the input unchanged on failure rather than NaN/Invalid Date.
export function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}
