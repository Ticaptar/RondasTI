import { NextResponse } from "next/server";
import { getTokenFromRequest, SESSION_COOKIE } from "@/lib/auth";
import { logoutSession } from "@/lib/data-store";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (token) {
    logoutSession(token);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
  return response;
}
