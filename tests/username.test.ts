import { describe, expect, it } from 'vitest';
import {
  extractLastfmUsername,
  normalizeLastfmUsernameInput,
} from '@/lib/username';

describe('extractLastfmUsername', () => {
  it('extracts the username from profile URLs', () => {
    expect(extractLastfmUsername('https://www.last.fm/user/Raniery_')).toBe('Raniery_');
    expect(extractLastfmUsername('http://last.fm/user/Raniery_/')).toBe('Raniery_');
    expect(extractLastfmUsername('www.last.fm/user/Raniery_?foo=bar')).toBe('Raniery_');
    expect(extractLastfmUsername('last.fm/user/Raniery_/library')).toBe('Raniery_');
  });

  it('decodes percent-encoded usernames', () => {
    expect(extractLastfmUsername('https://last.fm/user/Raniery%5F')).toBe('Raniery_');
  });

  it('returns null when there is no profile URL', () => {
    expect(extractLastfmUsername('Raniery_')).toBeNull();
    expect(extractLastfmUsername('https://example.com/user/Raniery_')).toBeNull();
  });
});

describe('normalizeLastfmUsernameInput', () => {
  it('turns pasted profile URLs into a bare username', () => {
    expect(normalizeLastfmUsernameInput('https://www.last.fm/user/Raniery_')).toBe('Raniery_');
    expect(normalizeLastfmUsernameInput('  https://last.fm/user/Raniery_/  ')).toBe('Raniery_');
  });

  it('accepts usernames pasted with @ or trailing slash', () => {
    expect(normalizeLastfmUsernameInput('@Raniery_')).toBe('Raniery_');
    expect(normalizeLastfmUsernameInput('Raniery_/')).toBe('Raniery_');
  });

  it('leaves plain usernames unchanged', () => {
    expect(normalizeLastfmUsernameInput('Raniery_')).toBe('Raniery_');
    expect(normalizeLastfmUsernameInput('  Raniery_  ')).toBe('Raniery_');
  });

  it('handles empty input', () => {
    expect(normalizeLastfmUsernameInput('')).toBe('');
    expect(normalizeLastfmUsernameInput('   ')).toBe('');
  });
});
