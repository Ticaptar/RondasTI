import Link from "next/link";
import { AppTopbar } from "@/components/app-topbar";

export default function HomePage() {
  return (
    <main className="rf-page">
      <AppTopbar user={null} />

      <section className="rf-hero">
        <p className="rf-section-title">Checklist de Ronda Auditado</p>
        <h1 className="rf-title">App para o analista registrar ronda diária por setor com fotos, horário e rota.</h1>
        <p className="rf-subtitle">
          MVP funcional com fluxo do analista, painel do gestor, trilha de auditoria e localização (trajeto) registrada.
        </p>
        <div className="rf-actions" style={{ marginTop: 16 }}>
          <Link href="/login" className="rf-btn primary">
            Entrar no sistema
          </Link>
          <Link href="/analista" className="rf-btn">
            Ir para Analista
          </Link>
          <Link href="/gestor" className="rf-btn">
            Ir para Gestor
          </Link>
        </div>
      </section>

      <section className="rf-grid cols-3" style={{ marginTop: 14 }}>
        <article className="rf-card">
          <p className="rf-section-title">Operação</p>
          <h2 style={{ marginTop: 0 }}>Ronda por setores</h2>
          <p className="rf-muted">Checklist estruturado por setor, status OK/incidente, observações e fotos por item.</p>
        </article>
        <article className="rf-card">
          <p className="rf-section-title">Auditoria</p>
          <h2 style={{ marginTop: 0 }}>Rastreabilidade completa</h2>
          <p className="rf-muted">Início/fim, ações registradas, usuário responsável, evidências e timeline auditável.</p>
        </article>
        <article className="rf-card">
          <p className="rf-section-title">Gestão</p>
          <h2 style={{ marginTop: 0 }}>Painel do gestor</h2>
          <p className="rf-muted">KPIs, histórico de rondas, incidentes e visualização do trajeto percorrido.</p>
        </article>
      </section>

      <p className="rf-footer-note">Login por usuário cadastrado no banco de dados (perfil analista ou gestor).</p>
    </main>
  );
}
