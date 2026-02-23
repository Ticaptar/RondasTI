import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { finalizeRonda } from "@/lib/data-store";

async function getParamId(context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return params.id;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const ronda = await finalizeRonda({ rondaId: await getParamId(context), userId: user.id });
  if (!ronda) return NextResponse.json({ error: "Ronda não encontrada." }, { status: 404 });

  return NextResponse.json({ ronda });
}
