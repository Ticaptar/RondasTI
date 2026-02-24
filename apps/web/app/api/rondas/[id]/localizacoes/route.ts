import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { addLocalizacao } from "@/lib/data-store";

async function getParamId(context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return params.id;
}

const ENABLE_SIMULATED_GPS = process.env.NEXT_PUBLIC_ENABLE_GPS_TEST === "true";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    latitude?: number;
    longitude?: number;
    precisaoMetros?: number | null;
    origem?: "gps" | "manual" | "simulada";
  } | null;

  if (typeof body?.latitude !== "number" || typeof body.longitude !== "number") {
    return NextResponse.json({ error: "Latitude/longitude inválidas." }, { status: 400 });
  }

  if (Math.abs(body.latitude) > 90 || Math.abs(body.longitude) > 180) {
    return NextResponse.json({ error: "Coordenadas fora do intervalo valido." }, { status: 400 });
  }

  if (body.origem === "simulada" && !ENABLE_SIMULATED_GPS) {
    return NextResponse.json({ error: "Ponto simulado desabilitado neste ambiente." }, { status: 403 });
  }

  const ping = await addLocalizacao({
    rondaId: await getParamId(context),
    latitude: body.latitude,
    longitude: body.longitude,
    precisaoMetros: typeof body.precisaoMetros === "number" ? body.precisaoMetros : null,
    origem: body.origem ?? "manual",
    userId: user.id
  });
  if (!ping) return NextResponse.json({ error: "Ronda não encontrada." }, { status: 404 });

  return NextResponse.json({ ping });
}
