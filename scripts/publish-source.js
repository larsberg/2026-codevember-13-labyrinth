import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { validateManifest } from './manifest.js';

const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const manifest = validateManifest(JSON.parse(fs.readFileSync('public/sketch.json')));
if (git(['remote', 'get-url', 'origin']).replace(/\.git$/, '') !== manifest.repository) throw Error('Origin differs from sketch metadata.');
if (git(['branch', '--show-current']) !== 'main') throw Error('Switch to main before publishing source.');
if (git(['status', '--porcelain'])) throw Error('Commit the source changes before publishing.');
if (process.argv.includes('--dry-run')) {
  console.log(`Ready to push main to ${manifest.repository}; existing Git history is preserved.`);
} else {
  execFileSync('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
}
