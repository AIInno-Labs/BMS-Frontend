const MM_TO_PX = 96 / 25.4;

/** A4 portrait printable area (2 mm margins). */
function a4PortraitPrintablePx(): { width: number; height: number } {
  const margin = 2 * MM_TO_PX;
  return {
    width: 210 * MM_TO_PX - margin * 2,
    height: 297 * MM_TO_PX - margin * 2,
  };
}

/**
 * Compact rules so measurement matches print output
 * (@media print is not active until the print dialog opens).
 */
function injectPrePrintLayout(doc: Document): void {
  if (doc.head.querySelector("[data-jc-preprint]")) return;

  const style = doc.createElement("style");
  style.setAttribute("data-jc-preprint", "1");
  style.textContent = `
    body.jc-print { padding: 0 !important; margin: 0 !important; }
    .section-body { padding: 2px 0 !important; }
    .section-body--photos,
    .section-body--delivery,
    .section-body--scope { padding: 2px 6px 3px !important; }
    .section-block { margin-top: 2px !important; }
    .scope-area { height: auto !important; min-height: 88px !important; }
    .scope-text { min-height: 72px !important; }
    .notes-area { height: 36px !important; min-height: 36px !important; }
    .delivery-instructions-box { height: 36px !important; min-height: 36px !important; }
    .notice-table td { height: 26px !important; }
    .small-table td, .small-table th,
    .clips-table td, .clips-table th,
    .spec-table td, .spec-table th {
      height: 11px !important;
      font-size: 6.5px !important;
      padding: 0 2px !important;
      line-height: 1.05 !important;
    }
    .section-title { padding: 2px 8px !important; font-size: 8.5px !important; }
    .scope-text { font-size: 7.5px !important; padding: 2px 6px !important; }
    .delivery-pack-title { font-size: 8px !important; margin-bottom: 1px !important; }
    .delivery-pack-table td {
      font-size: 7.5px !important;
      line-height: 1.35 !important;
      padding: 2px 0 3px !important;
    }
    .delivery-pack-table tr:first-child td {
      padding: 0 0 3px !important;
    }
  `;
  doc.head.appendChild(style);
}

/** Grow vertical sections so the card fills portrait page height. */
function injectVerticalGrowth(doc: Document, extraPx: number): void {
  doc.head.querySelector("[data-jc-grow]")?.remove();
  if (extraPx < 8) return;

  const scope = Math.round(extraPx * 0.3);
  const notes = Math.round(extraPx * 0.36);
  const delivery = Math.round(extraPx * 0.2);
  const photoRow = Math.max(1, Math.round((extraPx * 0.08) / 6));
  const sectionGap = Math.max(1, Math.round((extraPx * 0.06) / 5));

  const style = doc.createElement("style");
  style.setAttribute("data-jc-grow", "1");
  style.textContent = `
    .scope-area { min-height: ${88 + scope}px !important; }
    .scope-text { min-height: ${72 + scope}px !important; }
    .notes-area {
      height: ${36 + notes}px !important;
      min-height: ${36 + notes}px !important;
    }
    .delivery-instructions-box {
      height: ${36 + delivery}px !important;
      min-height: ${36 + delivery}px !important;
    }
    .small-table td, .small-table th {
      height: ${11 + photoRow}px !important;
    }
    .section-block { margin-top: ${2 + sectionGap}px !important; }
  `;
  doc.head.appendChild(style);
}

function measureRoot(root: HTMLElement): { width: number; height: number } {
  return {
    width: root.offsetWidth || 953,
    height: root.scrollHeight,
  };
}

/**
 * Portrait A4: scale to page width, grow vertical areas, then scale to fill
 * one page without a trailing blank sheet.
 */
