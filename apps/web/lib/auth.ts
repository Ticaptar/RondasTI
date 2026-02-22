import type { NextRequest } from "next/server";
import { getSessionUserByToken } from "@/lib/data-store";

export const SESSION_COOKIE = "rondaflow_session";

export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export function getSessionUserFromRequest(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return getSessionUserByToken(token);
}
