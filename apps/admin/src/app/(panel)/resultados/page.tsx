import { ExerciseTable, MethodNote, Metrics, PageHeading, ResultsChart } from '../../../components/Report';
import { adminService } from '../../../services/service';

export default async function ResultsPage() {
  const report = await adminService.getReport();
  return <>
    <PageHeading section="Resultados" title="Resultados das simulações" description="Distribuição das respostas e resumo de desempenho por exercício. Base inteiramente fictícia." />
    <Metrics report={report} />
    <div className="report-grid"><section className="panel"><ResultsChart rows={report.exercises} /></section><MethodNote /></div>
    <section className="panel"><div className="panel-heading"><h2>Resumo por exercício</h2><span>Dados demonstrativos</span></div><ExerciseTable rows={report.exercises} /></section>
  </>;
}
