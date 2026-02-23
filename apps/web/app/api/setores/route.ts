import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { createSetor, listSetores } from "@/lib/data-store";

export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const setores = await listSetores();
  return NextResponse.json({ setores });
}

export async function POST(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (user.role !== "gestor") return NextResponse.json({ error: "Acesso restrito ao gestor." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    nome?: string;
    ordem?: number;
    checkpointHint?: string;
  } | null;

  if (!body?.nome || typeof body.ordem !== "number") {
    return NextResponse.json({ error: "Informe nome e ordem do setor." }, { status: 400 });
  }

  try {
    const setor = await createSetor({
      nome: body.nome,
      ordem: body.ordem,
      checkpointHint: body.checkpointHint,
      gestorUserId: user.id
    });
    if (!setor) return NextResponse.json({ error: "Falha ao criar setor." }, { status: 400 });
    return NextResponse.json({ setor }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao criar setor." },
      { status: 400 }
    );
  }
}
