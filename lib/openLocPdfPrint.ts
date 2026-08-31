import { stampExportTimestamp } from "@/lib/exportTimestamp";

export interface PrintLocResult {
  /** Set when the export succeeded but some required field was still
   *  blank — same text the PDF itself shows in its warning banner. */
  warning?: string;
}

/**
 * Loads the Letter of Compliance HTML and opens the print dialog in the
 * current tab (hidden iframe — no new tab / pop-up). Mirrors
 * `printJobCardPdf` in `openJobCardPdfPrint.ts`, minus the dynamic one-page
 * fitting — `loc.html` is short enough to fit one A4 page from its own
 * `@page` margin rules alone.
 *
 * Never blocks on incomplete data — the route always returns a document;
 * an incomplete one carries an `X-Loc-Warning` header, surfaced here as the
 * resolved `warning` rather than a thrown error.
 */
export async function printLocPdf(jobId: string): Promise<PrintLocResult> {
  const url = `/api/jobs/${encodeURIComponent(jobId)}/loc-html`;
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("frp_access_token")
      : null;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      (body && typeof body.error === "string" && body.error) ||
        "Could not load Letter of Compliance for printing."
    );
  }

  const warningHeader = response.headers.get("X-Loc-Warning");
  const warning = warningHeader ? decodeURIComponent(warningHeader) : undefined;

  const html = await response.text();

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Letter of Compliance print");
  iframe.style.cssText =
    "position:fixed;left:0;top:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => {
    iframe.remove();
  };

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    cleanup();
    throw new Error("Print frame unavailable.");
  }

  doc.open();
  doc.write(html);
  doc.close();
  stampExportTimestamp(doc, ".loc-watermark");

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    iframe.addEventListener("load", done, { once: true });
    if (doc.readyState === "complete") {
      done();
    } else {
      setTimeout(done, 600);
    }
  });

  const images = Array.from(doc.images);
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    )
  );

  await new Promise<void>((resolve) => {
    const finish = () => {
      cleanup();
      resolve();
    };
    win.addEventListener("afterprint", finish, { once: true });
    win.focus();
    win.print();
    setTimeout(finish, 120_000);
  });

  return { warning };
}
