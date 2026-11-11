import Link from 'next/link';
import { AuthFrame } from '../../components/AuthFrame';
import { AuthForm } from '../../components/AuthForm';
import { requestPassword } from '../../auth/actions';
export default function ForgotPage() {
  return <AuthFrame title="Recuperar senha" description="Informe o e-mail da sua conta. Abra a mensagem neste mesmo navegador.">
    <AuthForm action={requestPassword} kind="forgot" /><Link href="/login">Voltar para entrar</Link>
  </AuthFrame>;
}
