import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot, loadResumeConfig, extractResume } from './extract-resume.mjs';
import { normalizeResume, validateResume, renderStaticPortfolio } from './normalize-resume.mjs';
import { generateWorld } from '../src/core/world.mjs';
import { generateInterior } from '../src/core/interior.mjs';
import { villageScene } from '../src/core/village.mjs';

export async function buildData(root = projectRoot) {
  const config = await loadResumeConfig(root);
  const source = resolve(root, config.resumeFile || 'resume.pdf');
  const extraction = await extractResume(source, config);
  const resume = normalizeResume(extraction, config);
  validateResume(resume);
  const world = generateWorld(resume);
  // Fail the build if this résumé cannot produce playable default scenes.
  villageScene(world);
  for (const location of world.locations) generateInterior(resume, location);
  const generated = resolve(root, 'public/generated');
  await mkdir(generated, { recursive: true });
  await writeFile(resolve(generated, 'resume.json'), JSON.stringify(resume, null, 2) + '\n');
  await writeFile(resolve(generated, 'world.json'), JSON.stringify(world, null, 2) + '\n');
  await copyFile(source, resolve(root, 'public/resume.pdf'));
  await writeFile(resolve(root, 'public/portfolio.html'), renderStaticPortfolio(resume));
  console.log(`Built résumé data for ${resume.name}: ${resume.sections.length} locations from ${resume.sections.reduce((sum, section) => sum + section.entries.length, 0)} records.`);
  return { resume, world };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildData().catch(error => { console.error(`Portfolio generation failed: ${error.message}`); process.exitCode = 1; });
}
