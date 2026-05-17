import islandImageBlurRegions from './island-image-blur-regions.json';
import type { ImageBlurRegion, McqCard } from './types';

const islandsSourceSet = 'Islands';
const islandsBlurRegions = islandImageBlurRegions as Record<string, ImageBlurRegion[]>;

export function getQuestionImageBlurRegions(card: Pick<McqCard, 'sourceSet' | 'imageSrc'>): ImageBlurRegion[] {
  if (card.sourceSet !== islandsSourceSet) return [];
  const imageSrc = normalizeAssetPath(card.imageSrc);
  return imageSrc ? (islandsBlurRegions[imageSrc] ?? []) : [];
}

export function blurRegionClipPath(region: ImageBlurRegion): string {
  const right = 100 - region.x - region.width;
  const bottom = 100 - region.y - region.height;
  return `inset(${region.y}% ${right}% ${bottom}% ${region.x}%)`;
}

function normalizeAssetPath(path?: string): string {
  return String(path ?? '').trim().replace(/^\/+/, '');
}
