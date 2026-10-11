import { NextResponse } from "next/server";
import { getQuoteByNumberFromDb } from "@/lib/supabase/quotes-repository";

interface RouteParams {
  params: Promise<{ quoteNumber: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { quoteNumber } = await params;
  const id = decodeURIComponent(quoteNumber);

  try {
    const quote = await getQuoteByNumberFromDb(id);
    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    return NextResponse.json({ quote });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load quote";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
