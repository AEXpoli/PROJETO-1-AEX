import { EmptyState, PageHeading, percentage } from '../../../components/Report';
import { adminService } from '../../../services/service';

const channels = { sms: 'Mensagem SMS', link: 'Endereço eletrônico', call: 'Ligação telefônica' };

export default async function SimulationsPage() {
  const report = await adminService.getReport();
  return <>
    <PageHeading section="Simulações" title="Exercícios e simulações" description="Catálogo demonstrativo de situações educativas sobre golpes digitais." />
    <p className="section-label">{report.exercises.length} simulações · módulo Mensagens com cuidado</p>
    {report.exercises.length === 0 ? <EmptyState title="Nenhuma simulação disponível" /> : <div className="simulation-list">{report.exercises.map(({ exercise, metrics }, index) => (
      <article className="panel simulation" key={exercise.id}>
        <div className="simulation-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
        <div className="simulation-content"><p className="eyebrow">{channels[exercise.scenario.kind]} · {exercise.category === 'phishing' ? 'Phishing' : 'Engenharia social'}</p><h2>{exercise.title}</h2><p>{exercise.introduction}</p>
          <details><summary>Ver cenário educativo</summary><div className="scenario"><strong>{exercise.scenario.sender}</strong><p>{exercise.scenario.message}</p>{exercise.scenario.address ? <code>{exercise.scenario.address}</code> : null}<p><strong>Pergunta:</strong> {exercise.question}</p><ul>{exercise.options.map((option) => <li key={option.id}>{option.label}</li>)}</ul><p className="caption">Conteúdo fictício. Endereços exibidos apenas como texto.</p></div></details>
        </div>
        <dl className="simulation-stats"><div><dt>Respostas</dt><dd>{metrics.responses}</dd></div><div><dt>Acertos</dt><dd>{percentage(metrics.accuracy)}</dd></div></dl>
      </article>
    ))}</div>}
  </>;
}
