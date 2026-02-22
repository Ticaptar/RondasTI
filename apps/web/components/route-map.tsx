import type { LocalizacaoPing } from "@/lib/types";
import { formatCoord, formatDateTime } from "@/lib/format";

function normalize(points: LocalizacaoPing[]) {
  if (points.length === 0) return [];
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lngSpan = Math.max(maxLng - minLng, 0.0001);

  return points.map((p, idx) => ({
    ...p,
    x: 20 + ((p.longitude - minLng) / lngSpan) * 560,
    y: 20 + (1 - (p.latitude - minLat) / latSpan) * 210,
    idx
  }));
}

export function RouteMap({ points, title = "Trajeto da ronda" }: { points: LocalizacaoPing[]; title?: string }) {
  const normalized = normalize(points);
  const path = normalized.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <div className="rf-map">
      <div className="rf-row wrap" style={{ marginBottom: 8 }}>
        <strong>{title}</strong>
        <span className="rf-badge">{points.length} pontos</span>
      </div>
      {points.length === 0 ? (
        <div className="rf-empty">Sem localização registrada ainda. Ative GPS ou registre ponto manual/simulado.</div>
      ) : (
        <>
          <svg viewBox="0 0 600 250" role="img" aria-label="Mapa com rota percorrida">
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
                  fill={idx === normalized.length - 1 ? "#55d7a2" : idx === 0 ? "#ffbe5c" : "#9fd0ff"}
                  stroke="rgba(9,12,22,0.85)"
                  strokeWidth="2"
                />
              </g>
            ))}
          </svg>
          <div className="rf-map-meta">
            <span>Ponto inicial: {formatDateTime(points[0]?.coletadaEm)}</span>
            <span>Último ponto: {formatDateTime(last?.coletadaEm)}</span>
            {last && (
              <span className="rf-mono">
                Últimas coords: {formatCoord(last.latitude)}, {formatCoord(last.longitude)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
