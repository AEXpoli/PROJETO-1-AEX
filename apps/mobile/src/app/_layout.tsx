import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProgressProvider } from '../progression/ProgressProvider';
import { AuthProvider, useAuth } from '../auth/AuthProvider';

function SessionRoutes() {
  const { state } = useAuth();
  const stack = <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
    <Stack.Screen name="auth" />
    <Stack.Protected guard={state.status === 'ready'}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="exercicio/[id]" />
      <Stack.Screen name="atividade/[id]" />
      <Stack.Screen name="conclusao/[id]" />
    </Stack.Protected>
  </Stack>;
  return state.status === 'ready'
    ? <ProgressProvider key={state.userId} participantId={state.userId}>{stack}</ProgressProvider>
    : stack;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
      <StatusBar style="dark" />
      {/* Transições estáticas também respeitam a preferência de redução de movimento. */}
      <SessionRoutes />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
