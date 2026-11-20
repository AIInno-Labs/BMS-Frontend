/** Format money stored as integer cents using an ISO 4217 currency code. */

const DEFAULT_CURRENCY = "AUD";

/** Currencies offered when creating / editing an organization. */
export const ORG_CURRENCY_OPTIONS = [
  "AUD",
  "USD",
  "NZD",
  "GBP",
  "EUR",
  "INR",
  "SAR",
  "AED",
  "CAD",
] as const;

export type OrgCurrencyCode = (typeof ORG_CURRENCY_OPTIONS)[number];

export function resolveCurrencyCode(code?: string | null): string {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed || trimmed.length !== 3) {
    return DEFAULT_CURRENCY;
  }
  try {
    // Throws RangeError for unknown codes — keep the default so CRM never blanks.
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: trimmed,
    }).format(0);
    return trimmed;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function fromCents(cents?: number | null): number {
  return (cents ?? 0) / 100;
}

export function formatMoney(
  amount: number,
  currencyCode?: string | null
): string {
  const currency = resolveCurrencyCode(currencyCode);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatMoneyFromCents(
  cents?: number | null,
  currencyCode?: string | null
): string {
  return formatMoney(fromCents(cents), currencyCode);
}
