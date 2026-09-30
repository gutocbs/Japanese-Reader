import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('./', import.meta.url);
const outputPath = new URL('./note-import.user.js', directory);

const [config, extractor, client, ui] = await Promise.all([
  readModule('config.js'),
  readModule('noteExtractor.js'),
  readModule('readerApiClient.js'),
  readModule('ui.js'),
]);

const bundled = `// ==UserScript==
// @name         Japanese Reader: Import note.com article
// @namespace    https://japanese.io/userscripts/note-import
// @version      0.1.0
// @description  Import supported note.com articles into the local Japanese Reader.
// @match        https://note.com/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const NoteImportConfig = (() => {
${indent(stripExports(config))}
    return { READER_API_CONFIG };
  })();

  const NoteImportExtractor = (() => {
${indent(stripExports(extractor))}
    return { extractNoteArticle };
  })();

  const NoteImportApi = (() => {
    const { READER_API_CONFIG } = NoteImportConfig;
${indent(stripExports(client).replace(/^import .*?;\r?\n/m, ''))}
    return { ReaderApiClient };
  })();

  const NoteImportUi = (() => {
    const { extractNoteArticle } = NoteImportExtractor;
    const { ReaderApiClient } = NoteImportApi;
${indent(stripExports(ui).replace(/^import .*?;\r?\n/gm, ''))}
    return { initializeNoteImport };
  })();

  NoteImportUi.initializeNoteImport();
})();
`;

await writeFile(fileURLToPath(outputPath), bundled, 'utf8');

async function readModule(name) {
  return readFile(fileURLToPath(new URL(name, directory)), 'utf8');
}

function stripExports(source) {
  return source.replace(/^export\s+/gm, '');
}

function indent(source) {
  return source.split('\n').map((line) => (line ? `    ${line}` : '')).join('\n');
}
