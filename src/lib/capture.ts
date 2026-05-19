import { toBlob } from 'html-to-image';

export type ImageClipboardErrorCode = 'unsupported' | 'permission' | 'capture';

export class ImageClipboardError extends Error {
  constructor(
    readonly code: ImageClipboardErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ImageClipboardError';
  }
}

export async function copyElementAsPng(element: HTMLElement): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new ImageClipboardError('unsupported', 'Image clipboard is not supported in this browser.');
  }

  if (typeof ClipboardItem.supports === 'function' && !ClipboardItem.supports('image/png')) {
    throw new ImageClipboardError('unsupported', 'PNG clipboard images are not supported in this browser.');
  }

  await waitForRenderableAssets(element);

  let blob: Blob | null;
  try {
    blob = await toBlob(element, {
      backgroundColor: '#ffffff',
      cacheBust: true,
      pixelRatio: Math.min(2, window.devicePixelRatio || 1)
    });
  } catch (error) {
    throw new ImageClipboardError(
      'capture',
      error instanceof Error ? error.message : 'Could not prepare the question image.'
    );
  }

  if (!blob) {
    throw new ImageClipboardError('capture', 'Could not prepare the question image.');
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } catch (error) {
    if (isClipboardPermissionError(error)) {
      throw new ImageClipboardError('permission', 'Clipboard permission was denied.');
    }
    throw new ImageClipboardError(
      'capture',
      error instanceof Error ? error.message : 'Could not copy the question image.'
    );
  }
}

async function waitForRenderableAssets(element: HTMLElement): Promise<void> {
  const fontReady = 'fonts' in document ? document.fonts.ready.catch(() => undefined) : Promise.resolve();
  const imagesReady = Promise.all(Array.from(element.querySelectorAll('img'), waitForImage));
  await Promise.all([fontReady, imagesReady]);
}

async function waitForImage(image: HTMLImageElement): Promise<void> {
  if (!image.currentSrc && !image.src) return;
  if (!image.complete) {
    await new Promise<void>((resolve) => {
      let timeout: number;
      const finish = () => {
        window.clearTimeout(timeout);
        image.removeEventListener('load', finish);
        image.removeEventListener('error', finish);
        resolve();
      };
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
      timeout = window.setTimeout(finish, 5000);
    });
  }

  if (image.decode) {
    await image.decode().catch(() => undefined);
  }
}

function isClipboardPermissionError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
}
