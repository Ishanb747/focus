import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isUniqueConstraint, jsonError } from "@/lib/api";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { firstValidationError, registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const result = registerSchema.safeParse(body);
    if (!result.success) return jsonError(firstValidationError(result.error), 400, result.error.flatten());

    const passwordHash = await bcrypt.hash(result.data.password, 12);
    const user = await db.user.create({
      data: { name: result.data.name, email: result.data.email, passwordHash },
      select: { id: true, name: true, email: true },
    });
    const token = await createSessionToken({ userId: user.id, name: user.name, email: user.email });
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (isUniqueConstraint(error)) return jsonError("An account with this email already exists", 409);
    return jsonError("We couldn't create your account. Please try again.", 500);
  }
}
