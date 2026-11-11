import Link from 'next/link';
import { AuthFrame } from '../../../components/AuthFrame';
export default function AuthErrorPage() {
  return <AuthFrame title="Link inválido ou expirado" description="O link pode ter sido utilizado ou aberto em outro navegador. Solicite uma nova recuperação ou um novo convite à instituição.">
    <Link href="/esqueci-minha-senha">Solicitar recuperação de senha</Link><Link href="/login">Voltar para entrar</Link>
  </AuthFrame>;
}
