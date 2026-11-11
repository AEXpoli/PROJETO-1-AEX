import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { Button, Card, Header } from '../components/ui';
import { Icon } from '../components/Icon';
import { colors, radius, textStyles } from '../theme';
import { useAuth } from './AuthProvider';
import { createSingleFlight, validateForm } from './core';

type Mode = 'welcome' | 'login' | 'signup' | 'confirm' | 'forgot' | 'resetSent' | 'password';

function Field({ label, password = false, ...props }: TextInputProps & { label: string; password?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}>
    <Text style={textStyles.body}>{label}</Text>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.muted}
      autoCapitalize="none" autoCorrect={false} secureTextEntry={password && !visible}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={[styles.input, focused && styles.focused]} />
    {password ? <Pressable accessibilityRole="button" accessibilityLabel={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
      onPress={() => setVisible(value => !value)} style={({ pressed }) => [styles.reveal, pressed && styles.revealPressed]}>
      <Text style={textStyles.label}>{visible ? 'Ocultar senha' : 'Mostrar senha'}</Text>
    </Pressable> : null}
  </View>;
}

export function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>(auth.state.status === 'signedOut' && auth.state.message ? 'login' : 'welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const singleFlight = useMemo(() => createSingleFlight(), []);
  const current = auth.state.status === 'recovery' ? 'password' : mode;

  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  function go(next: Mode) {
    setPassword(''); setConfirmation(''); setCode(''); setMessage(''); setMode(next);
  }
  async function run(action: () => Promise<void>) {
    await singleFlight(async () => {
      setBusy(true); setMessage('');
      try { await action(); }
      catch { setMessage('Não foi possível concluir. Confira sua conexão e tente novamente.'); }
      finally { setBusy(false); setPassword(''); setConfirmation(''); }
    });
  }
  function submit() {
    const validation = validateForm(current === 'signup' ? 'signup' : current === 'password' ? 'password' : current === 'forgot' ? 'email' : 'login', { name, email, password, confirmation });
    if (validation) { setMessage(validation); return; }
    void run(async () => {
      if (current === 'login') {
        const error = await auth.login(email, password);
        if (error) setMessage(error);
      } else if (current === 'signup') {
        const result = await auth.signup(name, email, password);
        if (result.message) setMessage(result.message);
        else { setMode('confirm'); setCooldown(60); }
      } else if (current === 'forgot') {
        const error = await auth.emailAction(email, 'reset');
        if (error) setMessage(error);
        else { setMode('resetSent'); setCooldown(60); }
      } else if (current === 'password') {
        const error = await auth.updatePassword(password);
        if (error) setMessage(error);
        else { setMode('login'); setMessage('Senha atualizada. Entre com sua nova senha.'); }
      }
    });
  }
  const button = (label: string, action: () => void, secondary = false, disabled = false) =>
    <Button label={label} onPress={action} secondary={secondary} disabled={busy || disabled} />;

  if (auth.state.status === 'ready') return <Redirect href="/" />;
  let content;
  if (auth.state.status === 'configuration') {
    content = <Header eyebrow="AEX" title="Vamos preparar seu acesso" description="A configuração do aplicativo ainda não está completa. Peça ajuda à equipe responsável." />;
  } else if (auth.state.status === 'loading') {
    content = <><Header eyebrow="AEX" title="Preparando seu acesso" description="Só um instante. Estamos verificando sua sessão." /><ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando sessão" /></>;
  } else if (auth.state.status === 'blocked' || auth.state.status === 'offline') {
    content = <>
      <Header eyebrow="SUA CONTA" title={auth.state.status === 'blocked' ? 'Aguardando liberação' : 'Não foi possível verificar seu acesso'}
        description={auth.state.status === 'blocked' ? 'Sua conta foi criada. Peça à instituição que libere seu perfil e vínculo. Você não precisa criar outra conta.' : auth.state.message ?? 'Confira sua conexão. Seu acesso será verificado novamente antes de abrir as atividades.'} />
      {button('Verificar novamente', () => { void run(auth.refresh); })}
      {button('Sair desta conta', () => { void run(auth.logout); }, true)}
    </>;
  } else if (current === 'welcome') {
    content = <>
      <View style={styles.emblem}><Icon name="shield" size={64} /></View>
      <Header eyebrow="BEM-VINDO AO AEX" title="Mais confiança, um passo de cada vez" description="Pratique como reconhecer golpes digitais, com calma e no seu ritmo." />
      <Card tone="gold"><Text style={textStyles.body}>Sua jornada de aprendizado começa aqui.</Text></Card>
      {button('Já tenho conta · Entrar', () => go('login'))}
      {button('Quero criar minha conta', () => go('signup'), true)}
    </>;
  } else if (current === 'confirm' || current === 'resetSent') {
    content = <>
      <Header eyebrow="CONFIRA SEU E-MAIL" title={current === 'confirm' ? 'Confirme sua conta' : 'Vamos recuperar sua senha'}
        description="Se houver uma conta elegível, você receberá uma mensagem. Abra o link neste celular. Confira também a pasta de spam." />
      <Field label="Seu e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" editable={!busy} />
      <Text style={textStyles.detail}>Se a mensagem trouxer um código, você também pode digitá-lo aqui.</Text>
      <Field label="Código do e-mail" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={10} editable={!busy} />
      {button('Confirmar código', () => {
        if (!/^\d{6,10}$/.test(code.trim())) { setMessage('Digite o código numérico recebido por e-mail.'); return; }
        void run(async () => { const error = await auth.verifyCode(email, code, current === 'confirm' ? 'signup' : 'recovery'); if (error) setMessage(error); });
      })}
      {button(cooldown ? `Reenviar em ${cooldown}s` : 'Enviar uma nova mensagem', () => {
        const error = validateForm('email', { name, email, password, confirmation });
        if (error) { setMessage(error); return; }
        void run(async () => {
          const result = await auth.emailAction(email, current === 'confirm' ? 'confirm' : 'reset');
          setMessage(result ?? 'Se houver uma conta elegível, uma nova mensagem será enviada.');
          setCooldown(60);
        });
      }, true, cooldown > 0)}
      {button('Voltar para entrar', () => go('login'), true)}
    </>;
  } else {
    content = <>
      <Header eyebrow="SUA CONTA AEX" title={current === 'login' ? 'Bom ter você aqui' : current === 'signup' ? 'Crie sua conta' : current === 'password' ? 'Escolha uma nova senha' : 'Esqueceu sua senha?'}
        description={current === 'signup' ? 'Preencha seus dados. A instituição fará a liberação do seu acesso às atividades.' : current === 'forgot' ? 'Informe seu e-mail para receber as instruções.' : current === 'password' ? 'Use pelo menos 8 caracteres e guarde sua senha em um lugar seguro.' : 'Entre com seu e-mail e sua senha.'} />
      {current === 'signup' ? <Field label="Seu nome" value={name} onChangeText={setName} autoComplete="name" maxLength={120} editable={!busy} /> : null}
      {current !== 'password' ? <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" editable={!busy} /> : null}
      {current !== 'forgot' ? <Field label={current === 'password' ? 'Nova senha' : 'Senha'} password value={password} onChangeText={setPassword}
        autoComplete={current === 'login' ? 'current-password' : 'new-password'} editable={!busy} returnKeyType="done" onSubmitEditing={submit} /> : null}
      {current === 'signup' || current === 'password' ? <>
        <Text style={textStyles.detail}>Use pelo menos 8 caracteres. Nunca compartilhe sua senha.</Text>
        <Field label="Confirmar senha" password value={confirmation} onChangeText={setConfirmation} autoComplete="new-password" editable={!busy} returnKeyType="done" onSubmitEditing={submit} />
      </> : null}
      {button(current === 'login' ? 'Entrar' : current === 'signup' ? 'Criar minha conta' : current === 'password' ? 'Salvar nova senha' : 'Enviar instruções', submit)}
      {current === 'login' ? <>
        {button('Esqueci minha senha', () => go('forgot'), true)}
        {button('Preciso confirmar meu e-mail', () => go('confirm'), true)}
        {button('Ainda não tenho conta', () => go('signup'), true)}
      </> : null}
      {current === 'password' ? button('Cancelar e sair', () => { void run(auth.logout); }, true) : button('Voltar', () => go(current === 'login' ? 'welcome' : 'login'), true)}
    </>;
  }
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          {content}
          {busy ? <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Aguarde, enviando seus dados" /> : null}
          {message || auth.linkError || (auth.state.status === 'signedOut' && auth.state.message) ?
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>{message || auth.linkError || (auth.state.status === 'signedOut' ? auth.state.message : '')}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24 }, content: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 20 },
  field: { gap: 8 }, input: { minHeight: 60, borderWidth: 2, borderColor: colors.border, borderRadius: radius.control, backgroundColor: colors.surface, color: colors.ink, fontSize: 20, padding: 16 },
  focused: { borderColor: colors.primary }, reveal: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, alignSelf: 'flex-start', borderRadius: 12 },
  revealPressed: { backgroundColor: colors.softGreen }, message: { ...textStyles.body, padding: 16, borderWidth: 2, borderColor: colors.primary, borderRadius: 16, backgroundColor: colors.softGold },
  emblem: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.softGreen, justifyContent: 'center', alignItems: 'center' },
});
