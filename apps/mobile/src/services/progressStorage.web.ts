import type { ProgressStorage } from './mockTrainingService';

type BrowserStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
function getStorage() {
  const storage = (globalThis as unknown as { localStorage?: BrowserStorage }).localStorage;
  if (!storage) throw new Error('Armazenamento local indisponível.');
  return storage;
}

export function createProgressStorage(participantId: string): ProgressStorage { return {
  read: () => Promise.resolve(getStorage().getItem(`aex-training-${participantId}`)),
  write(value) {
    getStorage().setItem(`aex-training-${participantId}`, value);
    return Promise.resolve();
  },
}; }
