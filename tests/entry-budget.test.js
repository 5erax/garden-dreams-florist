import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { entrySize } from '../scripts/check-entry-budget.mjs';
test('entry budget counts shared static dependencies once and excludes deferred chunks',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'garden-entry-'));
  try {
    await mkdir(join(directory,'.vite'));
    await writeFile(join(directory,'.vite/manifest.json'),JSON.stringify({'index.html':{file:'entry.js',imports:['shared'],dynamicImports:['checkout']},shared:{file:'shared.js',css:['style.css']},checkout:{file:'checkout.js'}}));
    for(const [name,text] of [['entry.js','entry'],['shared.js','shared'],['checkout.js','deferred'],['style.css','body{}']])await writeFile(join(directory,name),text);
    const result=await entrySize(directory);
    assert.equal(result.js,11);assert.equal(result.css,6);assert.ok(result.gzip>0);
    assert.deepEqual(result.files,['entry.js','shared.js','style.css']);
  } finally { assert.equal(dirname(resolve(directory)),resolve(tmpdir())); await rm(directory,{recursive:true,force:true}); }
});

test('Vercel includes every build script excluded by the scripts wildcard',async()=>{
  const ignored=await readFile(new URL('../.vercelignore',import.meta.url),'utf8');
  const {scripts}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  for(const [,script] of scripts.build.matchAll(/node (scripts\/[\w.-]+)/g))assert.ok(ignored.split(/\r?\n/).includes('!'+script),`${script} must be uploaded`);
});
