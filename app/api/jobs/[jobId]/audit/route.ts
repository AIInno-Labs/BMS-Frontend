import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "Deprecated: use Spring Boot GET /jobs/{jobNumber}/audit via lib/frp/api.ts.",
    },
    { status: 410 }
  );
}
