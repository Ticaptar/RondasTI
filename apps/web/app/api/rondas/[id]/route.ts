import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { getRondaById, listAuditLogsByRonda, updateRondaObservacaoGeral } from "@/lib/data-store";

async function getParamId(context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return params.id;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const id = await getParamId(context);
  const ronda = await getRondaById(id);
  if (!ronda) return NextResponse.json({ error: "Ronda nao encontrada." }, { status: 404 });
  if (user.role === "analista" && ronda.analistaId !== user.id) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  return NextResponse.json({ ronda, auditLogs: await listAuditLogsByRonda(id) });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const id = await getParamId(context);
  const body = (await request.json().catch(() => null)) as { observacaoGeral?: string } | null;
  if (typeof body?.observacaoGeral !== "string") {
    return NextResponse.json({ error: "Observacao geral obrigatoria." }, { status: 400 });
  }

  const updated = await updateRondaObservacaoGeral({
    rondaId: id,
    observacaoGeral: body.observacaoGeral,
    userId: user.id
  });
  if (!updated) return NextResponse.json({ error: "Ronda nao encontrada." }, { status: 404 });

  return NextResponse.json({ ronda: updated });
}
