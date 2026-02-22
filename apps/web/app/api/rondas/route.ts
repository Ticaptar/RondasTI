import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { listRondas, startRonda } from "@/lib/data-store";

export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const rondas = user.role === "gestor" ? await listRondas() : await listRondas({ analistaId: user.id });
  return NextResponse.json({ rondas });
}

export async function POST(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  if (user.role !== "analista") return NextResponse.json({ error: "Apenas analista inicia ronda." }, { status: 403 });

  const ronda = await startRonda(user.id);
  if (!ronda) return NextResponse.json({ error: "Falha ao iniciar ronda." }, { status: 400 });
  return NextResponse.json({ ronda });
}
