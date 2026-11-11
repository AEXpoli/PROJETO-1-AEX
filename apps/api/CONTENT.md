# AEX — Fase 5.4: conteúdos educativos

## Endpoints

Todos exigem `Authorization: Bearer <access_token>` validado pelo Supabase Auth
e pelo menos um vínculo atual em `organization_members` (`participant` ou
`admin`). Não há leitura anônima. As respostas usam `Cache-Control: no-store`.

| Método e caminho | Resposta |
| --- | --- |
| `GET /modules` | Array de módulos publicados, ordenados por `sortOrder` e ID |
| `GET /modules/:id` | Módulo publicado |
| `GET /modules/:id/exercises` | Array de exercícios publicados do módulo publicado |
| `GET /exercises/:id` | Exercício publicado cujo módulo também está publicado |

O modelo atual é um **catálogo global**: `learning_modules`/`exercises` não têm
coluna de organização nem ACL própria. Nesta etapa, um vínculo organizacional
válido autoriza a leitura do catálogo publicado. Não se inferem restrições por
campanha nem se expõem dados de organizações ou outros participantes.

Exemplo de módulo:

```json
{
  "id": "a5400000-0000-4000-8000-000000000001",
  "title": "Mensagens e contatos digitais",
  "description": "Três situações fictícias para praticar decisões no dia a dia.",
  "sortOrder": 0
}
```

O exercício retorna exclusivamente `id`, `moduleId`, `title`, `scenario` (texto),
`question`, `sortOrder` e `options: [{ id, label }]`. Alternativas são ordenadas
por `sort_order`, com desempate por ID, nunca pelo gabarito.

## Contratos e proteção de gabaritos

`@aex/types` exporta `LearningModule` e `ParticipantExercise`. Este último
reutiliza os campos seguros de `Exercise` e suas opções públicas
`ExerciseOption`. O contrato mockado contém cenário estruturado e `takeaway`;
o banco atual contém cenário em texto. Por isso a API usa um contrato de
leitura específico, sem inventar campos ausentes ou mudar os mocks/telas.

`@aex/validation` disponibiliza schemas Zod compartilhados de UUID, módulo,
alternativa, exercício e coleções. A API valida os IDs antes de consultar
conteúdo e valida as respostas antes de retorná-las. Um exercício publicado
deve ter pelo menos duas alternativas com IDs distintos e textos não vazios.

As projeções PostgREST são explícitas: a consulta de alternativas seleciona
**somente `id,option_text,sort_order`**. `is_correct` e `explanation` não são
consultados. A serialização monta cada objeto com uma lista explícita de
campos, sem espalhar linhas do banco. `takeaway`, `correctOptionId`, resultados,
metadados internos e dicas de correção também não fazem parte da resposta.
Isso vale igualmente para admins usando estes endpoints. Parâmetros como
`select=*`, `includeAnswers=true`, `status=draft` ou roles enviados pelo cliente
não alteram a projeção ou os filtros.

O exercício é consultado com join obrigatório ao módulo e filtros de
publicação para ambos, inclusive na busca direta por ID. O catálogo vazio e
um módulo publicado sem exercícios retornam `[]`; IDs inexistentes,
arquivados ou em rascunho retornam `404` sem distinguir sua existência.
UUID inválido retorna `400`, falta de autenticação `401`, falta de vínculo
`403`, conteúdo inválido `500` e falha do banco `503`, com mensagens sanitizadas.
As consultas mantêm timeout de 5 segundos e retries desativados.

As coleções seguem o limite configurado de linhas do Data API (atualmente
1000). Paginação de catálogos maiores não foi adicionada nesta etapa.

## Seed fictícia

Arquivo: `supabase/seeds/educational_demo.sql`. Contém:

- 1 módulo publicado;
- 3 exercícios publicados: SMS suspeito, Links fraudulentos e Falsa central bancária;
- 9 alternativas, com um gabarito por exercício.

O conteúdo se baseia nos mocks do mobile. Organizações comerciais e banco são
fictícios; endereços usam `.invalid`. O cenário é a mensagem/situação antes da
resposta. Explicações educativas ficam somente em `exercise_options.explanation`.
Não há criação de contas, perfis, vínculos, participantes ou campanhas.

A seed contém gabaritos para uso exclusivo do backend/banco. Não importe esse
arquivo em bundles do mobile/admin nem o publique como recurso estático.
Ele usa transação e IDs fixos com `ON CONFLICT (id) DO NOTHING`: reexecutar não
duplica nem sobrescreve conteúdo existente. Uma colisão com outra constraint
aborta a transação; não remova constraints para forçar a carga.

`supabase/config.toml` habilita a seed para inicialização/reset **local**. Com
a stack local e a migração existente já disponíveis, execute da raiz:

```sh
npm run supabase -- db query --file supabase/seeds/educational_demo.sql
```

Esse comando foi verificado na ajuda da CLI **3.1.0** e usa o banco local por
padrão. Não adiciona migração ao histórico, não recria tabelas e não precisa de
`db push`. Não execute reset no banco remoto. Nesta entrega a seed foi apenas
versionada e testada em banco temporário; **não foi aplicada ao projeto remoto**.
Referências: [seeds Supabase](https://supabase.com/docs/guides/local-development/seeding-your-database)
e [projeções select](https://supabase.com/docs/reference/javascript/select).

## Testar

Compile os pacotes compartilhados alterados antes da API:

```sh
npm run build --workspace=@aex/types
npm run build --workspace=@aex/validation
npm run typecheck --workspace=@aex/api
npm run lint --workspace=@aex/api
npm run test --workspace=@aex/api
npm run test --workspace=@aex/validation
npm run build --workspace=@aex/api
npm run start --workspace=@aex/api
```

No PowerShell, use `npm.cmd` se necessário. Com token obtido pelo fluxo da
[Fase 5.3](AUTH.md) e uma conta com vínculo, faça a leitura sem imprimir o token:

```powershell
Invoke-RestMethod http://localhost:3002/modules -Headers @{ Authorization = "Bearer $env:AEX_ACCESS_TOKEN" }
```

Validação realizada: 70 testes da API e 22 de validação compartilhada passaram,
assim como build/typecheck/lint nos componentes alterados. Os testes de conteúdo
exercitam NestJS e SDK reais com transporte simulado e verificam filtros de
publicação, vínculo, UUIDs, erros e ausência de gabaritos, inclusive quando o
transporte retorna campos extras maliciosos.

A migração existente e a seed foram executadas em PostgreSQL embarcado
temporário (PGlite 0.5.16), com duas aplicações da seed, validando constraints,
idempotência e ausência de usuários/vínculos. Nenhuma dependência de teste foi
adicionada ao monorepo para isso. As consultas de módulos e do join
exercício/módulo/opções também foram verificadas em leitura no Supabase real:
o catálogo remoto estava vazio e um ID inexistente retornou `404`.

Nenhuma migração, RLS ou permissão foi alterada. Envio de respostas e mudanças
visuais permanecem fora desta etapa.
