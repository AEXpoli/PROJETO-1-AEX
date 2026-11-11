# AEX — Etapa 5.5: respostas, resultados e progresso

## Endpoints

Todos usam o token Supabase Auth, exigem vínculo organizacional atual e enviam
`Cache-Control: no-store`. O participante é identificado exclusivamente pelo
token; não há parâmetro para consultar ou gravar em nome de outro usuário.

| Método e caminho | Resultado |
| --- | --- |
| `POST /exercises/:id/attempts` | Resultado avaliado e persistido, HTTP 200 inclusive no replay |
| `GET /me/attempts` | Histórico próprio, do mais recente ao mais antigo |
| `GET /me/progress` | Conclusões, resumo pessoal, estatísticas e progresso por módulo |
| `GET /me/achievements` | Conquistas `first`, `phishing`, `module`, com `unlocked` |

Corpo do POST:

```json
{
  "id": "30000000-0000-4000-8000-000000000001",
  "selectedOptionId": "a5400000-0000-4000-8000-000000000202"
}
```

`id` é um UUID criado pelo cliente **uma vez por envio lógico**. O campo opcional
`assignmentId` identifica uma atribuição de campanha. Todos os IDs devem ser
UUIDs. Campos extras, inclusive `participantId`, `is_correct`, `correct`,
`points`, `role` e `submittedAt`, são rejeitados com `400`.

O resultado segue `RecordedExerciseResult` em `@aex/types`, validado por Zod em
`@aex/validation`: `attempt`, `correct`, `selectedLabel`, `correctLabel`,
`explanation`, `completedAt`, `evaluation: "server"`, `assignmentId` e
`pointsAwarded`. Gabarito e explicação são retornados **após** a tentativa ser
registrada. Os endpoints de leitura de conteúdo da 5.4 continuam sem gabaritos.

## Fluxo transacional

1. O guard global valida o Bearer token. O guard de conteúdo verifica o vínculo.
2. O controller valida UUID e corpo estrito, usando os schemas compartilhados.
3. O serviço chama uma única RPC `aex_record_attempt`, passando o ID autenticado.
4. PostgreSQL bloqueia a linha de perfil com `FOR UPDATE`, serializando as
   gravações do mesmo participante. Confere novamente os vínculos no banco.
5. Se o ID já existir, confere participante, exercício, alternativa e atribuição.
   Uma repetição idêntica devolve o resultado original; payload diferente ou ID
   pertencente a outro participante resulta em `409`.
6. Para nova tentativa, exige exercício e módulo publicados, categoria definida,
   alternativa pertencente ao exercício e gabarito disponível. A avaliação usa
   `exercise_options.is_correct` do banco, nunca dados calculados pelo cliente.
7. Registra tentativa e resultado, recalcula `learning_progress`, concede
   conquistas sem duplicar e atualiza a atribuição quando aplicável.
8. Tudo confirma ou reverte junto. Uma falha tardia na atualização da campanha
   também desfaz tentativa, pontos e conquistas.

As RPCs usam `SECURITY INVOKER`, `search_path` vazio e nomes qualificados.
`EXECUTE` é revogado de `PUBLIC`, `anon` e `authenticated` e concedido apenas a
`service_role`. RLS e permissões atuais das tabelas permanecem ativos.
Somente o backend com a chave secreta pode chamar essas funções; por isso o
ID de participante enviado pelo backend precisa vir da identidade validada.

