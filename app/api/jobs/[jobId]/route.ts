import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "Deprecated: use Spring Boot GET /jobs/{jobNumber} via lib/frp/api.ts.",
    },
    { status: 410 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      error:
        "Deprecated: use Spring Boot PATCH /jobs/{jobNumber} via lib/frp/api.ts.",
    },
    { status: 410 }
  );
}
