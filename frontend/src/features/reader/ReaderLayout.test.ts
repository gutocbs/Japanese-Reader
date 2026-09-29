import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(import.meta.dirname, '../../styles/global.css'), 'utf8');

describe('reader rail layout', () => {
  it('places the rail in its own column outside the reading surface and uses a subdued divider', () => {
    expect(stylesheet).toMatch(/\.reader-layout \{[\s\S]*position: relative;/);
    expect(stylesheet).toMatch(/\.reader-rail \{[\s\S]*position: absolute;[\s\S]*right: calc\(100% \+ var\(--space-4\)\);/);
    expect(stylesheet).not.toMatch(/\.reader-rail \{[\s\S]*left: max\(var\(--space-4\), calc\(\(100vw - var\(--reader-text-width\)\)/);
    expect(stylesheet).toMatch(/\.reader-page \{[\s\S]*border-left: 1px solid var\(--color-reader-divider\);/);
    expect(stylesheet).toMatch(/\.reader-rail__divider \{[\s\S]*border-top: 1px solid var\(--color-reader-divider\);/);
  });

  it('centers every rail control in a consistent square track', () => {
    expect(stylesheet).toMatch(/\.reader-rail \{[\s\S]*justify-items: center;/);
    expect(stylesheet).toMatch(/\.reader-rail__button \{[\s\S]*place-items: center;[\s\S]*width: 2\.25rem;[\s\S]*height: 2\.25rem;/);
    expect(stylesheet).toMatch(/\.reader-rail__font-size \{[\s\S]*display: grid;[\s\S]*place-items: center;[\s\S]*width: 2\.25rem;[\s\S]*height: 2\.25rem;/);
    expect(stylesheet).toMatch(/\.reader-rail__divider \{[\s\S]*display: block;[\s\S]*box-sizing: border-box;[\s\S]*margin-inline: auto;/);
  });
});
