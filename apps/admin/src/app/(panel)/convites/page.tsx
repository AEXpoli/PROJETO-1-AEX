import { requireAdmin } from '../../../auth/server';
import { issueInvitation } from '../../../auth/actions';
import { AuthForm } from '../../../components/AuthForm';
export default async function InvitationsPage() {
  const { organization } = await requireAdmin();
  return <section className="auth-card invitation-card"><header className="page-heading"><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Convidar administrador</h1>
    <p>Envie um convite pessoal para uma nova conta em {organization.name}. O vínculo só será criado após a ativação. Contas existentes devem ser tratadas pelo operador responsável.</p></header>
    <AuthForm action={issueInvitation} kind="invite" />
  </section>;
}
