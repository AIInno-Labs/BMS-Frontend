import fs from "node:fs";
import path from "node:path";

import type { OfficialJobCardData } from "@/lib/jobCardPrint";
import { officialDataToFieldValues } from "@/lib/jobCardPdfFieldMap";

const HTML_FIELD_IDS_ALLOW_RAW = new Set([
  "scopeLines",
  "notes",
  "deliveryInstructions",
]);

let cachedTemplate: string | null = null;

function loadPdfTemplate(): string {
  // Always re-read in development so pdf.html edits show up without a restart.
  if (process.env.NODE_ENV !== "production" || !cachedTemplate) {
    cachedTemplate = fs.readFileSync(
      path.join(process.cwd(), "pdf.html"),
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

export type JobCardPrintHtmlOptions = {
  /** Opens the browser print dialog when the page loads. */
  autoprint?: boolean;
};

/** Fills `pdf.html` bindings from official print data. */
export function buildJobCardPrintHtml(
  data: OfficialJobCardData,
  options?: JobCardPrintHtmlOptions
): string {
  let html = loadPdfTemplate();

  const logoSrc = "/frp-logo-lockup-trimmed.png";
  html = html.replace(
    "./public/frp-logo-lockup-trimmed.png",
    logoSrc
  );

  const values = officialDataToFieldValues(data);
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
