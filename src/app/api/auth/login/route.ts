import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { firstValidationError, loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const result = loginSchema.safeParse(body);
    if (!result.success) return jsonError(firstValidationError(result.error), 400, result.error.flatten());

    const user = await db.user.findUnique({ where: { email: result.data.email } });
    const valid = user ? await bcrypt.compare(result.data.password, user.passwordHash) : false;
    if (!user || !valid) return jsonError("Email or password is incorrect", 401);

    const token = await createSessionToken({ userId: user.id, name: user.name, email: user.email });
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch {
    return jsonError("We couldn't sign you in. Please try again.", 500);
  }
}
