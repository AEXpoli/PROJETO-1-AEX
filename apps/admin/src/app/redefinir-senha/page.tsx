import { redirect } from 'next/navigation';
import { AuthFrame } from '../../components/AuthFrame';
import { AuthForm } from '../../components/AuthForm';
import { changePassword, logout } from '../../auth/actions';
import { identity } from '../../auth/server';
export default async function ResetPage() {
  try { await identity(); } catch { redirect('/auth/erro'); }
  return <AuthFrame title="Redefinir senha" description="Escolha uma senha com pelo menos 8 caracteres.">
    <AuthForm action={changePassword} kind="reset" /><form action={logout}><button className="secondary-button">Cancelar e sair</button></form>
  </AuthFrame>;
}
