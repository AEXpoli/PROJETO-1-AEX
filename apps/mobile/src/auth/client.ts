import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import { createChunkedStorage, readPublicConfig } from './core';
import { createNativeClient } from './runtime';

// Module-local declaration: Expo substitutes these explicit accesses at bundle time.
declare const process: { env: { EXPO_PUBLIC_SUPABASE_URL?: string; EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string; EXPO_PUBLIC_API_URL?: string } };

export const sessionStorage = createChunkedStorage({
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: key => SecureStore.deleteItemAsync(key),
});
export const redirectTo = Linking.createURL('auth/callback');
export const recoveryKey = 'aex-auth-recovery';

function configure() {
  try {
    const config = readPublicConfig(process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, process.env.EXPO_PUBLIC_API_URL);
    if (!__DEV__ && !config.api.startsWith('https://')) throw new Error('HTTPS obrigatório.');
    return { client: createNativeClient(config.url, config.key, sessionStorage), api: config.api };
  } catch { return null; }
}
export const authConfig = configure();
