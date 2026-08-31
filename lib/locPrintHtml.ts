import fs from "node:fs";
import path from "node:path";

import type { OfficialLocData } from "@/lib/buildLocData";

let cachedTemplate: string | null = null;

function loadLocTemplate(): string {
  // Always re-read in development so loc.html edits show up without a restart.
  if (process.env.NODE_ENV !== "production" || !cachedTemplate) {
    cachedTemplate = fs.readFileSync(
      path.join(process.cwd(), "loc.html"),
      "utf8"
    );
  }
  return cachedTemplate;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HTML_FIELD_IDS_ALLOW_RAW = new Set(["materialsList", "additionalNotes"]);

function fillDataJc(html: string, id: string, raw: string): string {
  const value = HTML_FIELD_IDS_ALLOW_RAW.has(id)
    ? raw.replace(/\n/g, "<br>")
    : escapeHtml(raw);
  const pattern = new RegExp(
    `(<[^>]*\\bdata-jc="${escapeRegex(id)}"[^>]*>)([\\s\\S]*?)(</[^>]+>)`,
    "i"
  );
  return html.replace(pattern, `$1${value}$3`);
}

function officialLocDataToFieldValues(data: OfficialLocData): Record<string, string> {
  return {
    jobNumber: data.jobNumber,
    jobNumberFooter: data.jobNumber,
    documentDate: data.documentDate,
    manufactureDate: data.manufactureDate,
    workshopAddress: data.workshopAddress,
    materialsList: data.materialsList,
    additionalNotes: data.additionalNotes,
    confirmedByName: data.confirmedByName,
    warningBanner: data.warningBanner,
    // Same person as the confirmation line above, and the QC sign-off date
    // (not today's export date) — repeated under separate ids since a
    // `data-jc` id can only be filled once per document.
    signName: data.confirmedByName,
    dateSigned: data.manufactureDate,
  };
}

export type LocPrintHtmlOptions = {
  /** Opens the browser print dialog when the page loads. */
  autoprint?: boolean;
};

/** Fills `loc.html` bindings from official LOC data. */
export function buildLocPrintHtml(
  data: OfficialLocData,
  options?: LocPrintHtmlOptions
): string {
  let html = loadLocTemplate();

  html = html.replace(
    "./public/frp-logo-lockup-trimmed.png",
    "/frp-logo-lockup-trimmed.png"
  );

  const values = officialLocDataToFieldValues(data);
  for (const [id, value] of Object.entries(values)) {
    html = fillDataJc(html, id, value);
  }

  if (options?.autoprint) {
    html = html.replace(
      "</body>",
      `<script>
window.addEventListener("load",function(){
  window.focus();
  window.print();
  window.addEventListener("afterprint",function(){window.close();});
});
</script></body>`
    );
  }

  return html;
}
