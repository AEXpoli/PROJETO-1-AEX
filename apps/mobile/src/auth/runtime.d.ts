import type { AuthClient, SessionStorage } from './types';
export function createNativeClient(url: string, key: string, storage: SessionStorage): AuthClient;
