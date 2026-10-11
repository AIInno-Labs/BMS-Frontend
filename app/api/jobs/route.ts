import { NextResponse } from "next/server";

/**
 * Domain data now lives on the Spring Boot API (`NEXT_PUBLIC_FRP_API_BASE_URL`).
 * The browser calls `/jobs` via `lib/frp/api.ts` — this Next route is retired.
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Deprecated: use the Spring Boot /jobs API via lib/frp/api.ts (JobsContext).",
    },
    { status: 410 }
  );
}
