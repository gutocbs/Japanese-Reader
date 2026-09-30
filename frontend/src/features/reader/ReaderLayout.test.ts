import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(import.meta.dirname, '../../styles/global.css'), 'utf8');

describe('reader rail layout', () => {
  it('keeps the rail in a symmetric side column that follows the reading scroll', () => {
    expect(stylesheet).toMatch(/\.reader-layout \{[\s\S]*display: grid;[\s\S]*grid-template-columns: 3\.5rem minmax\(0, var\(--reader-text-width\)\) 3\.5rem;/);
    expect(stylesheet).toMatch(/\.reader-rail \{[\s\S]*position: sticky;[\s\S]*align-self: start;/);
    expect(stylesheet).toMatch(/\.reader-page \{[\s\S]*grid-column: 2;[\s\S]*padding-left: var\(--space-8\);/);
    expect(stylesheet).toMatch(/\.reader-page \{[\s\S]*border-left: 1px solid var\(--color-reader-divider\);/);
    expect(stylesheet).toMatch(/\.reader-rail__divider \{[\s\S]*border-top: 1px solid var\(--color-reader-divider\);/);
  });

  it('centers every rail control with an explicit content box', () => {
    expect(stylesheet).toMatch(/\.reader-rail \{[\s\S]*justify-items: center;/);
    expect(stylesheet).toMatch(/\.reader-rail__button \{[\s\S]*place-items: center;[\s\S]*width: 2\.25rem;[\s\S]*height: 2\.25rem;[\s\S]*box-sizing: border-box;[\s\S]*text-align: center;[\s\S]*line-height: 1;/);
    expect(stylesheet).toMatch(/\.reader-rail__font-size \{[\s\S]*display: grid;[\s\S]*place-items: center;[\s\S]*width: 2\.25rem;[\s\S]*height: 2\.25rem;[\s\S]*box-sizing: border-box;[\s\S]*line-height: 1;/);
    expect(stylesheet).toMatch(/\.reader-rail__divider \{[\s\S]*display: block;[\s\S]*box-sizing: border-box;[\s\S]*margin-inline: auto;/);
  });

  it('gives the rail enough inner width to center its 2.25rem controls', () => {
    expect(stylesheet).toMatch(/\.reader-layout \{[\s\S]*grid-template-columns: 3\.5rem minmax\(0, var\(--reader-text-width\)\) 3\.5rem;/);
    expect(stylesheet).toMatch(/\.reader-layout \{[\s\S]*width: min\(100%, calc\(var\(--reader-text-width\) \+ 9rem\)\);/);
    expect(stylesheet).toMatch(/\.reader-rail \{[\s\S]*width: 3\.5rem;[\s\S]*padding: var\(--space-2\);/);
  });
});

describe('library filter popup layout', () => {
  it('anchors the popup top edge to the library controls divider', () => {
    expect(stylesheet).toMatch(/\.library-controls \{[\s\S]*border-top: 1px solid var\(--color-border\);[\s\S]*padding: var\(--space-4\) 0;/);
    expect(stylesheet).toMatch(/\.library-filters \{[\s\S]*top: calc\(100% \+ var\(--space-4\) \+ 1px\);/);
  });
});
