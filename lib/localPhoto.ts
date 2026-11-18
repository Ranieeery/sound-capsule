export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTO_DIMENSION = 1440;
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHOTO_ACCEPT_ATTRIBUTE = 'image/jpeg,image/png,image/webp';

export type PhotoErrorCode = 'invalid_type' | 'too_large' | 'invalid_image' | 'unknown';

export class PhotoError extends Error {
  readonly code: PhotoErrorCode;

  constructor(code: PhotoErrorCode) {
    super(code);
    this.name = 'PhotoError';
    this.code = code;
  }
}

export function validatePhotoFile(file: Pick<File, 'type' | 'size'>): PhotoErrorCode | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type as (typeof ACCEPTED_PHOTO_TYPES)[number])) {
    return 'invalid_type';
  }
  if (file.size <= 0) return 'invalid_image';
  if (file.size > MAX_PHOTO_BYTES) return 'too_large';
  return null;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new PhotoError('invalid_image'));
    image.src = source;
  });
}

/**
 * Converts a local file into a downscaled JPEG data URL. Everything happens in
 * the browser: the file is never uploaded or persisted.
 */
export async function fileToCardPhoto(file: File): Promise<string> {
  const errorCode = validatePhotoFile(file);
  if (errorCode) throw new PhotoError(errorCode);

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new PhotoError('unknown');

    // Flatten transparency to the card's dark hero background.
    context.fillStyle = '#18181b';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    throw new PhotoError('invalid_image');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
