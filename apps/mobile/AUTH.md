# Autenticação do participante — Etapa 5.6

O aplicativo usa Supabase Auth para cadastro, login, confirmação de e-mail,
recuperação e alteração de senha. Depois de autenticar, consulta `GET /me` com
`Authorization: Bearer <access_token>`. Somente uma resposta válida da API, com
perfil correspondente à sessão e vínculo organizacional, libera a jornada.

## Telas e comportamento

- Boas-vindas, login e criar conta (nome, e-mail, senha e confirmação).
- Confirmação de e-mail, reenvio e entrada alternativa de código.
- Esqueci minha senha, instruções enviadas e definição da nova senha.
- Carregamento da sessão, falha de conexão e aguardando liberação institucional.
- Logout em Meu perfil e nos estados de acesso pendente/indisponível.

As telas usam a identidade visual existente, campos grandes, fonte de 20 px nos
campos, botões acessíveis, mostrar/ocultar senha, estados de envio, anúncios de
erro para leitores de tela e ajuste ao teclado. A validação com TalkBack,
VoiceOver, teclado físico e aparelho real ainda precisa ser feita.

Não existe cadastro administrativo ou escolha de organização/papel no aplicativo.
O nome enviado no cadastro é apenas `user_metadata.display_name`; não concede
permissões. O app não lê tabelas diretamente nem altera RLS ou permissões.

## Configuração local

Crie `apps/mobile/.env` a partir de `.env.example` e preencha:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:3002
EXPO_PUBLIC_SUPABASE_URL=https://iskobkikhtwamsdhsscn.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE_PUBLICA
```

Use o IP local do computador no lugar do exemplo. `localhost` no celular aponta
para o próprio celular. A API já escuta em `0.0.0.0:3002`; computador e celular
devem estar na mesma rede e a porta precisa estar acessível. Em distribuição,
a URL da API deve usar HTTPS (o app rejeita HTTP fora do modo de desenvolvimento).

Obtenha a chave **publishable** nas configurações de API do projeto. Este cliente
aceita apenas chaves `sb_publishable_`. Nunca copie o `.env` da API para o mobile:
valores `EXPO_PUBLIC_*` fazem parte do aplicativo. As chaves secret/service_role
continuam exclusivamente no backend. Não versione os arquivos `.env`.

No Supabase Dashboard:

1. Mantenha o provedor de e-mail habilitado e permita cadastro de contas Auth.
   Isso não provisiona perfis nem vínculos nas tabelas do AEX.
2. Configure confirmação de e-mail conforme a política do projeto. O aplicativo
   aceita tanto a confirmação necessária quanto a sessão imediata, sempre sujeita
   à liberação institucional.
3. Em **Authentication → URL Configuration → Redirect URLs**, adicione o callback
   exato do ambiente. Para Expo Go via LAN, por exemplo:
   `exp://192.168.1.10:8081/--/auth/callback`. Use o endereço/porta exibidos pelo
   Expo para o celular e acrescente `/--/auth/callback`. Se mudar rede, IP ou porta,
   atualize a entrada. Para o aplicativo instalado com scheme `aex`, adicione
   `aex://auth/callback`. Não use esse último endereço para abrir o Expo Go.
4. Nos templates **Confirm signup** e **Reset password**, mantenha o link
   `{{ .ConfirmationURL }}`. Opcionalmente, inclua também `{{ .Token }}` para
   permitir digitar o código no app quando o cliente de e-mail não abrir Expo Go.
   O template de recuperação deve usar o token de recuperação, não o de signup.
5. Use um endereço de teste atendido pela configuração de envio do projeto.
   O serviço padrão de e-mail do Supabase restringe destinatários; configure SMTP
   para destinatários externos conforme necessário.

O callback é produzido por `Linking.createURL('auth/callback')`, validado pelo
aplicativo e passado ao SDK em todos os envios de confirmação/recuperação. A
sessão do link usa `auth.setSession`; a alternativa por código usa `verifyOtp`.
O fluxo nativo é `implicit`, compatível com os callbacks documentados do Supabase.
Links de recuperação levam à nova senha antes de liberar qualquer atividade.
Após trocar a senha, o aplicativo encerra a sessão local e solicita novo login.

## Testar no Expo Go

Na raiz do monorepo, em terminais separados:

