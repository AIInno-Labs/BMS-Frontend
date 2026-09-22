/**
 * TODO(api): There is no payments/invoicing ledger API yet — `Job` has no
 * monetary field at all, and the one real payment-adjacent signal on the
 * backend, `printDetails.accountYesNo` (cash vs. account customer), lives on
 * the full job card only. `GET /jobs` (the list projection `JobsContext`
 * loads) omits `printDetails` for size, so it isn't available in bulk here —
 * fetching it per customer would mean one `GET /jobs/{id}` per job just to
 * read a boolean.
 *
 * Everything in this file is a placeholder estimate, seeded from real
 * accepted-quote totals so at least the *scale* of the numbers is grounded.
 * Replace it once either (a) `accountYesNo` is exposed on the jobs list
 * projection, or (b) a real payments/invoicing endpoint exists — at that
 * point CrmPage.tsx and CustomersListPage.tsx should fetch real figures
 * instead of calling these.
 */

/** Deterministic placeholder for a customer's payment mode. */
export function estimatePaymentMode(companyName: string): "Cash" | "Account" {
  let hash = 0;
  for (let i = 0; i < companyName.length; i++) {
    hash = (hash * 31 + companyName.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 5 === 0 ? "Cash" : "Account";
}

export interface EstimatedPayments {
  received: number;
  outstanding: number;
  /** 6 months of received-amount estimates, oldest first. */
  monthlyReceived: number[];
}

const MONTHLY_WEIGHTS = [0.12, 0.14, 0.16, 0.18, 0.19, 0.21];

/** Estimates a received/outstanding split from a real accepted-quotes total. */
export function estimatePayments(acceptedQuotesValue: number): EstimatedPayments {
  const received = Math.round(acceptedQuotesValue * 0.82);
  const outstanding = Math.max(acceptedQuotesValue - received, 0);
  const monthlyReceived = MONTHLY_WEIGHTS.map((w) => Math.round(received * w));
  return { received, outstanding, monthlyReceived };
}
