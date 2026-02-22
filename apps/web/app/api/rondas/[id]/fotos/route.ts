import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { addFotoToRonda } from "@/lib/data-store";

async function getParamId(context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return params.id;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    itemRespostaId?: string;
    nomeArquivo?: string;
    dataUrl?: string;
  } | null;

  if (!body?.nomeArquivo || !body?.dataUrl || typeof body.dataUrl !== "string") {
    return NextResponse.json({ error: "Foto invalida." }, { status: 400 });
  }

  const foto = await addFotoToRonda({
    rondaId: await getParamId(context),
    itemRespostaId: body.itemRespostaId,
    nomeArquivo: body.nomeArquivo,
    dataUrl: body.dataUrl,
    userId: user.id
  });
  if (!foto) return NextResponse.json({ error: "Falha ao salvar foto." }, { status: 404 });

  return NextResponse.json({ foto });
}
