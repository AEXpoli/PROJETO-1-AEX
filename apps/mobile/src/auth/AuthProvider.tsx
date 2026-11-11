import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { authConfig, recoveryKey, redirectTo, sessionStorage } from './client';
import { authMessage, checkAccess, createAccessCoordinator, parseAuthLink } from './core';
import type { AuthSession, AuthState } from './types';

function useAuthValue() {
  const [state, setState] = useState<AuthState>(authConfig ? { status: 'loading' } : { status: 'configuration' });
  const [linkError, setLinkError] = useState('');
  const session = useRef<AuthSession | null>(null);
  const recovering = useRef(false);
  const linkRunning = useRef(false);
  const signingOut = useRef(false);
  const sessionGeneration = useRef(0);
  const coordinator = useMemo(() => createAccessCoordinator(setState, value => checkAccess(authConfig?.api ?? '', value)), []);

  async function accept(value: AuthSession | null) {
    if (signingOut.current) return;
    session.current = value;
    if (recovering.current && value) { coordinator.cancel({ status: 'recovery' }); return; }
    await coordinator.check(value);
  }

  async function refresh() {
    if (!authConfig || signingOut.current) return;
    const generation = sessionGeneration.current;
    try {
      const { data, error } = await authConfig.client.auth.getSession();
      if (generation !== sessionGeneration.current) return;
      if (error) { coordinator.cancel({ status: 'signedOut', message: authMessage(error) }); return; }
      await accept(data.session);
    } catch { coordinator.cancel({ status: 'offline' }); }
  }

  async function logout() {
    if (!authConfig) return;
    signingOut.current = true;
    sessionGeneration.current++;
    coordinator.cancel({ status: 'loading' });
    authConfig.client.auth.stopAutoRefresh();
    try { await authConfig.client.auth.signOut({ scope: 'local' }); } catch { /* Clear local storage even without network. */ }
    try {
      await sessionStorage.removeItem('aex-auth-v1');
      await sessionStorage.removeItem(recoveryKey);
      session.current = null;
      recovering.current = false;
      signingOut.current = false;
      coordinator.cancel({ status: 'signedOut' });
    } catch {
      coordinator.cancel({ status: 'offline', message: 'Não foi possível apagar a sessão deste aparelho. Toque em Sair desta conta para tentar novamente.' });
    }
  }

  async function receiveLink(raw: string) {
    if (!authConfig || linkRunning.current) return;
    let parsed;
    try { parsed = parseAuthLink(raw, redirectTo); }
    catch {
      setLinkError('Este link não está completo ou expirou. Solicite outro ou use o código do e-mail.');
      await refresh();
      return;
    }
    if (!parsed) return;
    linkRunning.current = true;
    sessionGeneration.current++;
    setLinkError('');
    coordinator.cancel({ status: 'loading' });
    recovering.current = parsed.recovery;
    try {
      await sessionStorage.setItem(recoveryKey, parsed.recovery ? 'yes' : 'no');
      const { data, error } = await authConfig.client.auth.setSession({ access_token: parsed.access_token, refresh_token: parsed.refresh_token });
      if (error || !data.session) throw new Error('Link inválido.');
      await accept(data.session);
    } catch {
      setLinkError('Não foi possível validar o link. Solicite uma nova mensagem.');
      await logout().catch(() => coordinator.cancel({ status: 'offline' }));
    } finally { linkRunning.current = false; }
  }

  useEffect(() => {
    if (!authConfig) return;
    const config = authConfig;
    let active = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const { data } = config.client.auth.onAuthStateChange((event, value) => {
      const generation = sessionGeneration.current;
      // SDK callbacks stay synchronous to avoid waiting on its own auth lock.
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!active || linkRunning.current || signingOut.current || generation !== sessionGeneration.current) return;
        if (event === 'PASSWORD_RECOVERY') recovering.current = true;
        if (event === 'INITIAL_SESSION') return;
        void accept(value);
      }, 0);
      timers.add(timer);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => { void receiveLink(url); });
    const appState = AppState.addEventListener('change', next => {
      if (next === 'active' && !signingOut.current) {
        config.client.auth.startAutoRefresh();
        if (!linkRunning.current) void refresh();
      } else {
        config.client.auth.stopAutoRefresh();
        // Recheck membership before revealing the journey on return to foreground.
        coordinator.cancel({ status: 'loading' });
      }
    });
    void (async () => {
      try {
        recovering.current = (await sessionStorage.getItem(recoveryKey)) === 'yes';
        const initialUrl = await Linking.getInitialURL();
        if (!active) return;
        if (initialUrl && initialUrl.split(/[?#]/)[0] === redirectTo) await receiveLink(initialUrl);
        else await refresh();
        if (AppState.currentState === 'active') config.client.auth.startAutoRefresh();
      } catch { if (active) coordinator.cancel({ status: 'offline' }); }
    })();
    return () => {
      active = false;
      timers.forEach(clearTimeout);
      subscription.remove(); appState.remove(); data.subscription.unsubscribe();
      coordinator.cancel({ status: 'loading' });
      config.client.auth.stopAutoRefresh();
    };
    // Provider lifecycle owns the singleton subscriptions; methods read refs/current session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    if (!authConfig) return 'O aplicativo precisa ser configurado pela equipe.';
    sessionGeneration.current++;
    const { data, error } = await authConfig.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return authMessage(error);
    setLinkError('');
    authConfig.client.auth.startAutoRefresh();
    recovering.current = false;
    await sessionStorage.removeItem(recoveryKey);
    await accept(data.session);
    return null;
  }
  async function signup(name: string, email: string, password: string) {
    if (!authConfig) return { message: 'O aplicativo precisa ser configurado pela equipe.' };
    const { data, error } = await authConfig.client.auth.signUp({ email: email.trim(), password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: redirectTo } });
    if (error) return { message: authMessage(error) };
    if (data.session) await accept(data.session);
    return { message: null };
  }
  async function emailAction(email: string, action: 'confirm' | 'reset') {
    if (!authConfig) return 'O aplicativo precisa ser configurado pela equipe.';
    const result = action === 'confirm'
      ? await authConfig.client.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectTo } })
      : await authConfig.client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return result.error ? authMessage(result.error) : null;
  }
  async function verifyCode(email: string, token: string, type: 'signup' | 'recovery') {
    if (!authConfig) return 'O aplicativo precisa ser configurado pela equipe.';
    recovering.current = type === 'recovery';
    await sessionStorage.setItem(recoveryKey, recovering.current ? 'yes' : 'no');
    const { data, error } = await authConfig.client.auth.verifyOtp({ email: email.trim(), token: token.trim(), type });
    if (error) { recovering.current = false; await sessionStorage.removeItem(recoveryKey); return authMessage(error); }
    await accept(data.session);
    return null;
  }
  async function updatePassword(password: string) {
    if (!authConfig || !recovering.current || !session.current) return 'Abra um link de recuperação válido primeiro.';
    const { error } = await authConfig.client.auth.updateUser({ password });
    if (error) return authMessage(error);
    await logout();
    return null;
  }
  return { state, linkError, refresh, login, signup, logout, emailAction, verifyCode, updatePassword };
}

const AuthContext = createContext<ReturnType<typeof useAuthValue> | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const value = useAuthValue();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider necessário.');
  return value;
}
