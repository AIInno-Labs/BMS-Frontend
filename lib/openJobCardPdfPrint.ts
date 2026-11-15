import { stampExportTimestamp } from "@/lib/exportTimestamp";

const MM_TO_PX = 96 / 25.4;

/** `pdf.html` lays the card out at this width, then it is scaled to the page. */
const CARD_WIDTH_PX = 953;

const PAGE_MARGIN_MM = 2;

/**
 * Room kept free at the bottom of a single-page card for the job number /
 * revision footer.
 */
const FOOTER_RESERVE_PX = 20;

/**
 * Bottom page margin when the card runs onto more than one page. Taller than
 * the 2 mm used elsewhere so the footer and "Page x of y" have room on every
 * sheet.
 */
const MULTI_PAGE_BOTTOM_MARGIN_MM = 7;

/**
 * How much smaller than "fit the page width" the card may be shrunk to keep
 * it on a single sheet (0.9 = at most 10 % smaller). Past that the card flows
 * onto a second page at full size instead - shrinking it further would undo
 * the larger print the workshop asked for.
 */
const MIN_ONE_PAGE_SCALE_RATIO = 0.9;

/** Slightly under 1 so rounding never pushes the right edge off the sheet. */
const WIDTH_SAFETY = 0.99;

export type JobCardPrintLayout = {
  /** `single`: fits one sheet. `multi`: flows onto further pages. */
  mode: "single" | "multi";
  /** Zoom applied to the 953px card. */
  scale: number;
  /** Height of the card at design size, before scaling (px). */
  contentHeight: number;
};

/** A4 portrait printable area. */
function a4PortraitPrintablePx(): { width: number; height: number } {
  const margin = PAGE_MARGIN_MM * MM_TO_PX;
  return {
    width: 210 * MM_TO_PX - margin * 2,
    height: 297 * MM_TO_PX - margin * 2,
  };
}

function measureCardHeight(root: HTMLElement): number {
  return Math.ceil(root.scrollHeight);
}

/**
 * Spread spare page height over the sections people write in or read from
 * (Scope, Notes, Delivery, checklist rows) so a short card still fills the
 * sheet instead of ending halfway down. Only used when the card fits one page.
 */
function growToFill(doc: Document, extraPx: number): void {
  doc.head.querySelector("[data-jc-grow]")?.remove();
  if (extraPx < 8) return;

  const growMinHeight = (selector: string, share: number) => {
    const el = doc.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.style.minHeight = `${el.offsetHeight + Math.round(extraPx * share)}px`;
  };
  growMinHeight(".scope-area", 0.3);
  growMinHeight(".notes-area", 0.36);
  growMinHeight(".delivery-instructions-box", 0.2);

  const sampleCell = doc.querySelector<HTMLElement>(".small-table td");
  const sampleBlock = doc.querySelector<HTMLElement>(".section-block");
  const rowPx = sampleCell?.offsetHeight ?? 19;
  const gapPx = sampleBlock
    ? parseFloat(doc.defaultView?.getComputedStyle(sampleBlock).marginTop ?? "3") || 3
    : 3;

  const photoRowExtra = Math.max(1, Math.round((extraPx * 0.08) / 6));
  const sectionGapExtra = Math.max(1, Math.round((extraPx * 0.06) / 5));

  const style = doc.createElement("style");
  style.setAttribute("data-jc-grow", "1");
  style.textContent = `
    .small-table td, .small-table th { height: ${rowPx + photoRowExtra}px !important; }
    .section-block { margin-top: ${gapPx + sectionGapExtra}px !important; }
  `;
  doc.head.appendChild(style);
}