function fitJobCardToOnePage(doc: Document): void {
  const root =
    (doc.querySelector(".jc-print-root") as HTMLElement | null) ??
    (doc.querySelector(".jobcard") as HTMLElement | null);
  if (!root) return;

  injectPrePrintLayout(doc);

  const { width: pageW, height: pageH } = a4PortraitPrintablePx();
  // Minimal reserve for watermark + print rounding.
  const usablePageH = pageH - 8;
  const safety = 0.99;

  let { width: contentW, height: contentH } = measureRoot(root);
  if (contentW <= 0 || contentH <= 0) return;

  const scaleW = (pageW / contentW) * safety;
  const scaledH = contentH * scaleW;

  // Grow vertical sections to fill portrait height (top → bottom marks).
  const fillTarget = 1;
  if (scaledH < usablePageH * fillTarget) {
    const targetContentH = (usablePageH * fillTarget) / scaleW;
    const extraPx = Math.round(targetContentH - contentH);
    injectVerticalGrowth(doc, extraPx);
    contentH = measureRoot(root).height;
  }

  const scale = Math.min(scaleW, usablePageH / contentH);

  const scaledW = contentW * scale;
  const finalScaledH = contentH * scale;
  const offsetX = Math.max(0, (pageW - scaledW) / 2);
  // Pin near top so expanded content reaches further up and down.
  const offsetY = 2;

  let viewport = doc.querySelector(".jc-print-viewport") as HTMLElement | null;
  if (!viewport) {
    viewport = doc.createElement("div");
    viewport.className = "jc-print-viewport";
    root.parentNode?.insertBefore(viewport, root);
    viewport.appendChild(root);
  }

  doc.head.querySelector("[data-jc-fit]")?.remove();

  const style = doc.createElement("style");
  style.setAttribute("data-jc-fit", "1");
  style.textContent = `
    @page { size: A4 portrait; margin: 2mm; }
    html, body {
      width: ${pageW}px !important;
      height: ${pageH}px !important;
      max-width: ${pageW}px !important;
      max-height: ${pageH}px !important;
      min-height: 0 !important;
      margin: 0 auto !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    .jc-print-viewport {
      width: ${pageW}px !important;
      height: ${pageH}px !important;
      max-height: ${pageH}px !important;
      overflow: hidden !important;
      margin: 0 auto !important;
      position: relative !important;
    }
    .jc-print-root {
      width: ${contentW}px !important;
      transform: scale(${scale}) !important;
      transform-origin: top left !important;
      position: absolute !important;
      top: ${offsetY}px !important;
      left: ${offsetX}px !important;
    }
    .jc-watermark {
      position: absolute !important;
      bottom: 8px !important;
      left: 10px !important;
      font-size: 7px !important;
      font-weight: 600 !important;
      letter-spacing: 0.04em !important;
      color: rgba(47, 49, 56, 0.38) !important;
      z-index: 5 !important;
      pointer-events: none !important;
    }
  `;
  doc.head.appendChild(style);

  viewport.style.width = `${pageW}px`;
  viewport.style.height = `${pageH}px`;
  viewport.style.maxHeight = `${pageH}px`;
  viewport.style.overflow = "hidden";

  root.style.width = `${contentW}px`;
  root.style.transform = `scale(${scale})`;
  root.style.transformOrigin = "top left";
  root.style.position = "absolute";
  root.style.top = `${offsetY}px`;
  root.style.left = `${offsetX}px`;
}

/**
 * "23 Aug 2026, 2:45 pm GMT+5:30" — the exporting browser's own local date,
 * time and timezone. Computed here (client-side) rather than where the HTML
 * is generated, because that happens on the server and has no way to know
 * which timezone the person exporting is actually in. Whatever short form
 * the browser's own `Intl` gives for the timezone is used as-is — a named
 * code like "AEST" where the browser has one, otherwise its offset form
 * like "GMT+5:30" — no manual per-timezone overrides.
 */
function formatExportTimestamp(): string {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(now);

  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(now);

  const zoneAbbr =
    new Intl.DateTimeFormat("en-US", { timeZoneName: "short", timeZone })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone;

  return `${datePart}, ${timePart} ${zoneAbbr}`;
}

/**
 * Stamps the export date/time onto the printed card's watermark line
 * ("JOB {id} · Rev {XX}", bottom-left, `pdf.html`'s `.jc-watermark`) right
 * after the existing text, so it inherits the exact same styling.
 */
function stampExportTimestamp(doc: Document): void {
  const stamp = formatExportTimestamp();
  doc.querySelectorAll<HTMLElement>(".jc-watermark").forEach((el) => {
    el.append(` · ${stamp}`);
  });
}

/**
 * Loads the single-page job card HTML and opens the print dialog in the
 * current tab (hidden iframe — no new tab / pop-up).
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
  stampExportTimestamp(doc);

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

  fitJobCardToOnePage(doc);

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
