import { resolve } from "node:path";
import {
  extractResume,
  loadResumeConfig,
  projectRoot,
} from "../../scripts/extract-resume.mjs";
import {
  normalizeResume,
  validateResume,
} from "../../scripts/normalize-resume.mjs";

// Tests run before generated output exists, including a clean GitHub Actions checkout.
const config = await loadResumeConfig();
const source = await extractResume(
  resolve(projectRoot, config.resumeFile || "resume.pdf"),
  config,
);
const resume = normalizeResume(source, config);
validateResume(resume);
export function sourceResume() {
  return structuredClone(resume);
}
