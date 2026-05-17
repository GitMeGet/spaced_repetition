import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const canonicalPath = 'public/data/default-questions.json';
const islandBlurRegionsPath = 'src/lib/island-image-blur-regions.json';
const publicRoot = 'public';

const canonical = readJson(canonicalPath);
const islandBlurRegions = readJson(islandBlurRegionsPath);

validateCards(canonical, canonicalPath);
validateIslandBlurRegions(canonical, islandBlurRegions, islandBlurRegionsPath);

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
      if (imageField in card) {
        validateBundledAssetPath(card[imageField], `${row} ${imageField}`);
      }
    }

    const key = `${card.sourceSet}|${card.sourceQuestion}`;
    if (keys.has(key)) throw new Error(`${label} contains duplicate source key ${key}.`);
    keys.add(key);
  }
}

function validateBundledAssetPath(value, label) {
  const trimmed = String(value ?? '').trim();
  if (/^(data:|https?:|blob:)/i.test(trimmed)) return;
  const relativePath = trimmed.replace(/^\/+/, '');
  if (!existsSync(join(publicRoot, relativePath))) {
    throw new Error(`${label} points to a missing bundled asset: ${trimmed}`);
  }
}

function validateIslandBlurRegions(cards, regionsByPath, label) {
  if (!regionsByPath || typeof regionsByPath !== 'object' || Array.isArray(regionsByPath)) {
    throw new Error(`${label} must contain an object keyed by image path.`);
  }

  const islandsQuestionImages = new Set(
    cards
      .filter((card) => card.sourceSet === 'Islands' && typeof card.imageSrc === 'string' && card.imageSrc.trim() !== '')
      .map((card) => card.imageSrc.trim().replace(/^\/+/, ''))
  );

  for (const imageSrc of islandsQuestionImages) {
    if (!(imageSrc in regionsByPath)) {
      throw new Error(`${label} is missing blur regions for ${imageSrc}.`);
    }
  }

  for (const [imageSrc, regions] of Object.entries(regionsByPath)) {
    validateBundledAssetPath(imageSrc, `${label} key ${imageSrc}`);
    if (!Array.isArray(regions)) throw new Error(`${label} ${imageSrc} must be an array.`);

    regions.forEach((region, index) => {
      const row = `${label} ${imageSrc}[${index}]`;
      if (!region || typeof region !== 'object' || Array.isArray(region)) {
        throw new Error(`${row} must be an object.`);
      }
      for (const field of ['x', 'y', 'width', 'height']) {
        if (!Number.isFinite(region[field])) {
          throw new Error(`${row}.${field} must be a finite number.`);
        }
      }
      if (region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0) {
        throw new Error(`${row} must use non-negative x/y and positive width/height.`);
      }
      if (region.x + region.width > 100 || region.y + region.height > 100) {
        throw new Error(`${row} must stay within 0..100 percent bounds.`);
      }
    });
  }
}
