import Link from 'next/link';
import { PageHeading, ParticipantsTable } from '../../../components/Report';
import { adminService } from '../../../services/service';
import { filterParticipants } from '../../../services/adminService';

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; status?: string | string[] }> }) {
  const [params, report] = await Promise.all([searchParams, adminService.getReport()]);
  const query = typeof params.q === 'string' ? params.q : '';
  const status = typeof params.status === 'string' && ['completed', 'started', 'pending'].includes(params.status) ? params.status : 'all';
  const rows = filterParticipants(report.participants, query, status);
  return <>
    <PageHeading section="Participantes" title="Participantes" description="Consulte os perfis fictícios e a participação nas atividades educativas." />
    <section className="panel">
      <div className="panel-heading"><h2>Participação por pessoa</h2><span>{rows.length} de {report.participants.length} exemplos</span></div>
      <form key={`${query}|${status}`} className="filters" action="/participantes" method="get">
        <label>Buscar participante<input name="q" type="search" defaultValue={query} placeholder="Nome, identificação ou turma" /></label>
        <label>Situação<select name="status" defaultValue={status}><option value="all">Todas as situações</option><option value="completed">Concluído</option><option value="started">Em andamento</option><option value="pending">Não iniciado</option></select></label>
        <button type="submit">Aplicar filtros</button><Link className="text-link" href="/participantes">Limpar</Link>
      </form>
      <ParticipantsTable rows={rows} />
    </section>
    <p className="caption">Os nomes são fictícios. “Concluídos” considera exercícios únicos; acertos e erros consideram todas as respostas, inclusive repetições.</p>
  </>;
}
