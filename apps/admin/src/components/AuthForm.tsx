'use client';

import { useActionState, useState } from 'react';
import type { ActionState } from '../auth/core';

export function AuthForm({ action, kind, invitation = '', token = '' }: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  kind: 'login' | 'forgot' | 'reset' | 'activate' | 'confirm' | 'invite'; invitation?: string; token?: string;
}) {
  const [state, submit, pending] = useActionState(action, { message: '' });
  const [visible, setVisible] = useState(false);
  const password = ['login','reset','activate'].includes(kind);
  const newPassword = kind === 'reset' || kind === 'activate';
  const label = { login: 'Entrar', forgot: 'Enviar instruções', reset: 'Salvar nova senha', activate: 'Ativar conta', confirm: 'Continuar ativação', invite: 'Enviar convite' }[kind];
  return <form action={submit} className="auth-form" aria-busy={pending}>
    {kind === 'invite' && <label>Nome da pessoa convidada<input name="display_name" autoComplete="name" required maxLength={120} disabled={pending} /></label>}
    {['login','forgot','invite'].includes(kind) && <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} /></label>}
    {password && <>
      <label>{newPassword ? 'Nova senha' : 'Senha'}<input name="password" type={visible ? 'text' : 'password'} autoComplete={newPassword ? 'new-password' : 'current-password'} required minLength={newPassword ? 8 : 1} disabled={pending} /></label>
      {newPassword && <label>Confirmar senha<input name="confirmation" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} disabled={pending} /></label>}
      <button className="secondary-button" type="button" aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? 'Ocultar senha' : 'Mostrar senha'}</button>
    </>}
    {invitation && <input name="invitation_id" type="hidden" value={invitation} />}
    {token && <input name="token_hash" type="hidden" value={token} />}
    {state.message && <p className={state.success ? 'auth-success' : 'auth-alert'} role={state.success ? 'status' : 'alert'}>{state.message}</p>}
    <button type="submit" disabled={pending}>{pending ? 'Aguarde…' : label}</button>
    {pending && <p role="status">Verificando sua solicitação.</p>}
  </form>;
}
