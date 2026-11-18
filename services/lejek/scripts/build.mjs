import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
const assets = Object.fromEntries(['index.html','quarter.js','workbook-plan.js','app.js','daily.html','daily.js'].map(name =>
  ['/'+name, readFileSync('public/'+name,'utf8')]));
const memes = JSON.parse(readFileSync('worker/memes.json','utf8'));
mkdirSync('dist/server', {recursive:true});
mkdirSync('dist/.openai', {recursive:true});
writeFileSync('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\nconst memes = '+JSON.stringify(memes)+';\n'+readFileSync('worker/index.js','utf8'));
