import { z } from 'zod';
export {
  contentIdSchema,
  learningModuleSchema,
  exerciseOptionSchema,
  participantExerciseSchema,
  learningModulesResponseSchema,
  participantExercisesResponseSchema,
} from './content';

export const portSchema = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .transform((value) => Number(value))
  .pipe(z.number().int().min(1).max(65535));

export type PortInput = z.input<typeof portSchema>;
