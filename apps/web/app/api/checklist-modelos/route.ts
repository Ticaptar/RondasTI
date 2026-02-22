import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { createChecklistModelo, listChecklistModelos } from "@/lib/data-store";
import type { ChecklistModeloItemInput } from "@/lib/types";

export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  if (user.role !== "gestor") return NextResponse.json({ error: "Acesso restrito ao gestor." }, { status: 403 });

  const modelos = await listChecklistModelos();
  return NextResponse.json({ modelos });
}

export async function POST(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  if (user.role !== "gestor") return NextResponse.json({ error: "Acesso restrito ao gestor." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    nome?: string;
    itens?: ChecklistModeloItemInput[];
  } | null;

  if (!body?.nome || !Array.isArray(body.itens)) {
    return NextResponse.json({ error: "Payload invalido para modelo." }, { status: 400 });
  }

  try {
    const modelo = await createChecklistModelo({
      nome: body.nome,
      itens: body.itens,
      gestorUserId: user.id
    });
    if (!modelo) return NextResponse.json({ error: "Falha ao criar modelo." }, { status: 400 });
    return NextResponse.json({ modelo }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao criar modelo." },
      { status: 400 }
    );
  }
}
