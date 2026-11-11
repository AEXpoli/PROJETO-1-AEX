// Thin runtime boundary for the isomorphic SDK. Native app types live in runtime.d.ts;
// importing its browser declarations would introduce DOM globals into React Native.
import { createClient } from '@supabase/supabase-js';

export function createNativeClient(url, key, storage) {
  return createClient(url, key, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10000) }),
    },
    auth: {
      storage, storageKey: 'aex-auth-v1', persistSession: true,
      autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit',
    },
  });
}
