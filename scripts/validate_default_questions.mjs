import { readFileSync } from 'node:fs';

const canonicalPath = 'public/data/default-questions.json';

const canonical = readJson(canonicalPath);

validateCards(canonical, canonicalPath);

console.log(`Validated ${canonical.length} bundled default questions.`);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse ${path}: ${message}`);
  }
}

function validateCards(cards, label) {
  if (!Array.isArray(cards)) throw new Error(`${label} must contain an array.`);

  const keys = new Set();
  for (const [index, card] of cards.entries()) {
    const row = `${label}[${index}]`;
    if (!card || typeof card !== 'object') throw new Error(`${row} must be an object.`);
    if (typeof card.sourceSet !== 'string' || card.sourceSet.trim() === '') {
      throw new Error(`${row} must include sourceSet.`);
    }
    if (!Number.isInteger(card.sourceQuestion)) {
      throw new Error(`${row} must include integer sourceQuestion.`);
    }
    if (typeof card.question !== 'string' || card.question.trim() === '') {
      throw new Error(`${row} must include question text.`);
    }
    const cardType = card.cardType ?? 'mcq';
    if (!['mcq', 'reveal'].includes(cardType)) {
      throw new Error(`${row} cardType must be mcq or reveal.`);
    }
    if (!Array.isArray(card.answers)) {
      throw new Error(`${row} must include answers.`);
    }
    if (cardType === 'reveal') {
      if (card.answers.length !== 1 || typeof card.answers[0] !== 'string' || card.answers[0].trim() === '') {
        throw new Error(`${row} reveal cards must include exactly one non-empty answer.`);
      }
      if (card.correctIndex !== 0) {
        throw new Error(`${row} reveal cards must use correctIndex 0.`);
      }
    } else if (card.answers.length < 2) {
      throw new Error(`${row} MCQ cards must include at least two answers.`);
    } else if (!Number.isInteger(card.correctIndex) || card.correctIndex < 0 || card.correctIndex >= card.answers.length) {
      throw new Error(`${row} must include a valid correctIndex.`);
    }
    for (const imageField of ['imageSrc', 'answerImageSrc']) {
      if (imageField in card && (typeof card[imageField] !== 'string' || card[imageField].trim() === '')) {
        throw new Error(`${row} ${imageField} must be a non-empty string when present.`);
      }
    }

    const key = `${card.sourceSet}|${card.sourceQuestion}`;
    if (keys.has(key)) throw new Error(`${label} contains duplicate source key ${key}.`);
    keys.add(key);
  }
}
