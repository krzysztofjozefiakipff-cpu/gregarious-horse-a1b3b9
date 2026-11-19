import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const assets = Object.fromEntries(['zarzadzanie.html','quarter.js','panel-navigation.js','workbook-plan.js','management.js','daily.html','daily.js'].map(name =>
  ['/'+name, readFileSync('public/'+name,'utf8')]));
for (const script of ['daily.js','management.js','panel-navigation.js','workbook-plan.js']) {
  const version=createHash('sha256').update(assets['/'+script]).digest('hex').slice(0,12);
  for (const page of ['/daily.html','/zarzadzanie.html']) {
    assets[page]=assets[page].replace('src="'+script+'"','src="'+script+'?v='+version+'"');
  }
}
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
writeFileSync('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\nconst memes = '+JSON.stringify(memes)+';\n'+assets['/workbook-plan.js']+'\n'+readFileSync('worker/index.js','utf8'));
