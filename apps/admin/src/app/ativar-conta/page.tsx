import { redirect } from 'next/navigation';
import { AuthFrame } from '../../components/AuthFrame';
import { AuthForm } from '../../components/AuthForm';
import { activateAccount, logout } from '../../auth/actions';
import { identity } from '../../auth/server';
import { UUID } from '../../auth/core';
export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ invitation_id?: string }> }) {
  const { invitation_id: invitation } = await searchParams;
  if (!invitation || !UUID.test(invitation)) redirect('/auth/erro');
  try { await identity(); } catch { redirect('/auth/erro'); }
  return <AuthFrame title="Ativar conta administrativa" description="Defina sua senha. A autorização do convite será verificada antes de liberar o painel.">
    <AuthForm action={activateAccount} kind="activate" invitation={invitation} /><form action={logout}><button className="secondary-button">Cancelar e sair</button></form>
  </AuthFrame>;
}
