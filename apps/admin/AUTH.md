# Autenticação administrativa — Etapa 5.7

O painel usa Next.js 16.4.2, `@supabase/supabase-js` 2.119.0 e `@supabase/ssr`
0.12.7. Login e demais operações Auth são Server Actions; não existe cadastro
público administrativo nem cliente Supabase no navegador.

## Telas e rotas

| Rota | Função |
| --- | --- |
| `/login` | Login administrativo |
| `/auth/confirm` | Confirmação explícita do convite recebido por e-mail |
| `/ativar-conta` | Definição de senha e ativação do vínculo autorizado |
| `/esqueci-minha-senha` | Solicitação de recuperação |
| `/auth/callback` | Troca do código PKCE da recuperação pela sessão |
| `/redefinir-senha` | Nova senha; encerra a sessão local ao concluir |
| `/auth/erro` | Link inválido, expirado ou já utilizado |
| `/acesso-nao-autorizado` | Sem vínculo administrativo ou serviço indisponível |
| `/convites` | Envio de convites por administrador da organização selecionada |

Dashboard, participantes, simulações, resultados e convites estão no grupo
`(panel)`, mantendo suas URLs. Layout, acesso ao relatório e ações protegidas
verificam autorização no servidor. O estado de carregamento informa que a sessão
e a autorização estão sendo verificadas. Os indicadores continuam fictícios.

## Sessão e autorização

`@supabase/ssr` persiste a sessão em cookies com `HttpOnly`, `SameSite=Lax`,
`Path=/` e `Secure` em produção. O navegador não precisa ler tokens; somente o
servidor acessa Supabase Auth e a API. `src/proxy.ts` renova/verifica a sessão
com `getClaims` e propaga cookies e cabeçalhos de cache do SDK. Respostas usam
`private, no-store` e `Referrer-Policy: no-referrer`; páginas são dinâmicas.

A camada de acesso chama `getUser`, obtém o bearer da sessão e consulta `GET /me`.
O perfil deve corresponder à identidade validada, e a organização selecionada
deve ter `role=admin`. A API confirma novamente esse vínculo em
`GET /organizations/:organizationId/admin-access`, utilizando o guard da Etapa 5.3.
Papéis de metadados ou enviados pelo navegador não autorizam nenhuma operação.

O seletor só apresenta organizações administrativas. Seu cookie não é confiável:
a seleção é revalidada na API a cada acesso/ação. Nenhum token é passado como prop
para componentes cliente. Logout remove todos os cookies da sessão local, mesmo
se o serviço remoto estiver indisponível. Server Actions usam a proteção de
origem/CSRF do Next.js; não foi adicionada uma lista permissiva de origens.

## Complemento mínimo na API

Não havia convite HTTP na Etapa 5.3, apenas provisionamento por operador.
Foram acrescentados:

- `GET /organizations/:organizationId/admin-access`: exige administrador nessa organização.
- `POST /organizations/:organizationId/admin-invitations`: exige administrador;
  recebe somente `{ "email": "pessoa@example.test", "display_name": "Pessoa" }`.
- `POST /admin-invitations/:id/accept`: exige identidade autenticada; o usuário
  vem exclusivamente do token. Organização e papel vêm do convite persistido.

A migração `20261111155233_aex_admin_invitations.sql` cria uma tabela nova com RLS
e três funções restritas a `service_role`. `anon` e `authenticated` não podem
ler a tabela nem executar as funções. Nenhuma tabela existente é recriada e
nenhuma permissão anterior é ampliada.

Fluxo:

1. A API e a função SQL verificam o vínculo do emissor na organização.
2. O banco registra um convite pendente de 24 horas, com e-mail e nome definidos
   pelo administrador. Reenvios na mesma organização/e-mail têm intervalo mínimo
   de um minuto; um novo convite invalida o anterior ainda pendente.
3. A API usa `auth.admin.inviteUserByEmail`. Somente depois do envio confirmado
   registra o UUID Auth destinatário e o estado `sent`. Envio ambíguo/falho não
   concede acesso. Não há tentativa de tratar HTTPs distintos como transação.
4. A pessoa abre o e-mail e clica em **Continuar ativação**. O POST verifica o
   token com `verifyOtp(type: 'invite')`. Abrir a página por GET não consome o
   token, reduzindo problemas com scanners de e-mail.
5. Após definir a senha, a API aceita o convite em uma transação: bloqueia o
   convite, confere validade/uso único, UUID e e-mail confirmado do destinatário,
   revalida o emissor e cria perfil/vínculo `admin`. Qualquer falha desfaz todas
   essas alterações. Um participante existente nunca é promovido por esse fluxo.

Esse onboarding atende **novas contas Auth**. Contas já confirmadas devem ser
tratadas pelo operador responsável; não foi criado um mecanismo de promoção.
O primeiro administrador continua sendo provisionado pelo comando da Etapa 5.3.
Se a resposta da ativação se perder após o commit, o usuário pode entrar normalmente;
repetir a aceitação não gera outro vínculo.

## Configuração necessária

Em `apps/admin/.env.local` (ou `.env`), use o exemplo versionado:

```dotenv
API_URL=http://localhost:3002
ADMIN_SITE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://iskobkikhtwamsdhsscn.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE_PUBLICA
```

