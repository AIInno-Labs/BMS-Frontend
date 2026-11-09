import { ensureWorkflowExtras } from "@/lib/jobWorkflowExtras";
import type { Job } from "@/lib/types";

/** Matches backend {@code JobCashPaymentGuard.BLOCK_MESSAGE}. */
export const CASH_PAYMENT_BLOCK_MESSAGE =
  "Cash payment is required before this job can be changed. Mark the payment done first.";

/** From {@code JobDTO.requirements} on {@code GET /jobs/{id}} (server-owned list). */
export function isCashPaymentRequired(job: Job): boolean {
  return (job.requirements ?? []).some(
    (row) => row.kind === "CASH_PAYMENT_REQUIRED" && row.isRequired === true
  );
}

/** From the job's primary payment row, mapped to {@code workflowExtras.paymentReceived}. */
export function isJobPaymentReceived(job: Job): boolean {
  const extras = ensureWorkflowExtras(job.printDetails?.workflowExtras, job);
  return extras.paymentReceived === true;
}

/** Job workflow edits are frozen until cash is recorded (payment API still allowed). */
export function isJobLockedForCashPayment(job: Job): boolean {
  return isCashPaymentRequired(job) && !isJobPaymentReceived(job);
}
