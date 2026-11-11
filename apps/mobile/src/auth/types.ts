export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: { id: string; email?: string };
}
export interface AuthError { code?: string; message: string }
export interface SessionResult { data: { session: AuthSession | null }; error: AuthError | null }
export interface AuthClient {
  auth: {
    getSession(): Promise<SessionResult>;
    signInWithPassword(input: { email: string; password: string }): Promise<SessionResult>;
    signUp(input: { email: string; password: string; options: { data: { display_name: string }; emailRedirectTo: string } }): Promise<SessionResult>;
    signOut(input: { scope: 'local' }): Promise<{ error: AuthError | null }>;
    resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<{ error: AuthError | null }>;
    resend(input: { type: 'signup'; email: string; options: { emailRedirectTo: string } }): Promise<{ error: AuthError | null }>;
    setSession(input: { access_token: string; refresh_token: string }): Promise<SessionResult>;
    verifyOtp(input: { email: string; token: string; type: 'signup' | 'recovery' }): Promise<SessionResult>;
    updateUser(input: { password: string }): Promise<{ error: AuthError | null }>;
    onAuthStateChange(callback: (event: string, session: AuthSession | null) => void): { data: { subscription: { unsubscribe(): void } } };
    startAutoRefresh(): void;
    stopAutoRefresh(): void;
  };
}
export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export interface Me {
  profile: { id: string; display_name: string };
  organizations: { id: string; name: string; role: 'admin' | 'participant' }[];
}
export type AuthState =
  | { status: 'loading' | 'signedOut' | 'blocked' | 'offline' | 'recovery' | 'configuration'; message?: string }
  | { status: 'ready'; me: Me; userId: string };
