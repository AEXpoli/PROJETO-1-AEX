# AEX — Fase 5.3: autenticação e autorização

## Endpoints disponíveis

| Método e caminho | Acesso | Resposta |
| --- | --- | --- |
| `GET /health/live` | Público | `{ "status": "ok" }` |
| `GET /me` | Bearer token válido + vínculo organizacional | Perfil próprio e organizações vinculadas, com papel em cada uma |

Exemplo de `/me`:

```json
{
  "profile": { "id": "uuid-do-usuario", "display_name": "Nome" },
  "organizations": [{ "id": "uuid-da-organizacao", "name": "Organização", "role": "participant" }]
}
```

`/me` envia `Cache-Control: no-store`. Token ausente, malformado, inválido,
expirado ou usuário anônimo retorna `401`. Usuário válido sem vínculo/perfil
provisionado retorna `403`. Falha do Auth/banco retorna `503`, sem detalhes
internos ou credenciais. Não há endpoints de provisionamento, cadastro,
promoção de papel, exercícios ou campanhas. As rotas `/test/...` só existem
no módulo de testes e não são carregadas pela API.

## Fluxo de autenticação

1. O usuário autentica diretamente no Supabase Auth do projeto, por um método
   habilitado pelo operador. Para um teste manual com conta existente, use
   `auth.signInWithPassword` num cliente isolado com chave **publishable**.
   Login/refresh/logout continuam sob responsabilidade do cliente Auth; as telas
   não foram integradas nesta etapa.
2. O cliente envia o **access_token** da sessão em
   `Authorization: Bearer <access_token>` à API. Não envie refresh token,
   senha ou chave privilegiada como Bearer.
3. O guard global chama `auth.getUser(token)` no SDK oficial já instalado
   (`@supabase/supabase-js` 2.119.0). O Auth do projeto valida o token; não há
   decodificação local sem verificação, nem confiança em `getSession()`.
4. Somente o ID retornado pelo Auth entra no contexto da requisição.
   `user_metadata`, `app_metadata`, roles no JWT, body, query ou headers não
   concedem papéis na aplicação. Os papéis são consultados em
   `organization_members`, filtrados pelo ID autenticado.
5. `/me` primeiro verifica os vínculos e depois consulta o próprio perfil e as
   organizações usando uma lista explícita dos IDs autorizados. Não aceita um
   ID de usuário/organização enviado pelo cliente para ampliar essa consulta.

`getUser(token)` não altera a sessão do singleton privilegiado. A API não chama
`setSession` nem `signInWithPassword` nesse singleton. Persistência/refresh
automático seguem desativados. Requisições ao Supabase têm timeout de 5s;
consultas de autorização não fazem retries nem guardam papéis em cache.

O mecanismo valida os tokens conforme o Supabase Auth. Não implementa uma
lista própria de sessões revogadas: logout não deve ser tratado como garantia
de invalidação imediata de access tokens já emitidos antes da expiração.
A remoção de vínculo/papel no banco é refletida na próxima requisição.

Referências oficiais:
[getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword),
[getUserById](https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid).

## Reutilizar a autorização

As rotas são autenticadas por padrão pelo `APP_GUARD`. `@Public()` é uma exceção
explícita, usada somente no health check. Para uma futura rota de organização,
importe `AuthModule` no módulo e aplique o decorator:

```ts
@Get('organizations/:organizationId/recurso')
@RequireOrganization('admin')
```

Para acesso de ambos os papéis, use
`@RequireOrganization('admin', 'participant')`. O guard exige um UUID no
parâmetro `organizationId` e consulta **simultaneamente** `user_id` e
`organization_id`. Um admin da organização A não é admin da B. O vínculo
validado fica em `request.membership`; a identidade em `request.identity`.

Qualquer consulta futura de recursos deve usar o `organization_id` desse
vínculo também no filtro SQL/PostgREST, inclusive buscas por ID de recurso.
O guard não torna segura uma consulta posterior sem filtro de organização.
`OrganizationAccessService.requireMembership` pode ser reutilizado em serviços
recebendo a identidade validada, nunca um `userId` arbitrário do cliente.

Nenhuma migração, política RLS ou GRANT foi alterado. A chave privilegiada
continua somente em `apps/api/.env`/segredos do backend. Como esse cliente tem
privilégios elevados, os filtros e verificações acima são obrigatórios.
Os tipos de banco foram gerados a partir do projeto, sem copiar dados.

## Provisionamento inicial controlado

Este fluxo é exclusivo do operador com acesso ao ambiente e à chave secreta
do backend. Não é uma capacidade disponível ao usuário admin na aplicação.

1. Configure `SUPABASE_URL` e `SUPABASE_SECRET_KEY` conforme `.env.example`.
2. No painel Supabase, prepare a organização e a conta Auth do usuário pelo
   procedimento administrativo autorizado. A conta deve ter email ou telefone
   confirmado. O script não cria contas, envia convites, confirma emails ou
   define senhas automaticamente.
3. Confira os UUIDs do usuário Auth e da organização. Execute a prévia da raiz:

```sh
npm run provision:user --workspace=@aex/api -- --user-id UUID_USUARIO --organization-id UUID_ORGANIZACAO --display-name "Nome" --role admin
```

4. Revise o projeto configurado e a prévia. Repita com `--apply` para gravar.
   Para um participante inicial, use `--role participant`.

O comando exige papel explícito e não faz alterações sem `--apply`. Confere a
conta Auth, confirmação de contato, organização existente e vínculo atual.
Cria perfil e vínculo faltantes com `ignoreDuplicates`, sem sobrescrever nome
ou papel existente. Recusa divergências de papel, inclusive sob concorrência;
não serve para promover participantes. Ao final, relê e verifica o vínculo.

As duas gravações não são uma transação única. Se ocorrer falha após criar o
perfil, pode restar um perfil sem vínculo; ele continua sem acesso à API.
Corrija a causa e repita o comando: conflitos são ignorados e perfis existentes
são preservados. Não apague uma conta ou perfil existente como rollback.
Não coloque senha/chave/token nos argumentos. Execute em terminal confiável.
Nenhum usuário, perfil ou administrador foi criado automaticamente nesta etapa.

## Validação

Da raiz (use `npm.cmd` no PowerShell quando necessário):

```sh
npm run typecheck --workspace=@aex/api
npm run lint --workspace=@aex/api
npm run test --workspace=@aex/api
npm run build --workspace=@aex/api
npm run check:supabase --workspace=@aex/api
npm run start --workspace=@aex/api
```

Com um access token obtido pelo Auth e colocado na variável de sessão
`AEX_ACCESS_TOKEN`, teste no PowerShell sem imprimir o token:

```powershell
Invoke-RestMethod http://localhost:3002/me -Headers @{ Authorization = "Bearer $env:AEX_ACCESS_TOKEN" }
```

Os testes executam HTTP NestJS, guards e SDK reais com transporte Supabase
simulado. Cobrem os seis casos solicitados, filtros por usuário/organização,
metadata forjada, remoção de vínculo entre requisições, indisponibilidade,
cache e provisionamento sem promoção/overwrite. Não criam dados remotos.
Um teste positivo contra o Auth real exige uma conta provisionada e seu token;
os testes simulados não substituem essa validação operacional.

Resultado desta etapa: typecheck, lint, build e 31 testes passaram. A conexão
real ao banco foi validada por HEAD e o Auth real rejeitou um token inválido
com `401`. Não foi realizado login positivo remoto nem criado usuário de teste.
