import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {extractLessonText} from './scripts/lesson-text.mjs';
import worker from './dist/server/index.js';

const origin = 'https://lejek.carvamo.com';
const accounts = 'http://carvamo-accounts-staging:8000';
const database = new DatabaseSync(process.env.LEJEK_DB ?? '/data/lejek.sqlite');
database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
for (const file of ['0000_lejek','0001_daily','0002_bieg','0003_sidebar','0004_enable_meme','0005_meme_assignments','0006_meme_feedback','0007_giphy','0008_review_plans','0009_daily_lessons','0010_dealer_groups','0011_meme_votes']) {
  database.exec(readFileSync('drizzle/'+file+'.sql','utf8').replaceAll('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
}
const GIPHY_API_KEY=process.env.GIPHY_API_KEY?.trim()||'';
const DB = {
  prepare(sql) {
    return {bind(...args) {
      const statement=database.prepare(sql);
      return {
        all:()=>({results:statement.all(...args)}),
        first:()=>statement.get(...args),
        run:()=>({meta:statement.run(...args)})
      };
    }};
  },
  async batch(statements) {
    database.exec('BEGIN IMMEDIATE');
    try {for(const statement of statements) statement.run(); database.exec('COMMIT');}
    catch(error) {database.exec('ROLLBACK'); throw error;}
  }
};
const cookie='__Host-lejek';
const cookieOptions='; Path=/; HttpOnly; Secure; SameSite=Strict';
const loginPage=`<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logowanie · Lejek</title><style>body{font:18px system-ui;background:#f5f4ef;color:#23392f}main{max-width:390px;margin:12vh auto;padding:22px}input,button{display:block;width:100%;box-sizing:border-box;font:inherit;padding:10px;margin:4px 0 16px}button{background:#284d3a;color:white;border:0;border-radius:8px}</style><main><h1>Zaloguj się do lejka</h1><form method="post" action="/login"><input type="hidden" name="csrf" value="LOGIN_CSRF"><label>E-mail <input name="email" type="email" autocomplete="username" maxlength="254" required></label><label>Hasło <input name="password" type="password" autocomplete="current-password" maxlength="512" required></label><button>Zaloguj się</button></form>ERROR</main></html>`;
const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
const reply = (text,status=200,extra={})=>new Response(text,{status,headers:{...headers,...extra}});
const redirect=(to,extra={})=>reply(null,303,{Location:to,...extra});
const loginCsrfCookie='__Host-lejek-login';
function loginForm(error='',status=200) {
  const csrf=randomBytes(32).toString('hex');
  const page=loginPage.replace('LOGIN_CSRF',csrf).replace('ERROR',error?'<p role="alert">'+error+'</p>':'');
  return reply(page,status,{
    'Content-Type':'text/html; charset=utf-8',
    'Set-Cookie':loginCsrfCookie+'='+csrf+cookieOptions+'; Max-Age=1800',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"
  });
}
async function handle(request) {
  const path=new URL(request.url).pathname;
  if (path==='/healthz' && request.method==='GET') {
    database.prepare('SELECT 1 FROM daily_results LIMIT 1').all();
    return reply('lejek-ok',200,{'X-Lejek-Release':process.env.LEJEK_RELEASE??'local','X-Lejek-Giphy':GIPHY_API_KEY?'configured':'missing'});
  }
  if (path==='/login') {
    if (request.method==='GET') return loginForm();
    if (request.method!=='POST') return reply('Niedozwolone żądanie',405,{Allow:'GET, POST'});
    const form=new URLSearchParams(await request.text());
    const csrf=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-lejek-login=([a-f0-9]{64})(?:;|$)/)?.[1];
    const source=request.headers.get('Origin');
    if (!csrf || csrf!==form.get('csrf') || (source && source!=='null' && source!==origin)) {
      return loginForm('Formularz wygasł. Zaloguj się ponownie.',403);
    }
    const email=form.get('email')??'', password=form.get('password')??'';
    if (!email||!password||email.length>254||password.length>512) return loginForm('Sprawdź e-mail i hasło.',401);
    const result=await fetch(accounts+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),signal:AbortSignal.timeout(8000)});
    if (result.status===429) return loginForm('Zbyt wiele prób. Spróbuj później.',429);
    if (result.status>=500) return reply('Logowanie chwilowo niedostępne',503);
    if (!result.ok) return loginForm('Sprawdź e-mail i hasło.',401);
    const {token}=await result.json();
    if (typeof token!=='string'||!/^[\w.-]+$/.test(token)) return reply('Logowanie chwilowo niedostępne',503);
    return redirect('/daily.html',{'Set-Cookie':cookie+'='+token+cookieOptions+'; Max-Age=28800'});
  }
  if(path==='/logout' && request.method==='POST' && request.headers.get('Origin')===origin) {
    return redirect('/login',{'Set-Cookie':cookie+'='+cookieOptions+'; Max-Age=0'});
  }
  const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-lejek=([\w.-]{1,4096})(?:;|$)/)?.[1];
  let account;
  if (token) {
    const result=await fetch(accounts+'/api/auth/me',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});
    if(result.status>=500) return reply('Logowanie chwilowo niedostępne',503);
    if(result.ok) account=(await result.json()).account;
  }
  if (!account?.email || !account?.id) {
    if(path.startsWith('/api/')) return Response.json({error:'Zaloguj się ponownie.'},{status:401,headers});
    return redirect('/login');
  }
  const forwarded=new Headers(request.headers);
  forwarded.set('oai-authenticated-user-email',account.email);
  forwarded.set('oai-authenticated-user-id',String(account.id));
  forwarded.set('x-lejek-verified-admin',account.role==='admin'?'1':'0');
  return worker.fetch(new Request(request,{headers:forwarded}),{DB,GIPHY_API_KEY,extractLessonText});
}
createServer(async (req,res)=>{
  try {
    const chunks=[];
    let bytes=0;
    const maxBytes=req.method==='POST'&&req.url==='/api/lesson-import'?21_000_000:65_536;
    for await(const chunk of req) {
      bytes+=chunk.length;
      if(bytes>maxBytes){res.writeHead(413);res.end();return;}
      chunks.push(chunk);
    }
    const request=new Request(origin+req.url,{method:req.method,headers:req.headers,
      body:chunks.length && !['GET','HEAD'].includes(req.method)?Buffer.concat(chunks):undefined});
    const response=await handle(request);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(503,headers);
    res.end('Usługa chwilowo niedostępna');
  }
}).listen(Number(process.env.PORT??8075),'0.0.0.0');
