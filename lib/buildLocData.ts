import type { Job } from "@/lib/types";
import { formatJobCardDate } from "@/lib/jobCardPrint";
import type { QcSignoff } from "@/lib/frp/job-mapper";

export interface OfficialLocData {
  jobNumber: string;
  documentDate: string;
  manufactureDate: string;
  workshopAddress: string;
  materialsList: string;
  /** Empty when blank — rendered as a hidden (not "—") section, since notes
   *  are supplementary, not a required field. */
  additionalNotes: string;
  confirmedByName: string;
  /** Empty when nothing is missing; otherwise the text shown on the PDF
   *  itself and, verbatim, in the job-page banner after export. */
  warningBanner: string;
}

/** Joins an organization's address fields into one display line. */
export function formatWorkshopAddress(org: {
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string {
  return [org.address, org.city, org.postalCode, org.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Shapes the data for `loc.html`. Manufacture date and confirming name both
 * come from `qcSignoff` — the job's `STAGE_COMPLETED`/`qc` audit row (see
 * `getQcSignoff` in `job-mapper.ts`) — not the person exporting the PDF.
 *
 * Materials come from `job.measurements` (`GET /jobs/{id}` →
 * `job_measurements`), mapped into `workflowExtras.materialsList` /
 * `additionalNotes`. Older jobs may still carry the same fields on
 * `jobCard` until re-saved via the materials panel.
 *
 * Nothing here blocks export: whatever is missing renders as "—" and is
 * listed in `warningBanner` instead, so the certificate always generates —
 * see the module doc for why.
 */
export function buildOfficialLocData(
  job: Job,
  opts: {
    qcSignoff: QcSignoff;
    workshopAddress: string;
  }
): OfficialLocData {
  const extras = job.printDetails?.workflowExtras;
  const now = new Date().toISOString();

  const manufactureDate = opts.qcSignoff.occurredAt
    ? formatJobCardDate(opts.qcSignoff.occurredAt)
    : "—";
  const workshopAddress = opts.workshopAddress || "—";
  const materialsList = extras?.materialsList?.trim() || "—";
  const additionalNotes = extras?.additionalNotes?.trim() || "";
  const confirmedByName = opts.qcSignoff.name || "—";

  const missing: string[] = [];
  if (manufactureDate === "—") {
    missing.push("manufacture date — no QC sign-off found in the audit log");
  }
  if (workshopAddress === "—") {
    missing.push("workshop address — set the organization's address");
  }
  if (materialsList === "—") {
    missing.push(
      'material specifications — fill in "Edit materials & specifications" on the job card'
    );
  }
  if (confirmedByName === "—") {
    missing.push("confirming name — no QC sign-off found in the audit log");
  }

  return {
    jobNumber: job.id || "—",
    documentDate: formatJobCardDate(now),
    manufactureDate,
    workshopAddress,
    materialsList,
    additionalNotes,
    confirmedByName,
    warningBanner:
      missing.length > 0
        ? `Incomplete — please complete: ${missing.join("; ")}.`
        : "",
  };
}
