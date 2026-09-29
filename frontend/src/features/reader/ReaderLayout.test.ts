import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(import.meta.dirname, '../../styles/global.css'), 'utf8');

describe('reader rail layout', () => {
  it('keeps the rail outside the centered reader column and uses a subdued divider', () => {
    expect(stylesheet).toMatch(/\.reader-rail \{[\s\S]*left: max\(var\(--space-4\), calc\(\(100vw - var\(--reader-text-width\)\) \/ 2 - var\(--space-16\)\)\);/);
    expect(stylesheet).toMatch(/\.reader-page \{[\s\S]*border-left: 1px solid var\(--color-reader-divider\);/);
    expect(stylesheet).toMatch(/\.reader-rail__divider \{[\s\S]*border-top: 1px solid var\(--color-reader-divider\);/);
  });
});
