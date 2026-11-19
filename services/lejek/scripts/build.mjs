import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const assets = Object.fromEntries(['zarzadzanie.html','quarter.js','workbook-plan.js','management.js','daily.html','daily.js'].map(name =>
  ['/'+name, readFileSync('public/'+name,'utf8')]));
const dailyVersion=createHash('sha256').update(assets['/daily.js']).digest('hex').slice(0,12);
assets['/daily.html']=assets['/daily.html'].replace('src="daily.js"','src="daily.js?v='+dailyVersion+'"');
const memes = JSON.parse(readFileSync('worker/memes.json','utf8'));
const scenes = JSON.parse(readFileSync('worker/meme-scenes.json','utf8'));
for (const [icon,titles,captions] of scenes) {
  for (const title of titles) {
    for (const caption of captions) memes.push([title,icon,caption,'scene:'+title+'|'+caption]);
  }
}
if (memes.length!==1000 || new Set(memes.map(([title,,,key])=>key??title)).size!==1000) {
  throw new Error('Expected 1000 distinct meme entries.');
}
mkdirSync('dist/server', {recursive:true});
mkdirSync('dist/.openai', {recursive:true});
writeFileSync('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\nconst memes = '+JSON.stringify(memes)+';\n'+readFileSync('worker/index.js','utf8'));
