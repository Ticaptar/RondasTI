import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { loginUser } from "@/lib/data-store";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string; role?: UserRole } | null;
  const role = body?.role;
  const username = body?.username ?? "";

  if (role !== "analista" && role !== "gestor") {
    return NextResponse.json({ error: "Perfil invalido." }, { status: 400 });
  }

  const session = await loginUser(username, role);
  if (!session) {
    return NextResponse.json({ error: "Usuario nao encontrado para o perfil." }, { status: 404 });
  }

  const response = NextResponse.json({ user: session.user });
  response.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
  return response;
}
