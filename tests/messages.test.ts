import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales } from '@/lib/locales';

function readMessages(locale: string): Record<string, string> {
  const file = path.join(process.cwd(), 'messages', `${locale}.json`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;

  const flattened: Record<string, string> = {};
  const walk = (value: unknown, prefix: string) => {
    if (typeof value === 'string') {
      flattened[prefix] = value;
      return;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, prefix ? `${prefix}.${key}` : key);
    }
  };

  walk(raw, '');
  return flattened;
}

const PLACEHOLDER_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_]*)(?=[,}])/g;

function placeholders(value: string): string {
  return [...value.matchAll(PLACEHOLDER_PATTERN)]
    .map((match) => match[1])
    .sort()
    .join(',');
}

describe('locale messages', () => {
  const base = readMessages('pt');
  const baseKeys = Object.keys(base).sort();

  it.each(locales)('%s has every key from pt.json', (locale) => {
    const messages = readMessages(locale);
    expect(Object.keys(messages).sort()).toEqual(baseKeys);
  });

  it.each(locales)('%s preserves ICU placeholders', (locale) => {
    const messages = readMessages(locale);
    for (const key of baseKeys) {
      expect(placeholders(messages[key]), `${locale}: ${key}`).toBe(
        placeholders(base[key]),
      );
    }
  });

  it('has no missing translation values', () => {
    for (const locale of locales) {
      const messages = readMessages(locale);
      for (const key of baseKeys) {
        expect(messages[key]?.trim(), `${locale}: ${key}`).not.toBe('');
      }
    }
  });
});