Referências: [funções Supabase](https://supabase.com/docs/guides/database/functions)
e [transações por requisição PostgREST](https://docs.postgrest.org/en/stable/references/transactions.html).

## Regras preservadas da Fase 4

- A primeira conclusão de cada exercício concede **10 pontos**, correta ou incorreta.
- Novos UUIDs para o mesmo exercício geram novas tentativas, mas concedem zero pontos adicionais.
- O primeiro resultado determina `correct`/`reviewed` das conclusões; o histórico e
  as estatísticas de tentativas mantêm também os resultados posteriores.
- `first`: concluir uma atividade; `phishing`: concluir uma atividade dessa
  categoria; `module`: concluir todas as atividades disponíveis do módulo.
- Cada conquista é concedida uma única vez, pela chave composta já existente.

Nesta API, o POST confirmado já conclui a atividade. O clique “continuar” do
mock não exige uma segunda chamada para pontuar. Não foi criado outro endpoint
de conclusão e a interface permanece inalterada.

O progresso é pessoal e global, conforme `learning_progress(participant_id,
module_id)` e o catálogo global da 5.4. Atividades já concluídas preservam
pontos e histórico mesmo se forem arquivadas. A leitura calcula o denominador
com conteúdo publicado e atividades concluídas, sem depender de contadores
em cache; os agregados persistidos do módulo são atualizados a cada nova tentativa.
Novas publicações podem mudar a quantidade necessária para completar o módulo;
conquistas já concedidas não são removidas.

O histórico contém apenas tentativas do próprio participante, inclusive seu
histórico pessoal anterior em campanhas; não retorna nomes ou dados de outras
organizações. Para enviar com `assignmentId`, a transação exige proprietário
correto, vínculo na organização da campanha, campanha ativa e módulo correto.
Tentativas de estudo livre não completam uma campanha: a atribuição só é
concluída após respostas registradas explicitamente para ela. Uma campanha
fechada bloqueia novas tentativas, mas aceita o replay de uma tentativa já
confirmada enquanto o vínculo correspondente continuar válido.

## Idempotência e falhas de conexão

Persista localmente o UUID e o payload antes do envio. Em timeout, erro de rede
ou resposta inconclusiva, **reenvie o mesmo UUID e os mesmos dados**. Não gere
um novo ID para retry: o banco pode ter confirmado mesmo sem o cliente receber
a resposta. A RPC não faz retry HTTP automático; a API retorna `503` sanitizado.

O resultado original fica congelado em `exercise_attempts.result`. Replay não
reavalia gabaritos editados nem altera a data original. `pointsAwarded` no replay
também é o valor original: não deve ser somado novamente pelo cliente. Use
`GET /me/progress` como fonte do saldo atual.

Erros: `400` para parâmetros/alternativa inválidos; `401` sem identidade válida;
`403` sem acesso; `404` para conteúdo indisponível; `409` para conflito de ID
ou conteúdo incompleto (categoria/gabarito); `503` para indisponibilidade.
Resposta do banco fora do contrato gera `500` sem expor seus dados. Também
nesse caso conserve o ID para eventual reconciliação.

## Migração e ativação

Arquivo local: `supabase/migrations/20261111015515_aex_attempts_progress_transaction.sql`.
Foi criado pela CLI fixada e **não foi aplicado ao banco remoto nesta entrega**.
Os endpoints novos exigem essa migração para funcionar no ambiente hospedado.

A migração acrescenta somente o necessário:

- `exercises.category`, pois a conquista de phishing depende de informação que
  não existia no esquema. Registros antigos ficam com `NULL` até classificação
  explícita do operador; não se adivinha categoria por título.
- `exercise_attempts.result`, para devolver feedback imutável em retries e no
  histórico. Tentativas antigas são preservadas e recebem um snapshot do texto
  disponível na migração; a correção registrada originalmente é preservada.
- Índices de consultas de progresso/atribuição, catálogo das três conquistas e
  as duas funções restritas.

Os tipos Supabase locais foram complementados para refletir essa migração.
Depois de aplicá-la, podem ser regenerados pelo fluxo oficial.
Antes de publicar a API nova, confira o histórico e o dry-run:

```sh
npm run db:history
npm run db:dry-run
```

A única migração nova esperada é `20261111015515`. Não reaplique a migração
inicial nem altere seu timestamp. Em ambiente autorizado, após revisar o
dry-run, aplique pelo fluxo da CLI 3.1.0:

```sh
npm run supabase -- db push --remote=iskobkikhtwamsdhsscn --skip-vault
```

Não inclua `--include-seed`: a seed fictícia continua separada do deploy remoto.
Redes sem IPv6 precisam do pooler indicado na documentação Supabase da 5.2.
Execute a migração como unidade transacional; não aplique apenas a criação da
função sem as revogações e concessões de execução.

Após a migração, a seed `supabase/seeds/educational_demo.sql` também preenche
categorias ausentes dos três IDs fictícios conhecidos. Preserva classificações
já existentes. Ela depende agora da migração 5.5. Não cria participantes.

## Verificações direcionadas

```sh
npm run build --workspace=@aex/types
npm run build --workspace=@aex/validation
npm run typecheck --workspace=@aex/api
npm run test:attempts --workspace=@aex/api
npm run build --workspace=@aex/api
```

Use `npm.cmd` no PowerShell quando necessário. `test:attempts` executa somente
os testes HTTP da 5.5 e os testes PostgreSQL, sem reexecutar as fases anteriores.

Resultados: **31 testes HTTP** passaram na retomada; **16 testes PostgreSQL**
já haviam passado antes da interrupção e foram preservados. Cobrem acertos,
erros, duplicidade, alternativa de outro exercício, identidade/vínculo,
isolamento pessoal e de atribuições, RPC restrita, recompensas e rollback após
falha tardia. Os testes HTTP usam NestJS e SDK reais com transporte simulado;
os SQL executam migrações e funções em PostgreSQL embarcado temporário (PGlite),
sem usuários reais ou alterações no projeto remoto.

PGlite usa uma única sessão: testa transações e reenvios, mas não substitui um
teste de carga com múltiplas conexões PostgreSQL. A serialização concorrente
da implementação se baseia no bloqueio transacional da linha de perfil e nas
constraints existentes. A integração completa no Supabase remoto permanece
dependente da aplicação da migração e de uma conta de teste provisionada.
