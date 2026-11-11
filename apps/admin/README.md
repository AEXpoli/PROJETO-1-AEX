# AEX Admin — demonstração

A autenticação administrativa da Etapa 5.7, a ativação por convite e a configuração
para testar pelo navegador estão em [AUTH.md](AUTH.md). Os indicadores continuam
demonstrativos, protegidos por autorização real. O texto abaixo registra a Fase 4.

Referência técnica da etapa 4.6. A apresentação oficial, o histórico das fases e
o registro de horas estão centralizados no [README principal](../../README.md).

Páginas: `/` (Dashboard), `/participantes` (busca e filtro por situação),
`/simulacoes` (catálogo e cenários expansíveis) e `/resultados` (tabelas e gráficos).
Todas exibem **Dados demonstrativos** e esclarecem a origem fictícia dos registros.

As fixtures de `src/data/adminFixtures.ts` são independentes do mobile: seis
participantes fictícios, três exercícios e doze respostas (sete corretas e cinco
incorretas). Não há leitura de arquivos, armazenamento local ou serviços do mobile,
nem coleta de dados reais. Os contratos `Exercise`, `ExerciseResult` (com
`ExerciseAttempt`) e `ParticipantSummary` vêm de `@aex/types/training`.

O percentual global é `corretas / respostas * 100`, arredondado para uma casa,
incluindo repetições. Ausência de respostas produz `null`, mostrado como “—”.
Conclusões consideram exercícios únicos por participante; a primeira conclusão
define o resultado no `ParticipantSummary`. Responder e concluir são estados
distintos. Estes indicadores não representam certificação de segurança digital.

`AdminService.getReport()` é a fronteira assíncrona das páginas. A composição está
em `src/services/service.ts`. No futuro, substituir o mock por um adaptador REST
que receba um relatório administrativo autorizado da API NestJS. As agregações
confiáveis deverão vir da API. `buildReport` valida fixtures exclusivamente
demonstrativas e não deve ser reutilizado para apresentar dados reais como mocks.
Nenhum endpoint, autenticação, banco ou integração mobile/admin foi implementado.

`loading.tsx` oferece o estado de carregamento das rotas; o mock resolve sem espera
artificial. Tabelas e gráficos tratam bases vazias. A busca sem correspondências
permite visualizar o estado vazio de participantes. `error.tsx` permite repetir
uma leitura que falhou. Gráficos usam CSS e rótulos numéricos, sem dependências.

Validação limitada ao workspace:

- `npm run typecheck --workspace=@aex/admin`
- `npm run lint --workspace=@aex/admin`
- `npm run test:admin --workspace=@aex/admin`