```sh
npm run dev --workspace=@aex/api
npm run dev --workspace=@aex/mobile -- --lan
```

Use Expo Go compatível com o SDK 58 e leia o QR code. Reinicie o Expo após mudar
as variáveis. Abra os links de e-mail no mesmo celular; mantenha o servidor Expo
acessível. Se o cliente de e-mail não abrir o link `exp://`, use o código do
template, voltando a **Preciso confirmar meu e-mail** ou **Esqueci minha senha**.

1. Crie uma conta de teste. Se exigido, confirme o e-mail pelo link ou código.
2. Entre: sem perfil/vínculo, deve aparecer **Aguardando liberação**, sem jornada.
3. Um operador da instituição consulta o UUID em **Authentication → Users** e usa
   o provisionamento NestJS já existente, escolhendo uma organização autorizada:

   ```sh
   npm run provision:user --workspace=@aex/api -- --user-id UUID_DO_AUTH --organization-id UUID_DA_INSTITUICAO --display-name "Pessoa de teste" --role participant
   ```

   O comando acima simula a operação. Após conferir, o operador o repete com
   `--apply`. A credencial privilegiada permanece no `.env` da API. O aplicativo
   nunca recebe esse comando nem pode escolher seu papel.
4. Toque em **Verificar novamente**. O perfil liberado deve abrir a jornada.
5. Feche e reabra o app: a sessão deve ser restaurada e `/me` consultado novamente.
6. Teste **Sair da minha conta** e tente abrir uma rota de exercício: a área
   autenticada deve permanecer inacessível.
7. Em **Esqueci minha senha**, solicite instruções, abra o link ou digite o código,
   defina a senha e entre novamente. Teste também link expirado, senha incorreta,
   conta não confirmada e perda de rede.

## Persistência e limites

Tokens ficam em `expo-secure-store`, divididos em entradas pequenas para respeitar
limites nativos. A senha só existe temporariamente no formulário e é limpa após
o envio/saída da tela; não é persistida. O SDK gerencia renovação de tokens;
ao voltar ao primeiro plano, o app revalida `/me` antes de mostrar a jornada.
Respostas atrasadas não podem reabrir uma sessão encerrada.

O SDK oficial é instanciado em `src/auth/runtime.js`, com uma interface local
tipada em `runtime.d.ts`, evitando introduzir globais DOM/Node no programa nativo.
O teste de integração abaixo exercita esse adaptador com o SDK instalado e HTTP
simulado. `react-native-url-polyfill` fornece a semântica de URL usada pelos links.

Exercícios, recompensas e histórico continuam demonstrativos até a Etapa 5.8.
O armazenamento desse progresso agora usa o ID do participante; os arquivos
legados sem proprietário não são importados nem apagados. Trocar de conta não
mostra o histórico demonstrativo de outra pessoa. Nada é enviado à API de
tentativas nesta etapa.

## Verificações desta entrega

```sh
npm run test:auth --workspace=@aex/mobile
npm run lint --workspace=@aex/mobile
npm run typecheck --workspace=@aex/mobile
```

- Testes de autenticação: 21 aprovados, com HTTP e armazenamento simulados.
  Cobrem validação, links, erros, Bearer, autorização de `/me`, identidade
  divergente, ausência de vínculo, sessão expirada, concorrência, restauração,
  isolamento de progresso, chamadas do SDK e logout.
- Lint mobile: aprovado.
- Typecheck: bloqueado por declarações de Expo Router/React Native e regressões
  de `test-types/dependencies.ts` já registradas em `docs/validation.md`; o uso
  de Expo Linking também expõe `MessageEvent` ausente em suas declarações.
  Nenhum erro apontado em `src/`. Não foram relaxadas as opções TypeScript.
  `tsc -p apps/mobile/tsconfig.tools.json --noEmit` passou separadamente.
- Não foi executado teste real em Expo Go, envio de e-mail ou criação de usuário
  remoto. As configurações do Dashboard, credenciais públicas e validação em
  aparelho são necessárias para concluir a aceitação do fluxo real.

Referências: [Supabase Auth com React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native),
[links nativos](https://supabase.com/docs/guides/auth/native-mobile-deep-linking),
[templates de e-mail](https://supabase.com/docs/guides/auth/auth-email-templates),
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).
