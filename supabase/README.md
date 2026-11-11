# AEX — Fase 5.2

Projeto remoto: `iskobkikhtwamsdhsscn`. PostgreSQL remoto: 17.11.
`config.toml` foi gerado por `supabase init` e configura a stack local; seu
`project_id = "aex"` identifica os containers locais, não o projeto hospedado.
Seeds estão desativados nesta etapa.

## Versões e comandos

CLI **3.1.0** fixada em `devDependencies` na raiz, cliente
**@supabase/supabase-js 2.119.0** somente em `apps/api`, ambos no lockfile.
Use Node 22.14 e npm 10.9.2, conforme o monorepo. Execute da raiz:

```sh
npm ci
npm run supabase -- --version
npm run supabase -- migration fetch --help
npm run supabase -- migration list --help
npm run supabase -- db push --help
```

A CLI v3 usa o banco local por padrão; comandos remotos precisam de `--remote`.
As opções acima foram verificadas na ajuda da versão instalada. Referências:
[mudanças da CLI v3](https://supabase.com/changelog/supabase-cli-v3),
[migration fetch](https://supabase.com/docs/reference/cli/supabase-migration-fetch).
Algumas páginas de referência ainda mostram opções da v2; prevalece a ajuda da
versão fixada. Não use `npx supabase@latest` neste fluxo.

## Histórico existente, sem reaplicar CREATE TABLE

O arquivo `migrations/20261111002325_aex_initial_schema_backend_only.sql` foi
recuperado de `supabase_migrations.schema_migrations`, preservando versão, nome
e SQL originais. Não é uma nova migração e não recebeu um timestamp novo.
Contém as 12 tabelas, índices, constraints, RLS e revogações originais.
Não houve DDL, repair, push, reset, seed ou alteração do histórico remoto.

A tentativa `supabase migration fetch --remote=iskobkikhtwamsdhsscn` falhou com
`DbConfigIpv6Error` nesta rede. Como alternativa, o SQL foi recuperado via
consulta somente leitura pelo plugin Supabase. O MD5 do arquivo com quebras LF
é `916d5890ec91b735671b34dbf362ece5`, idêntico ao SQL registrado remotamente.
O histórico consultado possui exatamente essa migração. As 12 tabelas remotas
foram verificadas: RLS ativo, privilégios de anon/authenticated revogados e
SELECT permitido a service_role.

Em um ambiente com acesso ao banco, autentique a CLI (credencial de gestão,
distinta da chave secreta da API), e confira:

```sh
npm run supabase -- login
npm run supabase -- link iskobkikhtwamsdhsscn
npm run db:history
npm run db:dry-run
```

O resultado esperado é a versão `20261111002325` nas duas colunas e nenhuma
migração pendente. O dry-run inclui `--skip-vault` e não aplica SQL.
Se necessário, use a URL do **session pooler** fornecida pelo painel em
`--remote=<pooler db-url>` para redes sem IPv6. Forneça credenciais de conexão
por ambiente seguro; não as grave em scripts ou arquivos versionados.

Para recuperar arquivos perdidos em outro checkout, o comando da v3 é
`npm run supabase -- migration fetch --remote=iskobkikhtwamsdhsscn`.
Faça isso apenas com os arquivos locais preservados e revise o diff resultante.
Não gere uma segunda baseline via `db pull`, não renomeie a migração original
e não marque a versão como revertida: isso pode tentar criar tabelas já existentes.
Não há necessidade de `migration repair` para o histórico atual.

## Configuração da API

Copie `apps/api/.env.example` para `apps/api/.env` e configure:

```dotenv
PORT=3002
SUPABASE_URL=https://iskobkikhtwamsdhsscn.supabase.co
SUPABASE_SECRET_KEY=
```

Preencha a chave `sb_secret_...` em **Settings > API Keys** exclusivamente no
arquivo local ou no gerenciador de segredos do backend. O exemplo não contém
segredos. `.env` e variantes privadas são ignorados pelo Git. Não use prefixos
`EXPO_PUBLIC_`/`NEXT_PUBLIC_`, nem copie a chave para admin, mobile ou packages.
Esta implementação usa a chave secreta moderna; não aceita chave anon,
publishable ou JWT legado service_role. Veja
[API keys](https://supabase.com/docs/guides/api/api-keys).

O carregamento do `.env` é relativo à API, inclusive ao executar o JS compilado
da raiz. Variáveis já fornecidas pelo processo têm precedência. Configuração
ausente/inválida impede a inicialização e produz mensagens sem valores secretos.

`SupabaseModule` exporta um singleton `SupabaseService`. Outros módulos da API
podem importar esse módulo e injetar o serviço. `client` é privilegiado e de uso
exclusivo do backend; não deve receber sessões de usuários. Persistência,
renovação automática e detecção de sessão na URL estão desativadas.

O tsconfig da API inclui os tipos DOM exigidos pelo SDK isomórfico e usa
`skipLibCheck` devido à incompatibilidade entre as declarações WebAuthn do
auth-js instalado e o DOM do TypeScript 6. A checagem estrita do código da API
permanece ativa; os demais workspaces não foram modificados.

## Testar

```sh
npm run typecheck --workspace=@aex/api
npm run lint --workspace=@aex/api
npm run test --workspace=@aex/api
npm run check:supabase --workspace=@aex/api
```

No PowerShell com execução de scripts desativada, use `npm.cmd`.
`check:supabase` compila a API e instancia o módulo NestJS sem abrir porta HTTP.
Executa um HEAD em `organizations`, selecionando apenas `id`, com limite 1,
timeout de 5 segundos e sem retries. Funciona com tabela vazia, não retorna
linhas e não altera dados. Sucesso imprime `Supabase: conexão OK` e termina
com código 0; falha termina com código 1 e mensagem sanitizada.

Os testes automatizados simulam o transporte HTTP para verificar HEAD,
configuração obrigatória, falha de permissão e falha de rede, além da rota
`/health/live`. Não precisam de credenciais e não substituem a checagem real.
Na implementação, as consultas remotas de leitura e a comparação do histórico
foram bem-sucedidas pelo plugin. A conexão via serviço da API fica pendente de
`SUPABASE_SECRET_KEY`, ausente no ambiente; a comparação/dry-run via CLI também
depende de resolver o acesso de rede indicado acima.

Nenhum login, endpoint de negócio ou integração com interfaces foi adicionado.
