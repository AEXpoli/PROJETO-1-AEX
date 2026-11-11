import Link from 'next/link';
import { ExerciseTable, Metrics, PageHeading, ParticipationChart, ResultsChart } from '../../components/Report';
import { adminService } from '../../services/service';

export default async function HomePage() {
  const report = await adminService.getReport();
  return <>
    <PageHeading section="Dashboard" title="Visão geral" description="Acompanhe a participação e explore os resultados previstos para as atividades educativas." />
    <div className="overview-context"><span><strong>Base ilustrativa</strong> · outubro de 2026</span><span>{report.metrics.simulations} simulações disponíveis</span></div>
    <Metrics report={report} />
    <div className="report-grid"><section className="panel"><ResultsChart rows={report.exercises} /></section><section className="panel"><ParticipationChart report={report} /></section></div>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">DESEMPENHO EDUCATIVO</p><h2>Resultados por exercício</h2></div><Link href="/resultados">Ver resultados completos →</Link></div><ExerciseTable rows={report.exercises} /></section>
    <aside className="insight"><strong>Leitura educativa, sem classificação competitiva.</strong><p>Os indicadores ajudam a ilustrar temas que podem ser retomados. Eles não certificam a capacidade de reconhecer golpes na vida real.</p></aside>
  </>;
}
