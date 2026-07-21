import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}
