import Link from 'next/link';
import { AuthFrame } from '../../components/AuthFrame';
import { logout } from '../../auth/actions';
export default async function DeniedPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <AuthFrame title={reason === 'unavailable' ? 'Não foi possível verificar seu acesso' : 'Acesso não autorizado'} description={reason === 'unavailable' ? 'Confira a conexão e a configuração dos serviços. Tente novamente em instantes.' : 'Sua conta não possui vínculo administrativo válido nesta organização. Procure a instituição responsável.'}>
    <Link href="/">Verificar acesso novamente</Link><form action={logout}><button>Voltar para entrar com outra conta</button></form>
  </AuthFrame>;
}
