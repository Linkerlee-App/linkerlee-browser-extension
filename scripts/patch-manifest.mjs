import { readFileSync, writeFileSync } from 'node:fs';

const path = 'dist/manifest.json';
const manifest = JSON.parse(readFileSync(path, 'utf8'));

const sw = manifest.background?.service_worker;
if (sw && !manifest.background.scripts) {
  manifest.background.scripts = [sw];
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`patched ${path}: added background.scripts fallback for Firefox`);
}
