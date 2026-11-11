import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { LearningModule, ParticipantExercise } from '@aex/types';
import {
  learningModuleSchema,
  learningModulesResponseSchema,
  participantExerciseSchema,
  participantExercisesResponseSchema,
} from '@aex/validation';
import { SupabaseService } from '../supabase/supabase.service';

// Explicit projections: never fetch answer keys or explanations in the participant API.
const MODULE_FIELDS = 'id,title,description,sort_order' as const;
const EXERCISE_FIELDS =
  'id,module_id,title,scenario,question,sort_order,learning_modules!inner(status),exercise_options(id,option_text,sort_order)' as const;

interface ModuleRow {
  id: string;
  title: string;
  description: string;
  sort_order: number;
}
interface ExerciseRow {
  id: string;
  module_id: string;
  title: string;
  scenario: string;
  question: string;
  sort_order: number;
  exercise_options: { id: string; option_text: string; sort_order: number }[];
}

function toModule(row: ModuleRow): LearningModule {
  return { id: row.id, title: row.title, description: row.description, sortOrder: row.sort_order };
}

function toExercise(row: ExerciseRow): ParticipantExercise {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    scenario: row.scenario,
    question: row.question,
    sortOrder: row.sort_order,
    options: [...row.exercise_options]
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
      .map((option) => ({ id: option.id, label: option.option_text })),
  };
}

function validated<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new InternalServerErrorException('Conteúdo educativo inválido.');
  return result.data;
}

@Injectable()
export class ContentService {
  constructor(private readonly supabase: SupabaseService) {}

  async listModules(): Promise<LearningModule[]> {
    const { data, error } = await this.supabase.client
      .from('learning_modules')
      .select(MODULE_FIELDS)
      .eq('status', 'published')
      .order('sort_order')
      .order('id')
      .retry(false)
      .abortSignal(AbortSignal.timeout(5000));
    if (error || !data)
      throw new ServiceUnavailableException('Conteúdo temporariamente indisponível.');
    return validated(learningModulesResponseSchema, data.map(toModule));
  }

  async getModule(id: string): Promise<LearningModule> {
    const { data, error } = await this.supabase.client
      .from('learning_modules')
      .select(MODULE_FIELDS)
      .eq('id', id)
      .eq('status', 'published')
      .retry(false)
      .abortSignal(AbortSignal.timeout(5000))
      .maybeSingle();
    if (error) throw new ServiceUnavailableException('Conteúdo temporariamente indisponível.');
    if (!data) throw new NotFoundException('Módulo não encontrado.');
    return validated(learningModuleSchema, toModule(data));
  }

  async listExercises(moduleId: string): Promise<ParticipantExercise[]> {
    await this.getModule(moduleId);
    const { data, error } = await this.supabase.client
      .from('exercises')
      .select(EXERCISE_FIELDS)
      .eq('module_id', moduleId)
      .eq('status', 'published')
      .eq('learning_modules.status', 'published')
      .order('sort_order')
      .order('id')
      .retry(false)
      .abortSignal(AbortSignal.timeout(5000));
    if (error || !data)
      throw new ServiceUnavailableException('Conteúdo temporariamente indisponível.');
    return validated(participantExercisesResponseSchema, data.map(toExercise));
  }

  async getExercise(id: string): Promise<ParticipantExercise> {
    const { data, error } = await this.supabase.client
      .from('exercises')
      .select(EXERCISE_FIELDS)
      .eq('id', id)
      .eq('status', 'published')
      .eq('learning_modules.status', 'published')
      .retry(false)
      .abortSignal(AbortSignal.timeout(5000))
      .maybeSingle();
    if (error) throw new ServiceUnavailableException('Conteúdo temporariamente indisponível.');
    if (!data) throw new NotFoundException('Exercício não encontrado.');
    return validated(participantExerciseSchema, toExercise(data));
  }
}
