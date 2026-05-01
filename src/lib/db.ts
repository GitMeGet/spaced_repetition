import Dexie, { type Table } from 'dexie';
import { normalizeImageBase64 } from './images';
import { createNewCard, isDue, reviewCard } from './scheduler';
import type { CardType, ImportCard, McqCard, StudyGrade } from './types';

export type DefaultSyncSummary = {
  added: number;
  updated: number;
  deleted: number;
};

class StudyDatabase extends Dexie {
  cards!: Table<McqCard, number>;

  constructor() {
    super('mcq-fsrs-study');
    this.version(1).stores({
      cards: '++id, due, difficulty, stability, reps, state'
    });
    this.version(2).stores({
      cards: '++id, due, difficulty, stability, reps, state, sourceSet, sourceQuestion, [sourceSet+sourceQuestion]'
    });
  }
}

export const db = new StudyDatabase();

export async function getDeck(): Promise<McqCard[]> {
  return db.cards.orderBy('due').toArray();
}

export async function syncDefaultCards(): Promise<DefaultSyncSummary> {
  const defaultQuestions = (await fetchDefaultQuestions()).map(normalizeImportCard);
  const defaultKeys = new Set<string>();
  for (const card of defaultQuestions) {
    const key = sourceKey(card);
    if (!key) throw new Error('Bundled default questions must include sourceSet and sourceQuestion.');
    if (defaultKeys.has(key)) throw new Error(`Duplicate bundled source key: ${key}`);
    defaultKeys.add(key);
  }

  const summary: DefaultSyncSummary = { added: 0, updated: 0, deleted: 0 };

  await db.transaction('rw', db.cards, async () => {
    const storedCards = await db.cards.toArray();
    const storedBySource = new Map<string, McqCard>();
    const sourceIdsToDelete: number[] = [];
    const legacyBySignature = new Map<string, McqCard>();

    for (const card of storedCards) {
      const key = sourceKey(card);
      if (key) {
        if (!storedBySource.has(key)) storedBySource.set(key, card);
        else if (card.id !== undefined) sourceIdsToDelete.push(card.id);
        continue;
      }

      if (!legacyBySignature.has(cardSignature(card))) {
        legacyBySignature.set(cardSignature(card), card);
      }
    }

    for (const card of storedCards) {
      const key = sourceKey(card);
      if (key && !defaultKeys.has(key) && card.id !== undefined) {
        sourceIdsToDelete.push(card.id);
      }
    }

    const cardsToAdd: McqCard[] = [];
    const cardsToPut: McqCard[] = [];
    const handledIds = new Set<number>();

    for (const defaultCard of defaultQuestions) {
      const key = sourceKey(defaultCard);
      let storedCard = storedBySource.get(key);

      if (!storedCard) {
        storedCard = legacyBySignature.get(cardSignature(defaultCard));
      }

      if (!storedCard) {
        cardsToAdd.push(createNewCard(defaultCard));
        continue;
      }

      if (storedCard.id !== undefined) handledIds.add(storedCard.id);
      const updated = mergeDefaultContent(storedCard, defaultCard);
      if (updated) cardsToPut.push(updated);
    }

    const deleteIds = [...new Set(sourceIdsToDelete.filter((id) => !handledIds.has(id)))];
    if (deleteIds.length > 0) await db.cards.bulkDelete(deleteIds);
    if (cardsToPut.length > 0) await db.cards.bulkPut(cardsToPut);
    if (cardsToAdd.length > 0) await db.cards.bulkAdd(cardsToAdd);

    summary.added = cardsToAdd.length;
    summary.updated = cardsToPut.length;
    summary.deleted = deleteIds.length;
  });

  localStorage.removeItem('mcq-fsrs-defaults-seeded');
  localStorage.removeItem('mcq-fsrs-defaults-version');
  return summary;
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

export async function updateCardNote(id: number, note: string): Promise<void> {
  await db.cards.update(id, { note: note.trim(), updatedAt: new Date().toISOString() });
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
  const cardType = normalizeCardType(card);
  if (!Array.isArray(card.answers)) throw new Error('Every card needs answers.');

  const answers = card.answers.map((answer) => String(answer ?? '').trim());
  if (cardType === 'reveal') {
    if (answers.length !== 1 || !answers[0]) throw new Error('Reveal cards need exactly one expected answer.');
    if (card.correctIndex !== 0) throw new Error('Reveal cards must use correctIndex 0.');
  } else if (answers.length < 2) {
    throw new Error('MCQ cards need at least two answers.');
  } else if (!Number.isInteger(card.correctIndex) || card.correctIndex < 0 || card.correctIndex >= answers.length) {
    throw new Error('correctIndex must point to one of the answers.');
  }

  return {
    cardType: cardType === 'reveal' ? 'reveal' : undefined,
    sourceSet: card.sourceSet,
    sourceQuestion: card.sourceQuestion,
    question: card.question.trim(),
    answers,
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
    note: String(card.note ?? '').trim() || undefined,
    createdAt: card.createdAt || now,
    updatedAt: card.updatedAt || now
  };
}

function cardSignature(card: Pick<ImportCard, 'question' | 'answers'>): string {
  return `${card.question.trim()}|${card.answers.map((answer) => String(answer ?? '').trim()).join('|')}`;
}

function normalizeCardType(card: Pick<ImportCard, 'cardType'>): CardType {
  if (!card.cardType || card.cardType === 'mcq') return 'mcq';
  if (card.cardType === 'reveal') return 'reveal';
  throw new Error('cardType must be mcq or reveal.');
}

function sourceKey(card: Pick<ImportCard, 'sourceSet' | 'sourceQuestion'>): string {
  return card.sourceSet && card.sourceQuestion ? `${card.sourceSet}|${card.sourceQuestion}` : '';
}

function mergeDefaultContent(stored: McqCard, bundled: ReturnType<typeof normalizeImportCard>): McqCard | undefined {
  const next: McqCard = {
    ...stored,
    sourceSet: bundled.sourceSet,
    sourceQuestion: bundled.sourceQuestion,
    cardType: bundled.cardType,
    question: bundled.question,
    answers: bundled.answers,
    correctIndex: bundled.correctIndex,
    imageBase64: bundled.imageBase64
  };

  const changed =
    stored.sourceSet !== next.sourceSet ||
    stored.sourceQuestion !== next.sourceQuestion ||
    stored.cardType !== next.cardType ||
    stored.question !== next.question ||
    stored.correctIndex !== next.correctIndex ||
    stored.imageBase64 !== next.imageBase64 ||
    stored.answers.length !== next.answers.length ||
    stored.answers.some((answer, index) => answer !== next.answers[index]);

  if (!changed) return undefined;
  return { ...next, updatedAt: new Date().toISOString() };
}

async function fetchDefaultQuestions(): Promise<ImportCard[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/default-questions.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error('Could not load bundled default questions.');
  const cards = await response.json();
  if (!Array.isArray(cards)) throw new Error('Bundled default questions must be an array.');
  return cards as ImportCard[];
}
