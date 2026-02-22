import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { listUsersByRole } from "@/lib/data-store";
import type { UserRole } from "@/lib/types";

export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const role = (request.nextUrl.searchParams.get("perfil") ?? "") as UserRole;
  if (role !== "analista" && role !== "gestor") {
    return NextResponse.json({ error: "Perfil invalido." }, { status: 400 });
  }

  if (user.role !== "gestor" && user.role !== role) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const usuarios = await listUsersByRole(role);
  return NextResponse.json({ usuarios });
}
