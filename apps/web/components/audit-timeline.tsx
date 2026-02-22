import type { AuditLog } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

export function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return <div className="rf-empty">Nenhum evento auditado ainda.</div>;
  }

  return (
    <div className="rf-timeline">
      {logs.map((log) => (
        <div className="rf-timeline-item" key={log.id}>
          <div className="rf-timeline-dot" />
          <div className="rf-timeline-card">
            <div className="rf-row wrap">
              <strong>{log.acao.replaceAll("_", " ")}</strong>
              <span className="rf-mono rf-muted">{formatDateTime(log.criadoEm)}</span>
            </div>
            <p>{log.detalhes}</p>
            <p className="rf-muted" style={{ marginTop: 6 }}>
              {log.userNome}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
