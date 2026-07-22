import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateAndSaveQuote } from "@/lib/rate-service";
import { InvalidPincodeError, NoViableRouteError } from "@/lib/routing";
import { firstValidationError, rateQuoteSchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const quotes = await db.deliveryQuote.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ quotes });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const parsed = rateQuoteSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: firstValidationError(parsed.error) }, { status: 400 });
    const quote = await calculateAndSaveQuote(session.userId, parsed.data);
    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    if (error instanceof InvalidPincodeError || error instanceof NoViableRouteError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Rate quote failed", error);
    return NextResponse.json({ error: "Unable to calculate a delivery route" }, { status: 500 });
  }
}
