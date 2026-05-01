import type { CardState, CardType, McqCard, StudyGrade } from './types';

const dayMs = 24 * 60 * 60 * 1000;

export function createNewCard(card: {
  cardType?: CardType;
  question: string;
  answers: string[];
  correctIndex: number;
  imageBase64?: string;
  imageSrc?: string;
  answerImageSrc?: string;
}): McqCard {
  const now = new Date().toISOString();

  return {
    ...card,
    due: now,
    difficulty: 5,
    stability: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    createdAt: now,
    updatedAt: now
  };
}

export function isDue(card: McqCard, at = new Date()): boolean {
  return new Date(card.due).getTime() <= at.getTime();
}

export function reviewCard(card: McqCard, grade: StudyGrade): McqCard {
  const now = new Date();
  const next = { ...card };
  next.reps += 1;
  next.updatedAt = now.toISOString();

  if (grade === 'again') {
    next.lapses += 1;
    next.state = card.reps === 0 ? 'learning' : 'relearning';
    next.difficulty = clamp(card.difficulty + 0.8, 1, 10);
    next.stability = Math.max(0.1, card.stability * 0.35);
    next.due = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    return next;
  }

  const nextState: CardState = card.reps <= 1 ? 'learning' : 'review';
  const stabilityGain = card.state === 'new' ? 1 : Math.max(1, 1 + (11 - card.difficulty) * 0.18);
  next.state = nextState;
  next.difficulty = clamp(card.difficulty - 0.35, 1, 10);
  next.stability = Math.max(1, card.stability * stabilityGain || 1);
  next.due = new Date(now.getTime() + intervalDays(next.stability, next.reps) * dayMs).toISOString();
  return next;
}

function intervalDays(stability: number, reps: number): number {
  if (reps <= 1) return 1;
  return Math.min(365, Math.max(1, Math.round(stability * 1.7)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
