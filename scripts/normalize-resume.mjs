import { createHash } from 'node:crypto';
import { normalizeWhitespace, safeUrl, deduplicateLinks } from './extract-resume.mjs';

const bullet = /^[●•○▪‣*-]\s*/u;
const numbered = /^\d+[.)]\s+(?=\S)/;
const headingKey = text => normalizeWhitespace(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const slug = text => text.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 76) || 'entry';
const cleaned = text => normalizeWhitespace(text).replace(/20\s+(?=\d{2}\b)/g, '20');

function labelForUrl(url, text = '') {
  if (url.startsWith('mailto:')) return 'Email';
  if (url.startsWith('tel:')) return 'Phone';
  const parsed = new URL(url);
  if (/github\.com$/.test(parsed.hostname)) return `GitHub · ${parsed.pathname.split('/').filter(Boolean)[0] || 'Profile'}`;
  if (/instagram\.com$/.test(parsed.hostname)) return `Instagram · ${parsed.pathname.split('/').filter(Boolean)[0] || 'Profile'}`;
  if (/youtu\.be$|youtube\.com$/.test(parsed.hostname)) return 'Watch on YouTube';
  if (text && !/https?:\/\//i.test(text)) return text.replace(bullet, '').slice(0, 110);
  return parsed.hostname.replace(/^www\./, '');
}

function linksInLines(lines) {
  const links = lines.flatMap(line => line.links || []);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    // PDF annotations are authoritative for wrapped links; avoid truncated duplicates.
    if (line.links?.length) continue;
    for (const match of line.text.matchAll(/https?:\/\/[^\s<>]+/g)) {
      let raw = match[0].replace(/[),.;]+$/, '');
      // PDF generators occasionally wrap a URL without preserving its annotation.
      const next = lines[index + 1];
      if (next && !next.breakBefore && /^[\w?=&%+-]+$/.test(next.text) && !bullet.test(next.text)) raw += next.text;
      const url = safeUrl(raw);
      if (!url) throw new Error(`Malformed URL in résumé text: ${raw}`);
      links.push({ label: labelForUrl(url, line.text), url });
    }
  }
  return deduplicateLinks(links).map(link => ({ label: labelForUrl(link.url, link.label), url: link.url }));
}

function appendText(values, text, continuePrevious) {
  if (!text) return;
  if (continuePrevious && values.length) values[values.length - 1] += ` ${text}`;
  else values.push(text);
}

function dateLine(text) {
  const match = text.match(/^((?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)?\d{2}|Present)|\s+[A-Za-z]+(?:[-–—][A-Za-z]+)?)?)\s*(?:[|:]\s*(.*))?$/i);
  return match ? { dates: match[1], subtitle: match[2] || '' } : null;
}

function parseEntry(lines, sectionId, usedIds) {
  let title = ''; let subtitle = ''; let dates = ''; const details = []; let inDetails = false;
  let previousWasBullet = false;
  for (const line of lines) {
    const raw = cleaned(line.text);
    const isBullet = bullet.test(raw);
    const text = raw.replace(numbered, '').replace(bullet, '').trim();
    const date = !isBullet && dateLine(text);
    if (date) {
      dates = [dates, date.dates].filter(Boolean).join(' · ');
      subtitle = [subtitle, date.subtitle].filter(Boolean).join(' · ');
      previousWasBullet = false; continue;
    }
    if (!title) { title = text; previousWasBullet = false; continue; }
    if (isBullet) {
      inDetails = true; appendText(details, text, false); previousWasBullet = true;
    } else if (!inDetails && !line.breakBefore && !/^See more\b/i.test(text)) {
      title += ` ${text}`; previousWasBullet = false;
    } else {
      inDetails = true; appendText(details, text, !line.breakBefore || previousWasBullet); previousWasBullet = false;
    }
  }
  if (!title && details.length) title = details.shift();
  // Keep actual inline qualification dates separate for readable education cards.
  if (!dates) {
    const inlineDate = title.match(/\s+[—–-]\s*((?:19|20)\d{2}(?:\s*[-–—]\s*(?:\d{2,4}|Present))?)\s*$/i);
    if (inlineDate) { dates = inlineDate[1]; title = title.slice(0, inlineDate.index); }
  }
  const base = `${sectionId}-${slug(title)}`; let id = base; let suffix = 2;
  while (usedIds.has(id)) id = `${base}-${suffix++}`;
  usedIds.add(id);
  const links = linksInLines(lines);
  const cleanDetails = details.map(cleaned).map(detail => {
    const sourceLink = links.find(link => detail.replace(/\s/g, '') === link.url);
    return sourceLink?.url || detail;
  });
  return { id, title: title.trim(), subtitle: subtitle.trim(), dates: dates.trim(), details: cleanDetails, links };
}

