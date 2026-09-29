import { describe, expect, it } from 'vitest';
import { tagColorForName } from './tags';

describe('tag palette', () => {
  it('assigns a stable controlled palette color for a name', () => {
    expect(tagColorForName('Estudo')).toBe(tagColorForName('Estudo'));
  });
});
