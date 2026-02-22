import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { createRondaForAnalista } from "@/lib/data-store";

export async function POST(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  if (user.role !== "gestor") return NextResponse.json({ error: "Acesso restrito ao gestor." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    analistaId?: string;
    checklistModeloId?: string;
  } | null;

  if (!body?.analistaId || !body?.checklistModeloId) {
    return NextResponse.json({ error: "Informe analista e modelo." }, { status: 400 });
  }

  const ronda = await createRondaForAnalista({
    analistaId: body.analistaId,
    checklistModeloId: body.checklistModeloId,
    gestorUserId: user.id
  });
  if (!ronda) return NextResponse.json({ error: "Falha ao criar ronda." }, { status: 400 });

  return NextResponse.json({ ronda }, { status: 201 });
}
