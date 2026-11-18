import { describe, expect, it } from 'vitest';
import {
  MAX_PHOTO_BYTES,
  validatePhotoFile,
} from '@/lib/localPhoto';

describe('local photo validation', () => {
  it('accepts JPEG, PNG and WebP under 10 MB', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 1024 })).toBeNull();
    expect(validatePhotoFile({ type: 'image/png', size: 1024 })).toBeNull();
    expect(validatePhotoFile({ type: 'image/webp', size: 1024 })).toBeNull();
    expect(validatePhotoFile({ type: 'image/jpeg', size: MAX_PHOTO_BYTES })).toBeNull();
  });

  it('rejects unsupported formats and oversized files', () => {
    expect(validatePhotoFile({ type: 'image/svg+xml', size: 1024 })).toBe('invalid_type');
    expect(validatePhotoFile({ type: 'image/gif', size: 1024 })).toBe('invalid_type');
    expect(validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 })).toBe(
      'too_large',
    );
    expect(validatePhotoFile({ type: 'image/png', size: 0 })).toBe('invalid_image');
  });
});
