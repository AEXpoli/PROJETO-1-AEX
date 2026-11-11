import { z } from 'zod';
import type { ExerciseOption, LearningModule, ParticipantExercise } from '@aex/types';

export const contentIdSchema = z.uuid();
export const learningModuleSchema = z
  .object({
    id: contentIdSchema,
    title: z.string().trim().min(2).max(180),
    description: z.string(),
    sortOrder: z.number().int().nonnegative(),
  })
  .strict() satisfies z.ZodType<LearningModule>;

export const exerciseOptionSchema = z
  .object({
    id: contentIdSchema,
    label: z.string().trim().min(1),
  })
  .strict() satisfies z.ZodType<ExerciseOption>;

export const participantExerciseSchema = z
  .object({
    id: contentIdSchema,
    moduleId: contentIdSchema,
    title: z.string().trim().min(2).max(180),
    scenario: z.string().trim().min(1),
    question: z.string().trim().min(1),
    sortOrder: z.number().int().nonnegative(),
    options: z
      .array(exerciseOptionSchema)
      .min(2)
      .refine(
        (options) => new Set(options.map((option) => option.id)).size === options.length,
        'As opções devem ter IDs distintos.',
      ),
  })
  .strict() satisfies z.ZodType<ParticipantExercise>;

export const learningModulesResponseSchema = z.array(learningModuleSchema);
export const participantExercisesResponseSchema = z.array(participantExerciseSchema);
