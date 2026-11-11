# Treinamento demonstrativo — persistência local

A autenticação real da Etapa 5.6 e as instruções para Expo Go estão em
[AUTH.md](AUTH.md). Exercícios e resultados continuam demonstrativos; o progresso
local agora é separado por participante autenticado. A descrição abaixo registra
a implementação da Fase 4, anterior à autenticação.

Referência técnica específica do mobile. A apresentação oficial, o histórico das
fases, as horas e o estado consolidado estão no [README principal](../../README.md).
Este documento detalha a etapa 4.5 e a fronteira de integração futura.

Os contratos `Exercise`, `ExerciseAttempt`, `ExerciseResult`, `TrainingProgress`,
`Achievement` e `ParticipantSummary` ficam em `@aex/types/training` (importação
somente de tipos). `TrainingService` define a fronteira entre telas e dados.
O subpath de tipos usa o fonte para funcionar no monorepo sem gerar um build.
O export principal de `@aex/types` também os inclui em seus próximos builds.

`src/services/trainingService.ts` conecta o mock às fixtures e aos cálculos
demonstrativos existentes. As telas recebem exercícios sem gabarito e solicitam
avaliação ao serviço. A confirmação grava uma tentativa; **Continuar** registra
a conclusão após a explicação. Novas práticas entram no histórico, mas somente
a primeira conclusão de cada exercício gera pontos. O resumo de primeiras
conclusões é separado dos totais de acertos/erros de todas as tentativas.

No Android/iOS, reutilizamos `expo-file-system` 58.0.10, já instalado pelo Expo
e agora declarado diretamente no mobile. O arquivo `aex-training-v1.json` fica
em `documentDirectory`, dentro da área do aplicativo, pela API de compatibilidade
`expo-file-system/legacy`. Uma gravação temporária é
finalizada antes da substituição do arquivo principal; se a substituição for
interrompida e o principal não existir, a leitura tenta recuperar o temporário.
Na prévia web, o adaptador
usa `localStorage` da mesma origem. Não há sincronização entre aparelhos.

O documento versionado contém apenas IDs de tentativa/exercício/alternativa e
datas de envio/conclusão. Não são armazenados nome do participante, texto livre,
senhas ou dados bancários. Resultados, pontos e conquistas são reconstruídos
localmente e **não são confiáveis para medir segurança digital real**.

A restauração termina antes de liberar as telas. As gravações são sequenciais;
a interface só confirma sucesso após salvar. IDs de tentativa tornam reenvios
idempotentes. Falhas de leitura, versão desconhecida ou arquivo inválido mostram
uma opção de tentar novamente, sem sobrescrever os dados. Uma versão futura do
formato/catálogo deverá implementar migração explícita. Desinstalar o app, limpar
seus dados ou os dados da origem web pode apagar o histórico.

## Substituição futura pela API NestJS

Implementar um adaptador `TrainingService` em `trainingService.ts`, mantendo as
interfaces. Mapeamento sugerido (nenhum endpoint foi implementado):

| Método | Operação REST futura |
| --- | --- |
| `getExercises()` | `GET /exercises` sem gabarito |
| `submitAttempt()` | `POST /exercise-attempts` com ID idempotente, exercício e alternativa |
| `completeAttempt()` | `POST /exercise-attempts/:id/completion` idempotente |
| `getProgress()` | `GET /training-progress` com histórico, resumo, módulos e conquistas |

A API deverá validar as entradas, definir datas, avaliar respostas e calcular
recompensas/conclusões autoritativas; não aceitar `correct`, pontos ou conquistas
enviados pelo cliente. `ExerciseResult.evaluation` e `TrainingProgress.evaluation`
devem ser `server` somente para resultados realmente calculados pela API. O
histórico local demonstrativo não deve ser promovido a resultado confiável.
Autenticação, sincronização, migração de dados e backend ficam para etapas futuras.

## Validação focada

- `npm run test:training --workspace=@aex/mobile`
- `npm run test:progression --workspace=@aex/mobile`
- `npm run test:exercises --workspace=@aex/mobile`
- `npm run typecheck --workspace=@aex/mobile`
- `npm run lint --workspace=@aex/mobile`
- `npm run typecheck --workspace=@aex/types`
- `npm run lint --workspace=@aex/types`

Os testes do serviço usam um armazenamento injetado e recriam a instância para
simular reabertura. A verificação do armazenamento nativo em aparelho permanece
separada desses testes.
