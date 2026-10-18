import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export async function entrySize(directory) {
  const manifest = JSON.parse(await readFile(resolve(directory,'.vite/manifest.json'),'utf8'));
  const visited = new Set(), files = new Set();
  const visit = key => {
    if (visited.has(key)) return;
    visited.add(key);
    if (!manifest[key]) throw Error(`Unknown manifest import: ${key}`);
    files.add(manifest[key].file);
    for(const css of manifest[key].css || []) files.add(css);
    for(const dependency of manifest[key].imports || []) visit(dependency);
  };
  visit('index.html');
  const result = {js:0,gzip:0,css:0,files:[...files].sort()};
  for(const file of files) {
    const content=await readFile(resolve(directory,file));
    if(file.endsWith('.js')) {result.js+=content.length;result.gzip+=gzipSync(content).length;}
    if(file.endsWith('.css')) result.css+=content.length;
  }
  return result;
}
if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result=await entrySize(resolve(process.argv[2] || 'dist'));
  console.log(JSON.stringify(result));
  if(!process.argv.includes('--measure') && (result.js>700000 || result.gzip>210000 || result.css>160000))
    throw Error('Initial payload budget exceeded: JS 700 KB / gzip 210 KB / CSS 160 KB (all static imports included).');
}
