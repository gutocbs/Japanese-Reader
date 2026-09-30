export const NoteExtractionFailureCode = Object.freeze({
  UNSUPPORTED_ROUTE: 'UNSUPPORTED_ROUTE',
  MISSING_TITLE: 'MISSING_TITLE',
  MISSING_ARTICLE_CONTAINER: 'MISSING_ARTICLE_CONTAINER',
  EMPTY_TEXT: 'EMPTY_TEXT',
  UNRECOGNIZED_ARTICLE_STRUCTURE: 'UNRECOGNIZED_ARTICLE_STRUCTURE',
});

const ARTICLE_SELECTOR = 'article.p-article__body';
const ARTICLE_TEXT_SELECTOR = '.note-common-styles__textnote-body';
const TEXT_BLOCK_TAGS = new Set(['P', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI']);
const IGNORED_TAGS = new Set([
  'ASIDE', 'AUDIO', 'BUTTON', 'CANVAS', 'EMBED', 'FIGURE', 'FORM', 'IFRAME', 'IMG', 'INPUT',
  'MENU', 'NAV', 'NOSCRIPT', 'OBJECT', 'SCRIPT', 'SELECT', 'STYLE', 'SVG', 'TEXTAREA', 'VIDEO',
]);

export function extractNoteArticle({ document, url }) {
  if (!isSupportedArticleUrl(url)) {
    return failure(NoteExtractionFailureCode.UNSUPPORTED_ROUTE);
  }

  const article = document.querySelector(ARTICLE_SELECTOR);
  if (!article) {
    return failure(NoteExtractionFailureCode.MISSING_ARTICLE_CONTAINER);
  }

  const title = normalizeInlineText(article.querySelector('h1'));
  if (!title) {
    return failure(NoteExtractionFailureCode.MISSING_TITLE);
  }

  const textContainer = article.querySelector(ARTICLE_TEXT_SELECTOR);
  if (!textContainer) {
    return failure(NoteExtractionFailureCode.MISSING_ARTICLE_CONTAINER);
  }

  const blocks = collectTextBlocks(textContainer);
  if (blocks === null) {
    return failure(NoteExtractionFailureCode.UNRECOGNIZED_ARTICLE_STRUCTURE);
  }
  const text = blocks.join('\n\n').trim();
  if (!text) {
    return failure(NoteExtractionFailureCode.EMPTY_TEXT);
  }

  return {
    ok: true,
    value: { title, text, url },
  };
}

function isSupportedArticleUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'note.com'
      && /^\/[^/]+\/n\/n[a-z0-9]+$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function collectTextBlocks(textContainer) {
  const blocks = [];

  for (const child of textContainer.childNodes) {
    if (child.nodeType === 3) {
      if (child.textContent.trim()) {
        return null;
      }
      continue;
    }

    if (child.nodeType !== 1) {
      continue;
    }

    if (shouldIgnore(child)) {
      continue;
    }

    if (TEXT_BLOCK_TAGS.has(child.tagName)) {
      const text = normalizeBlockText(child);
      if (text) {
        blocks.push(text);
      }
      continue;
    }

    if (child.tagName === 'UL' || child.tagName === 'OL') {
      for (const item of child.querySelectorAll(':scope > li')) {
        const text = normalizeBlockText(item);
        if (text) {
          blocks.push(text);
        }
      }
      continue;
    }

    if (child.tagName === 'HR') {
      continue;
    }

    if (normalizeInlineText(child)) {
      return null;
    }
  }

  return blocks;
}

function shouldIgnore(element) {
  return IGNORED_TAGS.has(element.tagName);
}

function normalizeBlockText(element) {
  return normalizeInlineText(element)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeInlineText(node) {
  if (!node) {
    return '';
  }

  if (node.nodeType === 3) {
    return node.textContent.replace(/\s+/g, ' ');
  }

  if (node.nodeType !== 1 || shouldIgnore(node)) {
    return '';
  }

  if (node.tagName === 'BR') {
    return '\n';
  }

  return Array.from(node.childNodes, normalizeInlineText).join('');
}

function failure(code) {
  return { ok: false, error: { code } };
}
