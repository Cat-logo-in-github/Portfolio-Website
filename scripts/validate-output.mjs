import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot, loadResumeConfig } from './extract-resume.mjs';
import { validateResume, escapeHtml } from './normalize-resume.mjs';
import { generateWorld } from '../src/core/world.mjs';

export function verifyRelativeAsset(reference, pagePath = 'index.html') {
  if (!reference || reference.startsWith('#') || /^(?:mailto|tel):/i.test(reference)) return null;
  if (/^(?:https?:)?\/\//i.test(reference)) throw new Error(`Runtime asset must be local: ${reference}`);
  if (reference.startsWith('/')) throw new Error(`Root-relative asset breaks GitHub Pages project URLs: ${reference}`);
  const base = 'https://example.github.io/a-project/';
  const result = new URL(reference, new URL(pagePath, base));
  if (!result.href.startsWith(base)) throw new Error(`Asset escapes the project subpath: ${reference}`);
  return decodeURIComponent(result.pathname.slice('/a-project/'.length));
}

async function allFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? allFiles(resolve(directory, entry.name)) : [resolve(directory, entry.name)]));
  return nested.flat();
}

export async function validateOutput(root = projectRoot) {
  const dist = resolve(root, 'dist');
  const config = await loadResumeConfig(root);
  const [index, portfolio, sourcePdf, deployedPdf, resume, world] = await Promise.all([
    readFile(resolve(dist, 'index.html'), 'utf8'), readFile(resolve(dist, 'portfolio.html'), 'utf8'),
    readFile(resolve(root, config.resumeFile || 'resume.pdf')), readFile(resolve(dist, 'resume.pdf')),
    readFile(resolve(dist, 'generated/resume.json'), 'utf8').then(JSON.parse),
    readFile(resolve(dist, 'generated/world.json'), 'utf8').then(JSON.parse)
  ]);
  validateResume(resume);
  assert.ok(sourcePdf.equals(deployedPdf), 'The deployed résumé PDF must be byte-for-byte identical to the source.');
  assert.deepEqual(world, generateWorld(resume), 'Deployed world differs from deterministic generation of the deployed résumé.');
  assert.ok(resume.sections.every(section => world.locations.some(location => location.sectionId === section.id)), 'Every résumé section needs a generated location.');
  const sections = new Map(resume.sections.map(section => [section.id, section]));
  for (const location of world.locations) {
    if (location.sectionId.startsWith('__')) continue;
    const section = sections.get(location.sectionId);
    assert.ok(section, `Location ${location.id} references an unknown résumé section.`);
    assert.deepEqual(location.recordIds, section.entries.map(entry => entry.id), `Invalid record references at ${location.id}.`);
  }
  assert.ok(index.includes('portfolio.html'), 'Main page must link to the JavaScript-free portfolio.');
  assert.ok(portfolio.includes('href="resume.pdf"'), 'Fallback portfolio needs a relative original résumé download link.');
  assert.ok(portfolio.includes(escapeHtml(resume.name)), 'Fallback portfolio must contain the extracted identity.');
  for (const section of resume.sections) for (const entry of section.entries) {
    assert.ok(portfolio.includes(escapeHtml(entry.title)), `Fallback portfolio omits ${entry.id}.`);
    for (const detail of entry.details) assert.ok(portfolio.includes(escapeHtml(detail)), `Fallback portfolio omits a detail from ${entry.id}.`);
  }
  for (const filename of ['tiny-town.png', 'tiny-dungeon.png', 'tiny-battle.png', 'PressStart2P-Regular.ttf']) {
    const info = await stat(resolve(dist, 'assets', filename));
    assert.ok(info.size > 0, `Missing or empty local asset ${filename}.`);
  }
  const files = await allFiles(dist);
  for (const file of files.filter(file => /\.(?:html|css)$/.test(file))) {
    const text = await readFile(file, 'utf8');
    const pagePath = relative(dist, file).replaceAll('\\', '/');
    const references = file.endsWith('.css')
      ? [...text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)].map(match => match[1])
      : [...text.matchAll(/<(?:script|img|source|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
    for (const reference of references) {
      if (reference.startsWith('data:')) continue;
      const path = verifyRelativeAsset(reference, pagePath);
      if (path) assert.ok((await stat(resolve(dist, path))).isFile(), `Missing deployed asset ${reference} from ${pagePath}.`);
    }
  }
  assert.equal(files.filter(file => file.endsWith('.pdf')).length, 1, 'The deployed artifact should contain a single résumé PDF copy.');
  console.log(`Validated static output: ${world.locations.length} section locations, exact original PDF, complete no-JavaScript portfolio, local assets and GitHub Pages project-path references.`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateOutput().catch(error => { console.error(`Static output validation failed: ${error.message}`); process.exitCode = 1; });
}
