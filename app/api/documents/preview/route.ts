import { NextResponse } from "next/server";

/**
 * Streams a SharePoint-signed document back to the browser so it can be
 * previewed in-app.
 *
 * `GET /documents/{id}/download` hands out a short-lived signed URL, but that
 * URL comes back as `Content-Disposition: attachment` with no CORS headers —
 * an <iframe>/<img> pointed at it downloads the file instead of rendering it.
 * This route fetches the bytes server-side and re-serves them same-origin with
 * an `inline` disposition, which is what makes the preview modal work.
 *
 * The signed URL is supplied by the caller, so the host is allowlisted to keep
 * this from becoming an open proxy (SSRF).
 */

/** Hosts a signed document URL is allowed to point at. */
const ALLOWED_HOST_SUFFIXES = [
  ".sharepoint.com",
  ".sharepoint.us",
  ".svc.ms",
  "graph.microsoft.com",
  "1drv.ms",
];

/** Content types we are willing to render inline. Anything else downloads. */
const INLINE_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
];

function isAllowedUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const ok = ALLOWED_HOST_SUFFIXES.some((suffix) =>
    suffix.startsWith(".") ? host.endsWith(suffix) : host === suffix
  );
  return ok ? url : null;
}

/** Guess a content type from the file name when the origin sends a generic one. */
function contentTypeFromName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "tif":
    case "tiff":
      return "image/tiff";
    default:
      return null;
  }
}

/** RFC 5987 filename so non-ASCII document names survive the header. */
function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawUrl = params.get("url");
  const name = params.get("name") || "document";

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const target = isAllowedUrl(rawUrl);
  if (!target) {
    return NextResponse.json(
      { error: "URL is not an allowed document host" },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the document store" },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Document could not be fetched" },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  // The signed URL often reports application/octet-stream, which the browser
  // will not render — fall back to the extension so PDFs/images display.
  const upstreamType = (upstream.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const contentType =
    INLINE_CONTENT_TYPES.includes(upstreamType)
      ? upstreamType
      : (contentTypeFromName(name) ?? (upstreamType || "application/octet-stream"));

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": contentDisposition(name),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new NextResponse(upstream.body, { status: 200, headers });
}
