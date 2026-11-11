import Link from 'next/link';
import { AuthFrame } from '../../components/AuthFrame';
import { AuthForm } from '../../components/AuthForm';
import { login } from '../../auth/actions';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <AuthFrame title="Acesso administrativo" description="Entre com a conta autorizada pela sua instituição.">
    {reason === 'session' && <p className="auth-alert" role="alert">Sua sessão expirou. Entre novamente.</p>}
    {reason === 'updated' && <p className="auth-success" role="status">Senha atualizada. Entre com a nova senha.</p>}
    <AuthForm action={login} kind="login" />
    <Link href="/esqueci-minha-senha">Esqueci minha senha</Link>
    <p className="caption">O acesso administrativo depende de convite e autorização institucional. Não há cadastro público.</p>
  </AuthFrame>;
}
