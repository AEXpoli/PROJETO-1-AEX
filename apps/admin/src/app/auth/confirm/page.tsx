import { AuthFrame } from '../../../components/AuthFrame';
import { AuthForm } from '../../../components/AuthForm';
import { confirmInvitation } from '../../../auth/actions';
import { UUID } from '../../../auth/core';
import Link from 'next/link';
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; invitation_id?: string; type?: string }> }) {
  const params = await searchParams;
  const valid = typeof params.token_hash === 'string' && /^[a-zA-Z0-9_-]{20,256}$/.test(params.token_hash) && typeof params.invitation_id === 'string' && UUID.test(params.invitation_id) && params.type === 'invite';
  return <AuthFrame title="Aceitar convite" description={valid ? 'Confirme que deseja ativar sua conta administrativa. O convite é pessoal e de uso único.' : 'O convite está incompleto ou inválido. Solicite um novo link à instituição.'}>
    {valid ? <AuthForm action={confirmInvitation} kind="confirm" token={params.token_hash!} invitation={params.invitation_id!} /> : <Link href="/login">Voltar para entrar</Link>}
  </AuthFrame>;
}
