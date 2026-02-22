import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data-store";

export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  if (user.role !== "gestor") return NextResponse.json({ error: "Acesso restrito ao gestor." }, { status: 403 });
  return NextResponse.json(await getDashboardSnapshot());
}
