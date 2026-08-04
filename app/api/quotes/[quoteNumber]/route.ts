import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  context: { params: Promise<{ quoteNumber: string }> }
) {
  const { quoteNumber } = await context.params;
  return NextResponse.json(
    {
      error: `Quote ${quoteNumber} is not available until DEL-02 (Spring Boot quotes).`,
    },
    { status: 404 }
  );
}
