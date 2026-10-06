import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Floor rebalance is not available until staff APIs move to Spring Boot.",
      reassignedCount: 0,
      jobs: [],
      staff: [],
    },
    { status: 501 }
  );
}
