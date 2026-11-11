import { contentIdSchema, exerciseOptionSchema, participantExerciseSchema } from '../src';

const id = 'a5400000-0000-4000-8000-000000000001';
const option = { id, label: 'Alternativa' };
const exercise = {
  id,
  moduleId: id,
  title: 'Exercício fictício',
  scenario: 'Cenário',
  question: 'Como agir?',
  sortOrder: 0,
  options: [option, { id: 'a5400000-0000-4000-8000-000000000002', label: 'Outra alternativa' }],
};

describe('Participant content schemas', () => {
  it('validates UUIDs and the safe contract', () => {
    expect(contentIdSchema.safeParse('sms-suspeito').success).toBe(false);
    expect(participantExerciseSchema.safeParse(exercise).success).toBe(true);
  });
  it.each(['is_correct', 'isCorrect', 'explanation', 'correctOptionId', 'takeaway'])(
    'rejects non-public properties: %s',
    (key) => {
      expect(exerciseOptionSchema.safeParse({ ...option, [key]: true }).success).toBe(false);
      expect(participantExerciseSchema.safeParse({ ...exercise, [key]: true }).success).toBe(false);
    },
  );
  it('rejects incomplete content and duplicate option IDs', () => {
    expect(participantExerciseSchema.safeParse({ ...exercise, options: [option] }).success).toBe(
      false,
    );
    expect(
      participantExerciseSchema.safeParse({ ...exercise, options: [option, option] }).success,
    ).toBe(false);
    expect(participantExerciseSchema.safeParse({ ...exercise, scenario: '' }).success).toBe(false);
  });
});
