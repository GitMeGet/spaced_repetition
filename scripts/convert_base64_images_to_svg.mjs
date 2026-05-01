import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const imageFields = ['imageBase64', 'questionImageBase64', 'image'];
const assetDir = join('public', 'images', 'questions');
const targetFiles = [
  'src/lib/data/default-questions.json',
  ...jsonFilesIn('src/lib/data/sets'),
  'public/data/default-questions.json',
  'public/sample-questions.json'
];

const assets = new Map();
let convertedCards = 0;
let convertedFields = 0;

mkdirSync(assetDir, { recursive: true });

for (const filePath of targetFiles) {
  if (!existsSync(filePath)) continue;

  const cards = readJson(filePath);
  if (!Array.isArray(cards)) {
    throw new Error(`${filePath} must contain an array.`);
  }

  let changed = false;
  for (const [index, card] of cards.entries()) {
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      throw new Error(`${filePath}[${index}] must be an object.`);
    }

    const imageValues = imageFields
      .filter((field) => isDataImage(card[field]))
      .map((field) => ({ field, value: card[field].trim() }));

    if (imageValues.length === 0) continue;

    const uniqueValues = new Set(imageValues.map(({ value }) => value));
    if (uniqueValues.size > 1) {
      throw new Error(`${filePath}[${index}] has multiple different base64 image fields.`);
    }

    const asset = buildAsset(imageValues[0].value);
    const imageSrc = toPublicImageSrc(asset.fileName);
    const existingImageSrc = typeof card.imageSrc === 'string' ? card.imageSrc.trim() : '';
    if (existingImageSrc && existingImageSrc !== imageSrc) {
      throw new Error(`${filePath}[${index}] already has imageSrc "${existingImageSrc}" but base64 converts to "${imageSrc}".`);
    }

    for (const { field } of imageValues) {
      delete card[field];
      convertedFields += 1;
    }
    card.imageSrc = imageSrc;
    convertedCards += 1;
    changed = true;
  }

  if (changed) {
    writeJson(filePath, cards);
  }
}

for (const asset of assets.values()) {
  writeFileSync(join(assetDir, asset.fileName), asset.svg, 'utf8');
}

console.log(`Converted ${convertedFields} base64 field(s) on ${convertedCards} card(s).`);
console.log(`Wrote ${assets.size} SVG asset(s) to ${assetDir}.`);

function jsonFilesIn(dirPath) {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath)
    .filter((name) => name.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((name) => join(dirPath, name).replace(/\\/g, '/'));
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse ${filePath}: ${message}`);
  }
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isDataImage(value) {
  return typeof value === 'string' && /^data:image\/[^;]+;base64,/i.test(value.trim());
}

function buildAsset(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/is);
  if (!match) throw new Error('Invalid data image URL.');

  const mime = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64, 'base64');
  const hash = createHash('sha1').update(mime).update('\0').update(buffer).digest('hex');
  const fileName = `${hash.slice(0, 16)}.svg`;

  if (!assets.has(fileName)) {
    assets.set(fileName, {
      fileName,
      svg: mime === 'image/svg+xml' ? decodeSvg(buffer) : wrapRasterImage(mime, base64, buffer)
    });
  }

  return assets.get(fileName);
}

function toPublicImageSrc(fileName) {
  return `images/questions/${fileName}`;
}

function decodeSvg(buffer) {
  const svg = stripByteOrderMark(buffer.toString('utf8')).trim();
  if (!/<svg[\s>]/i.test(svg)) {
    throw new Error('Decoded image/svg+xml payload does not contain an <svg> element.');
  }
  return `${svg}\n`;
}

function stripByteOrderMark(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function wrapRasterImage(mime, base64, buffer) {
  const dimensions = readRasterDimensions(mime, buffer);
  const escapedMime = escapeXml(mime);
  const width = dimensions.width;
  const height = dimensions.height;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <image width="${width}" height="${height}" href="data:${escapedMime};base64,${base64}" />`,
    '</svg>',
    ''
  ].join('\n');
}

function readRasterDimensions(mime, buffer) {
  if (mime === 'image/png') return readPngDimensions(buffer);
  if (mime === 'image/jpeg' || mime === 'image/jpg') return readJpegDimensions(buffer);
  throw new Error(`Unsupported raster image type: ${mime}`);
}

function readPngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('Invalid PNG payload.');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Invalid JPEG payload.');
  }

  let offset = 2;
  while (offset < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;

    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;

    if (isStartOfFrame(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += length;
  }

  throw new Error('Could not read JPEG dimensions.');
}

function isStartOfFrame(marker) {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    ![0xc4, 0xc8, 0xcc].includes(marker)
  );
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&apos;';
      default:
        return char;
    }
  });
}
