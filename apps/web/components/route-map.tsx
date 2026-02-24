import type { LocalizacaoPing } from "@/lib/types";
import { formatCoord, formatDateTime } from "@/lib/format";

function normalize(points: LocalizacaoPing[]) {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => new Date(a.coletadaEm).getTime() - new Date(b.coletadaEm).getTime());
  const lats = sorted.map((p) => p.latitude);
  const lngs = sorted.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lngSpan = Math.max(maxLng - minLng, 0.0001);

  return sorted.map((p, idx) => ({
    ...p,
    x: 20 + ((p.longitude - minLng) / lngSpan) * 560,
    y: 20 + (1 - (p.latitude - minLat) / latSpan) * 210,
    idx
  }));
}

function pointColor(p: LocalizacaoPing, idx: number, total: number) {
  if (idx === total - 1) return "#55d7a2";
  if (idx === 0) return "#ffbe5c";
  if (p.origem === "simulada") return "#ff6f7f";
  if (p.origem === "manual") return "#ffd27a";
  return "#9fd0ff";
}

export function RouteMap({ points, title = "Trajeto da ronda" }: { points: LocalizacaoPing[]; title?: string }) {
  const normalized = normalize(points);
  const path = normalized.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const orderedPoints = normalized.map((p) => ({
    id: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
    precisaoMetros: p.precisaoMetros,
    coletadaEm: p.coletadaEm,
    origem: p.origem
  }));
  const last = orderedPoints[orderedPoints.length - 1];
  const gpsCount = orderedPoints.filter((p) => p.origem === "gps").length;
  const manualCount = orderedPoints.filter((p) => p.origem === "manual").length;
  const simulatedCount = orderedPoints.filter((p) => p.origem === "simulada").length;

  return (
    <div className="rf-map">
      <div className="rf-row wrap" style={{ marginBottom: 8 }}>
        <strong>{title}</strong>
        <div className="rf-actions" style={{ gap: 6 }}>
          <span className="rf-badge">{orderedPoints.length} pontos</span>
          <span className="rf-chip">GPS {gpsCount}</span>
          <span className="rf-chip">Manual {manualCount}</span>
          {simulatedCount > 0 && <span className="rf-chip incidente">Teste {simulatedCount}</span>}
        </div>
      </div>

      {orderedPoints.length === 0 ? (
        <div className="rf-empty">Sem localizacao registrada ainda. Ative GPS ou registre ponto atual.</div>
      ) : (
        <>
          <div className="rf-muted" style={{ fontSize: "0.82rem", marginBottom: 8 }}>
            Mapa esquematico do trajeto (nao e mapa real de ruas).
          </div>
          <svg viewBox="0 0 600 250" role="img" aria-label="Mapa esquematico com rota percorrida">
            <defs>
              <linearGradient id="rfPath" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#29d4ff" />
                <stop offset="100%" stopColor="#68b4ff" />
              </linearGradient>
            </defs>
            <rect x="6" y="6" width="588" height="238" rx="12" fill="rgba(7,11,22,0.75)" stroke="rgba(178,207,255,0.08)" />
            {path && <path d={path} fill="none" stroke="url(#rfPath)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />}
            {normalized.map((p, idx) => (
              <g key={p.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={idx === 0 || idx === normalized.length - 1 ? 5.5 : 3.2}
                  fill={pointColor(p, idx, normalized.length)}
                  stroke="rgba(9,12,22,0.85)"
                  strokeWidth="2"
                />
              </g>
            ))}
          </svg>
          <div className="rf-map-meta">
            <span>Ponto inicial: {formatDateTime(orderedPoints[0]?.coletadaEm)}</span>
            <span>Ultimo ponto: {formatDateTime(last?.coletadaEm)}</span>
            {last && (
              <>
                <span className="rf-mono">
                  Ultimas coords: {formatCoord(last.latitude)}, {formatCoord(last.longitude)}
                </span>
                <span>
                  Origem: <strong>{last.origem}</strong>
                  {typeof last.precisaoMetros === "number" ? ` (${Math.round(last.precisaoMetros)}m)` : ""}
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
