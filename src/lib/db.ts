import Dexie, { type Table } from 'dexie';
import { normalizeImageBase64 } from './images';
import { createNewCard, isDue, reviewCard } from './scheduler';
import type { ImportCard, McqCard, StudyGrade } from './types';

const defaultDeckVersion = 'ppcdl-test-sets-1-9-deduped';

class StudyDatabase extends Dexie {
  cards!: Table<McqCard, number>;

  constructor() {
    super('mcq-fsrs-study');
    this.version(1).stores({
      cards: '++id, due, difficulty, stability, reps, state'
    });
  }
}

export const db = new StudyDatabase();

export async function getDeck(): Promise<McqCard[]> {
  return db.cards.orderBy('due').toArray();
}

export async function seedDefaultCards(): Promise<number> {
  const currentCards = await getDeck();
  if (
    currentCards.length > 0 &&
    localStorage.getItem('mcq-fsrs-defaults-version') === defaultDeckVersion
  ) {
    return 0;
  }

  const defaultQuestions = await fetchDefaultQuestions();
  const existing = new Set(currentCards.map(cardSignature));
  const missing = defaultQuestions.filter((card) => !existing.has(cardSignature(card)));
  if (missing.length > 0) await importCards(missing);
  localStorage.setItem('mcq-fsrs-defaults-seeded', 'yes');
  localStorage.setItem('mcq-fsrs-defaults-version', defaultDeckVersion);
  return missing.length;
}

export async function getDueCards(): Promise<McqCard[]> {
  const cards = await getDeck();
  return cards.filter((card) => isDue(card));
}

export async function addCard(input: ImportCard): Promise<number> {
  return db.cards.add(createNewCard(normalizeImportCard(input)));
}

export async function importCards(items: ImportCard[]): Promise<number> {
  const cards = items.map((item) => createNewCard(normalizeImportCard(item)));
  await db.cards.bulkAdd(cards);
  return cards.length;
}

export async function gradeCard(card: McqCard, grade: StudyGrade): Promise<void> {
  if (!card.id) return;
  await db.cards.put(reviewCard(card, grade));
}

export async function deleteCard(id: number): Promise<void> {
  await db.cards.delete(id);
}

export async function exportBackup(): Promise<string> {
  const exportedAt = new Date().toISOString();
  const cards = await getDeck();
  return JSON.stringify({ exportedAt, app: 'mcq-fsrs-study', version: 1, cards }, null, 2);
}

export async function restoreBackup(fileText: string): Promise<number> {
  const parsed = JSON.parse(fileText);
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  if (!Array.isArray(cards)) throw new Error('Backup must contain a cards array.');
  await db.transaction('rw', db.cards, async () => {
    await db.cards.clear();
    await db.cards.bulkAdd(cards.map(normalizeStoredCard));
  });
  return cards.length;
}

export function normalizeImportCard(card: ImportCard): Omit<McqCard, 'id' | 'due' | 'difficulty' | 'stability' | 'reps' | 'lapses' | 'state' | 'createdAt' | 'updatedAt'> {
  if (!card.question?.trim()) throw new Error('Every card needs question text.');
  if (!Array.isArray(card.answers) || card.answers.length < 2) throw new Error('Every card needs at least two answers.');
  if (!Number.isInteger(card.correctIndex) || card.correctIndex < 0 || card.correctIndex >= card.answers.length) {
    throw new Error('correctIndex must point to one of the answers.');
  }

  return {
    sourceSet: card.sourceSet,
    sourceQuestion: card.sourceQuestion,
    question: card.question.trim(),
    answers: card.answers.map((answer) => String(answer ?? '').trim()),
    correctIndex: card.correctIndex,
    imageBase64: normalizeImageBase64(card.imageBase64 ?? card.questionImageBase64 ?? card.image)
  };
}

function normalizeStoredCard(card: McqCard): McqCard {
  const now = new Date().toISOString();
  const normalized = createNewCard(normalizeImportCard(card));
  return {
    ...normalized,
    id: card.id,
    sourceSet: card.sourceSet,
    sourceQuestion: card.sourceQuestion,
    due: card.due || now,
    difficulty: Number(card.difficulty ?? 5),
    stability: Number(card.stability ?? 0),
    reps: Number(card.reps ?? 0),
    lapses: Number(card.lapses ?? 0),
    state: card.state || 'new',
    createdAt: card.createdAt || now,
    updatedAt: card.updatedAt || now
  };
}

function cardSignature(card: Pick<ImportCard, 'question' | 'answers'>): string {
  return `${card.question.trim()}|${card.answers.map((answer) => String(answer ?? '').trim()).join('|')}`;
}

async function fetchDefaultQuestions(): Promise<ImportCard[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/default-questions.json`);
  if (!response.ok) throw new Error('Could not load bundled default questions.');
  const cards = await response.json();
  if (!Array.isArray(cards)) throw new Error('Bundled default questions must be an array.');
  return cards as ImportCard[];
}
