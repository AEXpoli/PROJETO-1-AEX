import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  Achievement,
  ParticipantProgress,
  RecordedExerciseResult,
  SubmitExerciseAttempt,
} from '@aex/types';
import {
  achievementsResponseSchema,
  attemptsResponseSchema,
  participantProgressSchema,
  recordedExerciseResultSchema,
} from '@aex/validation';
import { SupabaseService } from '../supabase/supabase.service';
import type { Identity } from '../auth/auth.types';

function validateResponse<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new InternalServerErrorException('Resposta de aprendizagem inválida.');
  return parsed.data;
}

function rpcError(code: string): never {
  switch (code) {
    case 'PT400':
      throw new BadRequestException('Alternativa ou parâmetros inválidos.');
    case 'PT403':
      throw new ForbiddenException('Atividade ou vínculo não autorizado.');
    case 'PT404':
      throw new NotFoundException('Exercício indisponível.');
    case 'PT409':
      throw new ConflictException(
        'Identificador reutilizado com outros dados ou conteúdo ainda não preparado.',
      );
    default:
      throw new ServiceUnavailableException(
        'Não foi possível confirmar a operação. Reenvie com o mesmo id e os mesmos dados.',
      );
  }
}

@Injectable()
export class AttemptsService {
  constructor(private readonly supabase: SupabaseService) {}

  async submit(
    identity: Identity,
    exerciseId: string,
    input: SubmitExerciseAttempt,
  ): Promise<RecordedExerciseResult> {
    const { data, error } = await this.supabase.client
      .rpc('aex_record_attempt', {
        p_participant_id: identity.id,
        p_attempt_id: input.id,
        p_exercise_id: exerciseId,
        p_selected_option_id: input.selectedOptionId,
        ...(input.assignmentId ? { p_assignment_id: input.assignmentId } : {}),
      })
      .retry(false)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) rpcError(error.code);
    return validateResponse(recordedExerciseResultSchema, data);
  }

  private async read(identity: Identity, resource: 'attempts' | 'progress' | 'achievements') {
    const { data, error } = await this.supabase.client
      .rpc('aex_learning_read', {
        p_participant_id: identity.id,
        p_resource: resource,
      })
      .retry(false)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) rpcError(error.code);
    return data;
  }

  async attempts(identity: Identity): Promise<RecordedExerciseResult[]> {
    return validateResponse(attemptsResponseSchema, await this.read(identity, 'attempts'));
  }
  async progress(identity: Identity): Promise<ParticipantProgress> {
    return validateResponse(participantProgressSchema, await this.read(identity, 'progress'));
  }
  async achievements(identity: Identity): Promise<Achievement[]> {
    return validateResponse(achievementsResponseSchema, await this.read(identity, 'achievements'));
  }
}
