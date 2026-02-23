import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { updateResposta } from "@/lib/data-store";
import type { ItemStatus } from "@/lib/types";

async function getParamId(context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return params.id;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    itemRespostaId?: string;
    status?: ItemStatus;
    observacao?: string;
  } | null;

  if (!body?.itemRespostaId || (body.status !== "ok" && body.status !== "incidente" && body.status !== "pendente")) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const rondaId = await getParamId(context);
  const ronda = await updateResposta({
    rondaId,
    itemRespostaId: body.itemRespostaId,
    status: body.status,
    observacao: body.observacao,
    userId: user.id
  });
  if (!ronda) return NextResponse.json({ error: "Ronda/item não encontrado." }, { status: 404 });
  return NextResponse.json({ ronda });
}
