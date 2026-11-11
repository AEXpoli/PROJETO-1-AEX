import { z } from 'zod';
import type {
  Achievement,
  ParticipantProgress,
  RecordedExerciseResult,
  SubmitExerciseAttempt,
} from '@aex/types';
import { contentIdSchema } from './content';

export const submitExerciseAttemptSchema = z
  .object({
    id: contentIdSchema,
    selectedOptionId: contentIdSchema,
    assignmentId: contentIdSchema.optional(),
  })
  .strict() satisfies z.ZodType<SubmitExerciseAttempt>;

export const recordedExerciseResultSchema = z
  .object({
    attempt: z
      .object({
        id: contentIdSchema,
        exerciseId: contentIdSchema,
        selectedOptionId: contentIdSchema,
        submittedAt: z.iso.datetime({ offset: true }),
      })
      .strict(),
    correct: z.boolean(),
    selectedLabel: z.string(),
    correctLabel: z.string(),
    explanation: z.string(),
    completedAt: z.iso.datetime({ offset: true }),
    evaluation: z.literal('server'),
    assignmentId: contentIdSchema.nullable(),
    pointsAwarded: z.union([z.literal(0), z.literal(10)]),
  })
  .strict() satisfies z.ZodType<RecordedExerciseResult>;
export const attemptsResponseSchema = z.array(recordedExerciseResultSchema);

const summary = {
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  reviewed: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
  isComplete: z.boolean(),
};
export const participantProgressSchema = z
  .object({
    evaluation: z.literal('server'),
    completions: z.array(z.object({ exerciseId: contentIdSchema, correct: z.boolean() }).strict()),
    summary: z
      .object({
        ...summary,
        exerciseStats: z.array(
          z
            .object({
              exerciseId: contentIdSchema,
              attempts: z.number().int().nonnegative(),
              correct: z.number().int().nonnegative(),
              incorrect: z.number().int().nonnegative(),
            })
            .strict(),
        ),
      })
      .strict(),
    modules: z.array(z.object({ moduleId: contentIdSchema, ...summary }).strict()),
  })
  .strict() satisfies z.ZodType<ParticipantProgress>;

export const achievementSchema = z
  .object({ id: z.string(), title: z.string(), description: z.string(), unlocked: z.boolean() })
  .strict() satisfies z.ZodType<Achievement>;
export const achievementsResponseSchema = z.array(achievementSchema);
