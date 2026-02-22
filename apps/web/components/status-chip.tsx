import type { ItemStatus, RondaStatus } from "@/lib/types";

export function StatusChip({ status }: { status: ItemStatus | RondaStatus }) {
  const label =
    status === "ok"
      ? "OK"
      : status === "incidente"
        ? "Incidente"
        : status === "pendente"
          ? "Pendente"
          : status === "aberta"
            ? "Aberta"
            : "Finalizada";
  return <span className={`rf-chip ${status}`}>{label}</span>;
}
