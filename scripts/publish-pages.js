import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {checkRelease} from './check-release.js';

const root=process.cwd(),dist=path.join(root,'dist');
const manifest=checkRelease(root);
const origin=execFileSync('git',['remote','get-url','origin'],{encoding:'utf8'}).trim();
if(origin.replace(/\.git$/,'')!==manifest.repository)throw new Error('Origin differs from sketch metadata.');
// Preserve this checkout's GitHub credential helper in the temporary publisher.
let helpers=[];
try { helpers=execFileSync('git',['config','--get-all','credential.https://github.com.helper'],{encoding:'utf8'}).trimEnd().split('\n'); } catch (error) { if(error.status!==1)throw error; }
const credentials=helpers.flatMap(value=>['-c',`credential.https://github.com.helper=${value}`]);
const git=(args,cwd=root)=>execFileSync('git',[...credentials,...args],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
if(process.argv.includes('--dry-run')) {
  console.log(`Ready to publish dist/ to ${manifest.repository} (gh-pages). No upload performed.`);
  process.exit(0);
}
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sketch-pages-'));
try {
  const exists=git(['ls-remote','--heads',origin,'gh-pages']);
  if(exists)git(['clone','--depth','1','--branch','gh-pages',origin,directory]);
  else {git(['init','-b','gh-pages',directory]);git(['remote','add','origin',origin],directory);}
  for(const name of fs.readdirSync(directory))if(name!=='.git')fs.rmSync(path.join(directory,name),{recursive:true,force:true});
  fs.cpSync(dist,directory,{recursive:true});
  git(['config','user.name',git(['config','user.name'])],directory);
  git(['config','user.email',git(['config','user.email'])],directory);
  git(['add','-A'],directory);
  if(git(['status','--porcelain'],directory)) {
    git(['commit','-m',`Publish ${manifest.title}`],directory);
    git(['push','origin','gh-pages'],directory);
  }
  console.log(`Published build: ${git(['rev-parse','HEAD'],directory)}`);
} finally {fs.rmSync(directory,{recursive:true,force:true});}