Na API, preserve suas credenciais existentes e acrescente
`ADMIN_SITE_URL=http://localhost:3001`. A chave secret/service_role fica apenas
na API. O admin aceita somente chave pública `sb_publishable_`. Em produção,
configure HTTPS para a origem do painel e a API. Use a mesma origem administrativa
na API, no Next.js e nos links cadastrados; não derive a URL de convite de headers
ou de campos enviados pelo cliente.

A migração foi validada localmente com PGlite/PostgreSQL e **não foi aplicada no
Supabase remoto nesta entrega**. Antes de habilitar convites, confira o histórico
e a prévia da aplicação usando a CLI 3.1.0 instalada:

```sh
npm run db:history
npm run db:dry-run
```

Depois de conferir que a prévia inclui apenas as migrações esperadas, a aplicação
é feita com:

```sh
npm run supabase -- db push --remote=iskobkikhtwamsdhsscn --skip-vault
```

Não use `--include-all`, reparo de histórico ou recriação de tabelas para aplicar
esta etapa. Se houver outra migração pendente, confira sua implantação antes de
prosseguir. O login de administradores já provisionados usa as tabelas existentes;
o envio e a ativação de convites dependem da nova migração.

No Supabase Dashboard, mantenha os callbacks mobile existentes e configure:

- **Authentication → URL Configuration → Redirect URLs**:
  `http://localhost:3001/auth/callback` e
  `http://localhost:3001/auth/confirm?invitation_id=*`.
  Cadastre os equivalentes HTTPS do ambiente publicado. O curinga é limitado
  ao ID do convite; a API sempre constrói o destino fixo `/auth/confirm`.
- **Email Templates → Invite user**: use o link abaixo. O `RedirectTo` já contém
  `?invitation_id=UUID`, produzido exclusivamente pela API:

  ```html
  <h2>Convite para administrar o AEX</h2>
  <p>Você recebeu um convite pessoal da sua instituição.</p>
  <a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=invite">Ativar minha conta</a>
  ```

- **Reset password**: mantenha `{{ .ConfirmationURL }}`. A recuperação usa PKCE e
  deve ser aberta no mesmo navegador que fez a solicitação. O template padrão
  também preserva o fluxo implicit do mobile; não substitua por um callback
  exclusivo do admin. Caso o template já contenha `{{ .Token }}`, pode mantê-lo.
- Configure envio de e-mails para os destinatários de teste/produção. O SMTP
  padrão do Supabase restringe destinatários; use SMTP próprio quando necessário.

Não foram alteradas configurações remotas de e-mail, criados usuários reais ou
enviados convites durante os testes automatizados.

## Testar pelo navegador

Em terminais separados, na raiz:

```sh
npm run dev --workspace=@aex/api
npm run dev --workspace=@aex/admin
```

Abra `http://localhost:3001/login`:

1. Entre com um administrador já provisionado. Confira nome e organização.
2. Teste senha incorreta, participante e usuário sem vínculo: nenhum deve acessar
   o painel. Após sair, abrir `/participantes` diretamente exige novo login.
3. Em **Convidar administrador**, envie para um e-mail de teste novo. Abra o link,
   confirme, defina a senha e confira o acesso à organização convidante.
4. Reabra o convite utilizado ou um link expirado: não deve ativar outro vínculo.
5. Use **Esqueci minha senha**, abra o e-mail no mesmo navegador e redefina a senha.
   Ao concluir, entre novamente com a nova senha.
6. Com múltiplos vínculos, alterne organizações autorizadas. Uma seleção forjada
   ou uma organização na qual a conta seja apenas participante deve ser negada.

## Verificações executadas

- `npm run test:auth --workspace=@aex/admin`: **11 testes aprovados**, incluindo
  SDK SSR real com HTTP simulado, cookies, PKCE, login, convite e logout.
- `npm run test:admin-auth --workspace=@aex/api`: **30 testes HTTP aprovados**
  (autenticação existente e convites), mais **11 testes PostgreSQL/PGlite**.
- Typecheck admin e API: **aprovados**.
- Lint admin e dos arquivos alterados da API: **aprovados**.
- Build de produção admin: **aprovado**, com todas as rotas dinâmicas.
- `test:auth:http`: **1 teste aprovado**, verificando as páginas públicas,
  cinco rotas protegidas e callback inválido contra Next.js local com configuração
  fictícia. Não executa envio de e-mail nem acesso a dados remotos.

Para repetir o smoke HTTP, inicie um admin isolado com Supabase URL
`https://example.supabase.co`, publishable `sb_publishable_test`, API
`http://127.0.0.1:1` e origem `http://localhost:3107`, na porta 3107. Depois defina
`AEX_ADMIN_TEST_URL=http://127.0.0.1:3107` e execute
`npm run test:auth:http --workspace=@aex/admin`. Sem essa variável, o teste é pulado.

Há um patch pontual em `patches/@supabase+auth-js+2.119.0.patch`: o tipo futuro
WebAuthn do SDK passa a substituir explicitamente `toJSON` do DOM do TypeScript 6,
preservando o retorno genérico próprio. Não altera JavaScript de autenticação,
não usa `any` e não desabilita verificações. A aplicação isolada do patch foi
verificada; o `postinstall` existente o aplica nas instalações normais.

Permanecem como validação operacional: aplicar a migração, configurar templates,
testar entrega real de e-mail e executar os fluxos autenticados em navegador com
contas autorizadas. A integração de indicadores reais continua para a Etapa 5.9.

Referências: [SSR Supabase com Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[convite oficial](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail),
[redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls),
[templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