function cssString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ").trim()}"`;
}

/**
 * Lays the job card out for A4 portrait, preferring one page:
 *
 *  1. Scale the 953px card to the page width. If it fits the page height,
 *     spare room is shared out to Scope / Notes / Delivery so it fills the sheet.
 *  2. If it is a little too tall, shrink it - but by no more than
 *     {@link MIN_ONE_PAGE_SCALE_RATIO} - to keep it on one sheet.
 *  3. Otherwise keep the full-size text and let the card flow onto a second
 *     page (sections break between pages; Scope, Inventory and Notes may split).
 *
 * Sizes and word wrapping live in `pdf.html`; this only measures and scales.
 */
export function fitJobCardForPrint(doc: Document): JobCardPrintLayout | null {
  const root =
    (doc.querySelector(".jc-print-root") as HTMLElement | null) ??
    (doc.querySelector(".jobcard") as HTMLElement | null);
  if (!root) return null;

  doc.head.querySelector("[data-jc-fit]")?.remove();
  doc.head.querySelector("[data-jc-grow]")?.remove();
  root.style.removeProperty("zoom");
  root.style.width = `${CARD_WIDTH_PX}px`;

  const { width: pageW, height: pageH } = a4PortraitPrintablePx();
  const usablePageH = pageH - FOOTER_RESERVE_PX;
  const scaleW = (pageW / CARD_WIDTH_PX) * WIDTH_SAFETY;

  let contentH = measureCardHeight(root);
  if (contentH <= 0) return null;

  let mode: JobCardPrintLayout["mode"];
  let scale = scaleW;

  if (contentH * scaleW <= usablePageH) {
    mode = "single";
    growToFill(doc, Math.round(usablePageH / scaleW - contentH));
    contentH = measureCardHeight(root);
    scale = Math.min(scaleW, usablePageH / contentH);
  } else {
    const oneSheetScale = usablePageH / contentH;
    if (oneSheetScale >= scaleW * MIN_ONE_PAGE_SCALE_RATIO) {
      mode = "single";
      scale = oneSheetScale;
    } else {
      mode = "multi";
    }
  }

  let viewport = doc.querySelector(".jc-print-viewport") as HTMLElement | null;
  if (!viewport) {
    viewport = doc.createElement("div");
    viewport.className = "jc-print-viewport";
    root.parentNode?.insertBefore(viewport, root);
    viewport.appendChild(root);
  }

  const applyLayout = (layoutMode: JobCardPrintLayout["mode"], zoom: number) => {
    doc.head.querySelector("[data-jc-fit]")?.remove();
    root.style.removeProperty("zoom");

    const style = doc.createElement("style");
    style.setAttribute("data-jc-fit", "1");

    // `zoom` (not `transform`) so the scaled card takes up its scaled height in
    // the layout - that is what lets the browser paginate it correctly.
    const rootRules = `
    .jc-print-root {
      width: ${CARD_WIDTH_PX}px !important;
      zoom: ${zoom} !important;
      margin: 0 auto !important;
      transform: none !important;
      position: static !important;
    }`;

    if (layoutMode === "single") {
      style.textContent = `
    @page { size: A4 portrait; margin: ${PAGE_MARGIN_MM}mm; }
    html, body {
      width: ${pageW}px !important;
      height: ${pageH}px !important;
      max-height: ${pageH}px !important;
      margin: 0 auto !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    .jc-print-viewport {
      width: ${pageW}px !important;
      height: ${pageH}px !important;
      overflow: hidden !important;
      margin: 0 auto !important;
      position: relative !important;
    }${rootRules}`;
    } else {
      const footer =
        doc.querySelector(".jc-watermark")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      style.textContent = `
    @page {
      size: A4 portrait;
      margin: ${PAGE_MARGIN_MM}mm ${PAGE_MARGIN_MM}mm ${MULTI_PAGE_BOTTOM_MARGIN_MM}mm;
      @bottom-left {
        content: ${cssString(footer)};
        font: 600 8px Arial, sans-serif;
        color: rgba(47, 49, 56, 0.55);
        vertical-align: top;
        padding-top: 1mm;
      }
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font: 600 8px Arial, sans-serif;
        color: rgba(47, 49, 56, 0.55);
        vertical-align: top;
        padding-top: 1mm;
      }
    }
    html, body {
      width: ${pageW}px !important;
      height: auto !important;
      margin: 0 auto !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    .jc-print-viewport {
      width: ${pageW}px !important;
      height: auto !important;
      overflow: visible !important;
      margin: 0 auto !important;
    }
    .jc-watermark { display: none !important; }${rootRules}`;
    }
    doc.head.appendChild(style);
  };

  applyLayout(mode, scale);

  if (mode === "single") {
    // Text rounds slightly differently at a fractional zoom, so the real laid
    // out height can come out a few px taller than contentH * scale. Check it
    // and nudge the zoom down until the card clears the footer. (Only trust
    // readings that are plausibly zoomed, i.e. smaller than the unscaled card.)
    for (let i = 0; i < 3; i++) {
      const laidOutH = root.getBoundingClientRect().height;
      if (laidOutH <= usablePageH || laidOutH >= contentH) break;
      scale *= (usablePageH / laidOutH) * 0.998;
      root.style.setProperty("zoom", String(scale), "important");
    }

    // The correction must never take us below the shrink limit: past it the
    // card is better off at full size on a second page.
    if (scale < scaleW * MIN_ONE_PAGE_SCALE_RATIO) {
      mode = "multi";
      scale = scaleW;
      applyLayout(mode, scale);
    }
  }

  return { mode, scale, contentHeight: contentH };
}

/**
 * Loads the job card HTML and opens the print dialog in the current tab
 * (hidden iframe — no new tab / pop-up). The card prints on one page when it
 * fits and runs onto a second page when the content needs it.
 */
export async function printJobCardPdf(jobId: string): Promise<void> {
  const url = `/api/jobs/${encodeURIComponent(jobId)}/job-card-html`;
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("frp_access_token")
      : null;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Could not load job card for printing.");
  }

  const html = await response.text();

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Job card print");
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
  stampExportTimestamp(doc, ".jc-watermark");

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
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => resolve());
    });
  });

  fitJobCardForPrint(doc);

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
}

/** @deprecated Use printJobCardPdf */
export function openJobCardPdfPrint(jobId: string): void {
  void printJobCardPdf(jobId).catch((err) => {
    // Callers should prefer async printJobCardPdf + in-app error UI.
    // Avoid window.alert — surface via console for any leftover call sites.
    console.error(
      err instanceof Error ? err.message : "Failed to prepare job card PDF."
    );
  });
}
