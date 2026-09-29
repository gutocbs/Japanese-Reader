const JAPANESE_CHARACTER = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

function isJapaneseCharacter(value: string | undefined): boolean {
  return value !== undefined && JAPANESE_CHARACTER.test(value);
}

/**
 * Experimental, opt-in normalization for pasted text.
 *
 * It joins only a single LF or CRLF directly bounded by Japanese characters.
 * Blank lines and every other boundary remain byte-for-byte unchanged.
 */
export function joinSimpleJapaneseLineBreaks(content: string): string {
  let normalized = '';

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const isCrLf = character === '\r' && content[index + 1] === '\n';
    const isLf = character === '\n';

    if (!isCrLf && !isLf) {
      normalized += character;
      continue;
    }

    const newlineLength = isCrLf ? 2 : 1;
    const precedingCharacter = content[index - 1];
    const followingCharacter = content[index + newlineLength];

    if (isJapaneseCharacter(precedingCharacter) && isJapaneseCharacter(followingCharacter)) {
      index += newlineLength - 1;
      continue;
    }

    normalized += content.slice(index, index + newlineLength);
    index += newlineLength - 1;
  }

  return normalized;
}
