import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { extractResume, loadResumeConfig, orderPageItems, safeUrl, projectRoot } from '../scripts/extract-resume.mjs';
import { normalizeResume, validateResume, renderStaticPortfolio } from '../scripts/normalize-resume.mjs';
import { verifyRelativeAsset } from '../scripts/validate-output.mjs';

const config = await loadResumeConfig();
const fixture = text => ({ text, lines: text.split('\n').map(value => ({ text: value, breakBefore: false, links: [] })) });

test('normalization supports missing optional sections and preserves real identity', () => {
  const result = normalizeResume(fixture('Ada Example\nada@example.com\nProjects\n1. A small compiler\n2025 | OCaml\n● Compiled expressions to bytecode.'), config);
  assert.equal(result.name, 'Ada Example');
  assert.equal(result.contact.email, 'ada@example.com');
  assert.equal(result.sections.find(section => section.type === 'projects').entries[0].dates, '2025');
  assert.equal(result.sections.find(section => section.type === 'projects').entries[0].subtitle, 'OCaml');
  assert.equal(result.sections.some(section => section.type === 'education'), false);
  assert.equal(validateResume(result), true);
});

test('heading aliases are configurable and record identifiers remain stable', () => {
  const custom = { ...config, sectionAliases: [...config.sectionAliases, { id: 'community', type: 'volunteering', label: 'Community', aliases: ['Civic Contributions'] }] };
  const input = fixture('Ada Example\nCivic Contributions\n1. Local garden\n● Mentored volunteers.');
  const a = normalizeResume(input, custom); const b = normalizeResume(input, custom);
  assert.deepEqual(a, b);
  assert.equal(a.sections[0].id, 'community');
  assert.equal(a.sections[0].entries[0].id, 'community-local-garden');
});

test('empty or unrecognized résumé content fails helpfully', () => {
  assert.throws(() => normalizeResume({ text: '' }, config), /empty/);
  assert.throws(() => normalizeResume(fixture('Ada Example\nUnusual column layout\nSome data'), config), /section aliases|sectionAliases/i);
  assert.throws(() => normalizeResume(fixture('Projects\n1. Project\n● Detail'), config), /identify a name/);
});

test('malformed PDFs and missing source files fail at extraction', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'resume-test-'));
  try {
    await writeFile(join(temporary, 'bad.pdf'), 'This is not a PDF document.');
    await assert.rejects(extractResume(join(temporary, 'bad.pdf')), /Invalid résumé PDF/);
    await assert.rejects(extractResume(join(temporary, 'absent.pdf')), /not found/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('scanned or image-only PDFs produce a useful OCR error', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'resume-scan-'));
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream'
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  try {
    await writeFile(join(temporary, 'scan.pdf'), pdf);
    await assert.rejects(extractResume(join(temporary, 'scan.pdf')), /OCR is required/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('column ordering keeps left and right sections separate', () => {
  const items = [];
  for (let index = 0; index < 8; index++) {
    items.push({ text: `left${index}`, x: 70, y: 700 - index * 14, width: 190, height: 11 });
    items.push({ text: `right${index}`, x: 330, y: 700 - index * 14, width: 190, height: 11 });
  }
  const ordered = orderPageItems(items, 612, 2, config);
  assert.deepEqual(ordered.slice(0, 8).map(line => line.text), Array.from({ length: 8 }, (_, index) => `left${index}`));
  assert.equal(ordered[8].text, 'right0');
});

test('HTML escapes PDF content and disallows executable URL schemes', () => {
  const result = normalizeResume(fixture('Ada Example\nProjects\n1. <script>alert(1)</script>\n● <img src=x onerror=alert(1)>'), config);
  const html = renderStaticPortfolio(result);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(html.includes('<script>'), false);
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(safeUrl('https://example.com/path'), 'https://example.com/path');
  result.links.push({ label: 'Unsafe', url: 'javascript:alert(1)' });
  assert.throws(() => validateResume(result), /Malformed professional URL/);
});

test('validation rejects duplicated identifiers and empty records', () => {
  const result = normalizeResume(fixture('Ada Example\nProjects\n1. Project\n● A useful detail.'), config);
  result.sections.push(structuredClone(result.sections[0]));
  assert.throws(() => validateResume(result), /duplicate/);
});

test('current source résumé extracts consistently and preserves all annotated links', async () => {
  const extraction = await extractResume(resolve(projectRoot, config.resumeFile), config);
  const resume = normalizeResume(extraction, config);
  assert.ok(resume.name.length > 1);
  assert.equal(resume.sourceText, extraction.text);
  assert.match(resume.sourceHash, /^[a-f0-9]{64}$/);
  assert.ok(resume.sections.every(section => section.entries.length > 0));
  for (const link of extraction.links) assert.ok(resume.links.some(value => value.url === link.url), `Missing annotated URL ${link.url}`);
  assert.deepEqual(resume, normalizeResume(extraction, config));
  assert.ok(renderStaticPortfolio(resume).includes('href="resume.pdf"'));
});

test('wrapped bullet text stays in its category and numbered parentheses are preserved', () => {
  const input = { text: 'Ada Example\nTechnical Skills\n● Languages: Java, Python,\nOCaml, C\nEducation\nExample School\n● Distinction (Grade\n4)', lines: [
    { text: 'Ada Example' }, { text: 'Technical Skills' }, { text: '● Languages: Java, Python,' },
    { text: 'OCaml, C' }, { text: 'Education' }, { text: 'Example School' },
    { text: '● Distinction (Grade' }, { text: '4)' }
  ] };
  const resume = normalizeResume(input, config);
  const skills = resume.sections.find(section => section.type === 'skills').entries;
  assert.equal(skills[0].title, 'Languages');
  assert.equal(skills[0].details[0], 'Java, Python, OCaml, C');
  assert.equal(skills[0].id, 'technical-skills-languages');
  assert.equal(resume.sections.find(section => section.type === 'education').entries[0].details[0], 'Distinction (Grade 4)');
});

test('relative assets resolve under a GitHub Pages repository subpath', () => {
  assert.equal(verifyRelativeAsset('./assets/game.js'), 'assets/game.js');
  assert.equal(verifyRelativeAsset('../assets/font.ttf', 'assets/game.css'), 'assets/font.ttf');
  assert.throws(() => verifyRelativeAsset('/assets/game.js'), /Root-relative/);
  assert.throws(() => verifyRelativeAsset('https://example.com/sprite.png'), /local/);
  assert.throws(() => verifyRelativeAsset('../outside.png'), /escapes/);
});
