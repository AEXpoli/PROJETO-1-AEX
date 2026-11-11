import { documentDirectory, getInfoAsync, readAsStringAsync, writeAsStringAsync, moveAsync } from 'expo-file-system/legacy';
import type { ProgressStorage } from './mockTrainingService';

function paths(participantId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(participantId)) throw new Error('Participante inválido.');
  if (!documentDirectory) throw new Error('Diretório de documentos indisponível.');
  return { file: `${documentDirectory}aex-training-${participantId}.json`, temporary: `${documentDirectory}aex-training-${participantId}.pending` };
}

export function createProgressStorage(participantId: string): ProgressStorage { return {
  async read() {
    const { file, temporary } = paths(participantId);
    if ((await getInfoAsync(file)).exists) return readAsStringAsync(file);
    // Recupera o temporário se o aplicativo fechar durante a substituição.
    return (await getInfoAsync(temporary)).exists ? readAsStringAsync(temporary) : null;
  },
  async write(value) {
    const { file, temporary } = paths(participantId);
    await writeAsStringAsync(temporary, value);
    await moveAsync({ from: temporary, to: file });
  },
}; }