function partitionEntries(lines, section) {
  if (section.type === 'profile') return [lines];
  const hasNumbered = lines.some(line => numbered.test(line.text));
  const blocks = []; let current = []; let hasDetails = false;
  const listSection = ['skills', 'languages', 'activities', 'awards', 'certifications', 'other'].includes(section.type);
  for (const line of lines) {
    const raw = cleaned(line.text);
    const isBullet = bullet.test(raw);
    const topLevelBullet = /^[●•▪‣*-]\s*/u.test(raw);
    const startsNumbered = numbered.test(raw);
    const specialLink = /^See more\b/i.test(raw) || /^\(Philosophy\)/i.test(raw);
    let startsNew = startsNumbered || specialLink;
    if (!hasNumbered && listSection && topLevelBullet) startsNew = true;
    if (!hasNumbered && !listSection && !isBullet && !dateLine(raw) && line.breakBefore && current.length && hasDetails) startsNew = true;
    // Education entries without accomplishments still start after a visible paragraph gap.
    if (section.type === 'education' && !hasNumbered && !isBullet && !dateLine(raw) && line.breakBefore && current.length) startsNew = true;
    if (startsNew && current.length) { blocks.push(current); current = []; hasDetails = false; }
    current.push(line);
    if (isBullet) hasDetails = true;
  }
  if (current.length) blocks.push(current);
  return blocks;
}

