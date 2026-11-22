import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const assets = Object.fromEntries(['zarzadzanie.html','quarter.js','panel-navigation.js','workbook-plan.js','work-calendar.js','reports.js','briefings.js','management.js','daily.html','daily.js','z-zycia-salonu.html','salon-life.js','account-header.js'].map(name =>
  ['/'+name, readFileSync('public/'+name,'utf8')]));
const mascot=readFileSync('public/fox-mascot.html','utf8').trim();
const accountHeader=readFileSync('public/account-header.html','utf8').replaceAll('<!-- FOX_MASCOT -->',mascot);
const panelPages=['/daily.html','/zarzadzanie.html','/z-zycia-salonu.html'];
for (const page of panelPages) assets[page]=assets[page].replace('<!-- ACCOUNT_HEADER -->',accountHeader).replaceAll('<!-- FOX_MASCOT -->',mascot);
for (const script of ['daily.js','management.js','panel-navigation.js','workbook-plan.js','work-calendar.js','reports.js','briefings.js','salon-life.js','account-header.js']) {
  const version=createHash('sha256').update(assets['/'+script]).digest('hex').slice(0,12);
  for (const page of panelPages) {
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
writeFileSync('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\nconst memes = '+JSON.stringify(memes)+';\n'+assets['/workbook-plan.js']+'\n'+assets['/work-calendar.js']+'\n'+readFileSync('worker/management-reports.js','utf8')+'\n'+readFileSync('worker/daily-briefings.js','utf8')+'\n'+readFileSync('worker/salon-life.js','utf8')+'\n'+readFileSync('worker/account-header.js','utf8')+'\n'+readFileSync('worker/index.js','utf8'));
