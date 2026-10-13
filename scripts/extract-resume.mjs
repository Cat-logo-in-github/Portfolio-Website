import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function loadResumeConfig(root = projectRoot) {
  const path = resolve(root, 'config/resume.config.json');
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { throw new Error(`Cannot read résumé configuration ${path}: ${error.message}`); }
}

export function normalizeWhitespace(text) {
  return String(text).normalize('NFKC').replace(/\u00ad/g, '').replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[\t\u00a0 ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return null;
    if (['http:', 'https:'].includes(url.protocol) && !url.hostname) return null;
    if (['mailto:', 'tel:'].includes(url.protocol) && !url.pathname) return null;
    return url.href;
  } catch { return null; }
}

function rowsFromItems(items) {
  const rows = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    let row = rows.find(value => Math.abs(value.y - item.y) <= Math.max(2, item.height * .18));
    if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  return rows.sort((a, b) => b.y - a.y).map(row => {
    row.items.sort((a, b) => a.x - b.x);
    let text = ''; let previous = null;
    for (const item of row.items) {
      // Preserve spaces, while joining PDF runs that split a URL in the middle.
      const gap = previous ? item.x - previous.x - previous.width : 0;
      if (text && !/\s$/.test(text) && !/^\s/.test(item.text) && gap > 1.6) text += ' ';
      text += item.text; previous = item;
    }
    return { ...row, text: normalizeWhitespace(text), x: Math.min(...row.items.map(item => item.x)),
      height: Math.max(...row.items.map(item => item.height)),
      width: Math.max(...row.items.map(item => item.x + item.width)) - Math.min(...row.items.map(item => item.x)),
      bold: row.items.some(item => item.bold) };
  }).filter(row => row.text);
}

export function orderPageItems(items, width, pageNumber, config = {}) {
  const split = width * .5;
  const forced = config.pageColumns?.[String(pageNumber)];
  const left = items.filter(item => item.x < split);
  const right = items.filter(item => item.x >= split);
  const crossing = items.filter(item => item.x < split - 12 && item.x + item.width > split + 12 && item.text.trim().length > 12);
  const autoColumns = rowsFromItems(left).length >= 6 && rowsFromItems(right).length >= 6 && crossing.length < 3;
  const columns = forced === 2 || (forced !== 1 && config.columnMode !== 'single' && autoColumns) ? [left, right] : [items];
  const result = [];
  for (const [column, source] of columns.entries()) {
    const rows = rowsFromItems(source);
    for (const [index, row] of rows.entries()) {
      const previous = rows[index - 1];
      result.push({ ...row, page: pageNumber, column, breakBefore: index === 0 || previous.y - row.y > Math.max(previous.height, row.height) * 1.55 });
    }
  }
  return result;
}

export async function extractResume(filePath, config = {}) {
  let bytes;
  try { bytes = await readFile(filePath); }
  catch (error) { throw new Error(`Résumé PDF not found at ${filePath}. Replace the configured source file or set resumeFile in config/resume.config.json. ${error.message}`); }
  if (bytes.length < 8 || !bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) {
    throw new Error(`Invalid résumé PDF at ${filePath}: expected a readable PDF document, not a renamed text or image file.`);
  }
  let pdf;
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true, isEvalSupported: false, verbosity: 0 }).promise;
  } catch (error) { throw new Error(`Could not extract résumé PDF ${filePath}: ${error.message}. Encrypted, corrupted, or unsupported PDFs must be exported as a text-based PDF.`); }
  const lines = []; const annotationLinks = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const [content, annotations] = await Promise.all([page.getTextContent(), page.getAnnotations({ intent: 'display' })]);
      const items = content.items.filter(item => typeof item.str === 'string' && item.str.trim()).map(item => ({
        text: item.str, x: item.transform[4], y: item.transform[5], width: item.width,
        height: item.height || Math.abs(item.transform[3]) || 10,
        bold: /bold|black|semibold/i.test(content.styles[item.fontName]?.fontFamily || '')
      }));
      const ordered = orderPageItems(items, page.view[2] - page.view[0], pageNumber, config);
      for (const line of ordered) {
        line.links = [];
        for (const annotation of annotations) {
          const raw = annotation.url || annotation.unsafeUrl;
          if (!raw) continue;
          const url = safeUrl(raw);
          if (!url) throw new Error(`Unsupported or malformed external URL in résumé page ${pageNumber}: ${raw}`);
          const [x0, y0, x1, y1] = annotation.rect || [];
          if (line.x <= x1 && line.x + line.width >= x0 && line.y <= y1 + 2 && line.y + line.height >= y0 - 2) {
            line.links.push({ label: line.text.replace(/^[●•○]\s*/, ''), url });
            annotationLinks.push({ label: line.text.replace(/^[●•○]\s*/, ''), url });
          }
        }
        lines.push(line);
      }
      page.cleanup();
    }
  } finally { await pdf.destroy(); }
  const text = lines.map(line => `${line.breakBefore ? '\n' : ''}${line.text}`).join('\n').trim();
  if (text.replace(/\s/g, '').length < (config.minimumTextCharacters || 80)) {
    throw new Error(`Résumé PDF has too little extractable text (${text.replace(/\s/g, '').length} characters). It may be scanned or image-only. OCR is required: export a searchable text PDF before rebuilding.`);
  }
  return { text, lines, links: deduplicateLinks(annotationLinks), sourceHash: createHash('sha256').update(bytes).digest('hex') };
}

export function deduplicateLinks(links) {
  const seen = new Set();
  return links.filter(link => { if (seen.has(link.url)) return false; seen.add(link.url); return true; });
}

export async function runExtraction(root = projectRoot) {
  const config = await loadResumeConfig(root);
  const extracted = await extractResume(resolve(root, config.resumeFile || 'resume.pdf'), config);
  const { normalizeResume, validateResume } = await import('./normalize-resume.mjs');
  const resume = normalizeResume(extracted, config);
  validateResume(resume);
  await mkdir(resolve(root, 'public/generated'), { recursive: true });
  await writeFile(resolve(root, 'public/generated/resume.json'), JSON.stringify(resume, null, 2) + '\n');
  console.log(`Extracted ${resume.name}: ${resume.sections.length} sections, ${resume.sections.reduce((sum, section) => sum + section.entries.length, 0)} entries, ${resume.links.length} professional links.`);
  return resume;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runExtraction().catch(error => { console.error(`Résumé extraction failed: ${error.message}`); process.exitCode = 1; });
}