export function normalizeResume(extraction, config) {
  if (!extraction || typeof extraction.text !== 'string' || !extraction.text.trim()) throw new Error('Résumé content is empty. A searchable, text-based PDF is required.');
  if (!Array.isArray(config?.sectionAliases) || !config.sectionAliases.length) throw new Error('No section aliases configured in config/resume.config.json.');
  const lines = (extraction.lines || extraction.text.split(/\r?\n/).map(text => ({ text, links: [], breakBefore: !text.trim() })))
    .filter(line => line.text?.trim()).map(line => ({ ...line, text: cleaned(line.text), links: line.links || [] }));
  const aliases = new Map();
  for (const section of config.sectionAliases) {
    if (!section.id || !section.type || !Array.isArray(section.aliases)) throw new Error('Each configured section requires id, type, label and aliases.');
    for (const alias of section.aliases) aliases.set(headingKey(alias), section);
  }
  const header = []; const rawSections = []; let current = null;
  for (const line of lines) {
    const section = aliases.get(headingKey(line.text));
    if (section) {
      const existing = rawSections.find(item => item.id === section.id);
      current = existing || { ...section, sourceHeading: line.text, lines: [] };
      if (!existing) rawSections.push(current);
    } else if (current) current.lines.push(line);
    else header.push(line);
  }
  if (!rawSections.length) throw new Error('No résumé sections were recognized. Add the PDF’s heading spellings to sectionAliases in config/resume.config.json; content was not published.');
  const nameLine = header.find(line => /^[\p{L}][\p{L}\p{M} .'-]{2,100}$/u.test(line.text) && line.text.split(' ').length <= 8);
  if (!nameLine) throw new Error('Could not identify a name before the first résumé section. Put a plain-text name at the top of the PDF.');
  const name = nameLine.text;
  const allText = lines.map(line => line.text).join('\n');
  const email = allText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const contactLines = [...header, ...rawSections.filter(section => section.type === 'contact').flatMap(section => section.lines)];
  const contactText = contactLines.map(line => line.text).join('\n');
  const phone = contactText.match(/(?:\+\d{1,3}[ -]?)?(?:\(?\d{2,5}\)?[ -]?){2,4}\d{3,5}(?!\w)/)?.[0]?.trim() || '';
  const locationLine = contactLines.find(line => line.text !== name && /,/.test(line.text) && !/@|https?:|\d{5,}/.test(line.text));
  const location = locationLine?.text.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim() || '';
  const headerTitle = header.find(line => line !== nameLine && line.text !== locationLine?.text && !/@|https?:|\d{5,}|[\p{Extended_Pictographic}]/u.test(line.text));
  let title = headerTitle?.text || 'Resume portfolio';
  if (!headerTitle && /Computer Science[\s\S]{0,80}Mathematics/i.test(allText) && /creation|performer|poetry/i.test(allText)) title = 'Computer Science · Mathematics · Creative Practice';
  const usedIds = new Set();
  const sections = rawSections.filter(section => section.lines.length).map(section => ({
    id: section.id, type: section.type, label: section.label || section.sourceHeading,
    entries: partitionEntries(section.lines, section).map(block => {
      const entry = parseEntry(block, section.id, usedIds);
      if (section.type === 'skills' && entry.title.includes(':')) {
        const index = entry.title.indexOf(':');
        entry.details.unshift(entry.title.slice(index + 1).trim());
        entry.title = entry.title.slice(0, index).trim();
        usedIds.delete(entry.id);
        const base = `${section.id}-${slug(entry.title)}`; let id = base; let suffix = 2;
        while (usedIds.has(id)) id = `${base}-${suffix++}`;
        usedIds.add(id); entry.id = id;
      }
      return entry;
    }).filter(entry => entry.title || entry.details.length)
  }));
  const summarySection = sections.find(section => section.type === 'profile');
  const summary = summarySection?.entries.map(entry => [entry.title, ...entry.details].join(' ')).join(' ') || '';
  if (summarySection) summarySection.entries = [{ id: 'profile-overview', title: name, subtitle: '', dates: '', details: [summary], links: summarySection.entries.flatMap(entry => entry.links) }];
  const professionalLinks = linksInLines(lines);
  for (const link of extraction.links || []) {
    const url = safeUrl(link.url);
    if (!url) throw new Error(`Unsupported or malformed résumé link: ${link.url}`);
    professionalLinks.push({ label: labelForUrl(url, link.label), url });
  }
  if (email) professionalLinks.push({ label: 'Email', url: `mailto:${email}` });
  // Identity and contact information are real source content and deserve a location even
  // when the PDF uses a header instead of an explicit Contact section.
  if (!sections.some(section => section.type === 'contact') && (email || phone || location || professionalLinks.length)) {
    sections.push({ id: 'contact', type: 'contact', label: 'Contact & Links', entries: [{
      id: 'contact-details', title: name, subtitle: location, dates: '',
      details: [email, phone].filter(Boolean), links: deduplicateLinks(professionalLinks)
    }] });
  }
  const result = {
    schemaVersion: 1, sourceHash: extraction.sourceHash || createHash('sha256').update(extraction.text).digest('hex'),
    name, title, summary, contact: { email, phone, location }, links: deduplicateLinks(professionalLinks), sections,
    sourceText: extraction.text
  };
  validateResume(result);
  return result;
}

export function validateResume(resume) {
  if (resume?.schemaVersion !== 1) throw new Error('Unsupported résumé schemaVersion; expected 1.');
  for (const field of ['name', 'sourceHash', 'sourceText']) if (typeof resume[field] !== 'string' || !resume[field].trim()) throw new Error(`Résumé requires a nonempty ${field}.`);
  for (const field of ['title', 'summary']) if (typeof resume[field] !== 'string') throw new Error(`Résumé ${field} must be a text string.`);
  if (!resume.contact || ['email', 'phone', 'location'].some(field => typeof resume.contact[field] !== 'string')) throw new Error('Résumé contact fields must be text strings.');
  if (!Array.isArray(resume.links)) throw new Error('Résumé professional links must be an array.');
  if (!Array.isArray(resume.sections) || !resume.sections.length) throw new Error('Résumé has no meaningful sections.');
  const ids = new Set();
  for (const section of resume.sections) {
    if (!section.id || ids.has(section.id)) throw new Error(`Missing or duplicate résumé section identifier: ${section.id}`);
    ids.add(section.id);
    if (!section.type || !section.label || !Array.isArray(section.entries) || !section.entries.length) throw new Error(`Résumé section ${section.id} has no meaningful entries or metadata.`);
    for (const entry of section.entries) {
      if (!entry.id || ids.has(entry.id)) throw new Error(`Missing or duplicate résumé record identifier: ${entry.id}`);
      ids.add(entry.id);
      if (typeof entry.title !== 'string' || !entry.title.trim() || typeof entry.subtitle !== 'string' || typeof entry.dates !== 'string' || !Array.isArray(entry.details) || entry.details.some(detail => typeof detail !== 'string') || !Array.isArray(entry.links)) throw new Error(`Malformed résumé record in ${section.id}.`);
      for (const link of entry.links) if (typeof link.label !== 'string' || !safeUrl(link.url)) throw new Error(`Malformed external URL in ${entry.id}: ${link.url}`);
    }
  }
  for (const link of resume.links) if (typeof link.label !== 'string' || !safeUrl(link.url)) throw new Error(`Malformed professional URL: ${link.url}`);
  return true;
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

export function renderStaticPortfolio(resume) {
  validateResume(resume);
  const h = escapeHtml;
  const links = values => values.map(link => `<a href="${h(link.url)}"${/^https?:/.test(link.url) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${h(link.label)}</a>`).join(' · ');
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${h(resume.name)} — résumé and portfolio"><title>${h(resume.name)} — Portfolio</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#111c21;color:#eee8cf;font:17px/1.65 system-ui,sans-serif}main{max-width:880px;margin:auto;padding:48px 24px}h1,h2,h3{line-height:1.25}h1{font-size:2rem}h2{margin-top:3rem;color:#f6cf75}h3{margin-bottom:8px}a{color:#a8dbce;text-underline-offset:4px}a:focus-visible{outline:3px solid #f6cf75;outline-offset:4px}nav{display:flex;flex-wrap:wrap;gap:12px 20px}article{padding:12px 0 20px;border-bottom:1px solid #42504e}.muted{color:#b8c4b8}.actions{margin:24px 0}li{margin-bottom:5px}@media print{body{background:white;color:black}a,h2{color:#222}main{padding:0}.actions{display:none}}
</style></head><body><main><header><p class="muted">THE FIELD JOURNAL</p><h1>${h(resume.name)}</h1><p>${h(resume.title)}</p>${resume.summary ? `<p>${h(resume.summary)}</p>` : ''}<p class="muted">${h([resume.contact.location, resume.contact.email, resume.contact.phone].filter(Boolean).join(' · '))}</p><p>${links(resume.links)}</p><p class="actions"><a href="./">Enter the world</a> · <a href="resume.pdf" download>Download original résumé PDF</a></p></header><nav aria-label="Portfolio sections">${resume.sections.map(section => `<a href="#${h(section.id)}">${h(section.label)}</a>`).join('')}</nav>${resume.sections.map(section => `<section id="${h(section.id)}"><h2>${h(section.label)}</h2>${section.entries.map(entry => `<article><h3>${h(entry.title)}</h3>${entry.subtitle || entry.dates ? `<p class="muted">${h([entry.subtitle, entry.dates].filter(Boolean).join(' · '))}</p>` : ''}${entry.details.length ? `<ul>${entry.details.map(detail => `<li>${h(detail)}</li>`).join('')}</ul>` : ''}${entry.links.length ? `<p>${links(entry.links)}</p>` : ''}</article>`).join('')}</section>`).join('')}<footer><p class="muted">Generated from the original résumé PDF. This page works without JavaScript.</p></footer></main></body></html>\n`;
}
