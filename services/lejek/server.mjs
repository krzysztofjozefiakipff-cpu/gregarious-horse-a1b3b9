import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {extractLessonText} from './scripts/lesson-text.mjs';
import {localIdentity, sharedAdmin} from './identity.mjs';
import worker from './dist/server/index.js';

const previewOrigin = 'https://lejek.carvamo.com';
const allowedHosts = new Set(['lejek.carvamo.com', 'biegwyzej.pl', 'www.biegwyzej.pl']);
const accounts = 'http://carvamo-accounts-staging:8000';
const database = new DatabaseSync(process.env.LEJEK_DB ?? '/data/lejek.sqlite');
database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
for (const file of ['0000_lejek','0001_daily','0002_bieg','0003_sidebar','0004_enable_meme','0005_meme_assignments','0006_meme_feedback','0007_giphy','0008_review_plans','0009_daily_lessons','0010_dealer_groups','0011_meme_votes','0012_manager_salons','0013_account_roles','0014_archived_users','0015_identity','0016_report_exclusions','0017_salon_plans','0018_plan_approvals','0019_source_plans','0020_password_resets','0021_daily_drafts','0022_lesson_packs','0023_work_calendar','0024_seller_source_profiles','0025_archive_report_periods','0026_direct_salon_plans','0027_salon_plan_change_requests','0029_user_contact_details']) {
  database.exec(readFileSync('drizzle/'+file+'.sql','utf8').replaceAll('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
}
if (!database.prepare("SELECT sql FROM sqlite_schema WHERE name='work_calendar'").get().sql.includes("'sick'")) {
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec(readFileSync('drizzle/0028_work_calendar_absence_kinds.sql','utf8'));
    database.exec('COMMIT');
  } catch(error) { database.exec('ROLLBACK'); throw error; }
}
// Legacy archives recorded only the email. Use the rollout month for those accounts.
const archiveCutoff=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit'}).format(new Date());
database.prepare(`INSERT INTO archive_report_periods (email,from_month)
  SELECT email,? FROM archived_users a WHERE NOT EXISTS (
    SELECT 1 FROM archive_report_periods p WHERE p.email=a.email AND p.until_month IS NULL
  ) ON CONFLICT(email,from_month) DO UPDATE SET until_month=NULL`).run(archiveCutoff);
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
    try {
      const results=statements.map(statement=>statement.run());
      database.exec('COMMIT');
      return results;
    }
    catch(error) {database.exec('ROLLBACK'); throw error;}
  }
};
const identity=localIdentity(database,DB);
const cookie='__Host-lejek';
const cookieOptions='; Path=/; HttpOnly; Secure; SameSite=Strict';
const publicPages = new Map([
  ['/', ['text/html', readFileSync('public/home.html', 'utf8')]],
  ['/home.css', ['text/css', readFileSync('public/home.css', 'utf8')]],
  ['/showroom-jaecoo-8.webp', ['image/webp', readFileSync('public/showroom-jaecoo-8.webp')]],
  ['/theme.css', ['text/css', readFileSync('public/theme.css', 'utf8')]]
]);
const loginPage = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b1522">
  <title>AUTH_TITLE</title>
  <link rel="stylesheet" href="/theme.css">
  <style>
    body { min-height: 100dvh; display: flow-root; background: linear-gradient(160deg, #0b1522 0%, #142f54 70%, #1a4376 100%); }
    .login { width: min(100%, 480px); margin: clamp(24px, 10vh, 96px) auto; padding: 0 16px; }
    .login-card { background: white; border: 1px solid var(--line); border-radius: 14px; padding: clamp(20px, 6vw, 36px); box-shadow: 0 20px 55px #0004; }
    .product-brand { font-weight: 750; font-size: 1.125rem; }
    h1 { margin: 20px 0 24px; font-size: clamp(1.65rem, 6vw, 2.25rem); }
    form, label { display: grid; gap: 6px; }
    form { gap: 16px; }
    label { font-weight: 700; }
    input, button { min-width: 0; min-height: 48px; border-radius: 8px; padding: 10px 12px; font: inherit; }
    input { background: white; border: 1px solid var(--muted); color: var(--ink); }
    button { background: var(--blue); color: white; border: 0; font-weight: 750; cursor: pointer; }
    button:hover { background: var(--accent-ink); }
    [role="alert"] { color: var(--error); margin: 0; }
  </style>
</head>
<body>
  <main class="login">
    <section class="login-card" aria-labelledby="login-heading">
      <a class="product-brand" style="text-decoration:none" href="/"><span class="product-mark" aria-hidden="true"></span>Bieg Wyżej</a>
      <h1 id="login-heading">AUTH_TITLE</h1>
      <form method="post" action="AUTH_ACTION">
        <input type="hidden" name="csrf" value="LOGIN_CSRF">
        AUTH_FIELDS
        LOGIN_ERROR
        <button>AUTH_BUTTON</button>
      </form>
      <p>AUTH_LINKS</p>
    </section>
  </main>
</body>
</html>`;
const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
const reply = (text,status=200,extra={})=>new Response(text,{status,headers:{...headers,...extra}});
const redirect=(to,extra={})=>reply(null,303,{Location:to,...extra});
const loginCsrfCookie='__Host-lejek-login';
const emailField='<label>E-mail<input name="email" type="email" autocomplete="username" maxlength="254" required></label>';
const currentField='<label>Obecne hasło<input name="password" type="password" autocomplete="current-password" maxlength="512" required></label>';
const newFields='<label>Nowe hasło (min. 8 znaków)<input name="new_password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>'+
  '<label>Powtórz nowe hasło<input name="confirm_password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>';
const forms={
  '/login':['Zaloguj się do Bieg Wyżej','Zaloguj się',emailField+currentField.replace('Obecne hasło','Hasło')],
  '/change-password':['Zmień hasło','Zapisz nowe hasło',emailField+currentField+newFields],
  '/forgot-password':['Nie pamiętam hasła','Wyślij link do resetu',emailField],
  '/reset-password':['Ustaw nowe hasło','Zapisz nowe hasło',newFields]
};
const localResetToken=/^[a-f0-9]{64}$/;
const sharedResetToken=/^shared-[\w.-]{1,1024}$/;
const validResetToken=token=>localResetToken.test(token)||sharedResetToken.test(token);
const smtpReady=Boolean(process.env.RESET_SMTP_HOST&&process.env.RESET_SMTP_USER&&process.env.RESET_SMTP_PASSWORD);
const inviteReady=Boolean(process.env.INVITE_SMTP_PASSWORD);
let activeMailJobs=0;

function loginForm(message='',status=200,path='/login',token='') {
  const csrf=randomBytes(32).toString('hex');
  const [title,button,fields]=forms[path];
  const link=path==='/login'
    ?'<a href="/change-password">Zmień hasło</a> · <a href="/forgot-password">Nie pamiętam hasła</a>'
    :'<a href="/login">Wróć do logowania</a>';
  const hidden=validResetToken(token)?'<input type="hidden" name="token" value="'+token+'">':'';
  const page=loginPage.replaceAll('AUTH_TITLE',title).replace('AUTH_ACTION',path).replace('AUTH_FIELDS',fields+hidden)
    .replace('AUTH_BUTTON',button).replace('AUTH_LINKS',link).replace('LOGIN_CSRF',csrf)
    .replace('LOGIN_ERROR',message?'<p role="'+(status>=400?'alert':'status')+'">'+message+'</p>':'');
  return reply(page,status,{
    'Content-Type':'text/html; charset=utf-8',
    'Set-Cookie':loginCsrfCookie+'='+csrf+cookieOptions+'; Max-Age=1800',
    'Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"
  });
}
function sendReset(email,token) {
  if (!smtpReady||activeMailJobs>=4) return;
  const mail=spawn('python3',['scripts/reset-mail.py'],{stdio:['pipe','ignore','ignore'],timeout:15000});
  activeMailJobs++;
  mail.stdin.on('error',()=>{});
  mail.on('error',()=>{console.error('Bieg Wyżej password reset delivery failed');});
  mail.on('close',code=>{
    activeMailJobs--;
    if (code!==0) console.error('Bieg Wyżej password reset delivery failed');
  });
  mail.stdin.end(JSON.stringify([email,'https://biegwyzej.pl/reset-password?token='+token]));
}
async function sendInvitation(email,inviter,roles) {
  if (!inviteReady||activeMailJobs>=4) return false;
  const token=identity.issueReset(email,24*60*60_000);
  if (!token) return false;
  const delivered=await new Promise(resolve=>{
    const mail=spawn('python3',['scripts/reset-mail.py','--invite'],{stdio:['pipe','ignore','inherit'],timeout:15000});
    activeMailJobs++;
    mail.stdin.on('error',()=>{});
    mail.on('error',()=>resolve(false));
    mail.on('close',code=>{activeMailJobs--;resolve(code===0);});
    mail.stdin.end(JSON.stringify([email,'https://biegwyzej.pl/reset-password?token='+token,inviter,roles]));
  });
  if (!delivered) identity.discardReset(token);
  return delivered;
}
async function accountsPost(path,body,token) {
  const headers={'Content-Type':'application/json'};
  if (token) headers.Authorization='Bearer '+token;
  return fetch(accounts+path,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
}
async function adminAccount(token) {
  const response=await fetch(accounts+'/api/auth/me',{
    headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)
  });
  if (response.status>=500) throw new Error('Shared administrator authentication unavailable');
  if (!response.ok) return null;
  const {account}=await response.json();
  return account?.email===sharedAdmin&&account?.role==='admin'?account:null;
}
async function handle(request) {
  const {pathname:path,origin}=new URL(request.url);
  if (path==='/healthz' && request.method==='GET') {
    database.prepare('SELECT 1 FROM daily_results LIMIT 1').all();
    return reply('lejek-ok',200,{'X-Lejek-Release':process.env.LEJEK_RELEASE??'local','X-Lejek-Giphy':GIPHY_API_KEY?'configured':'missing','X-Lejek-Reset-Mail':smtpReady?'configured':'missing','X-Lejek-Invite-Mail':inviteReady?'configured':'missing'});
  }
  const publicPage = publicPages.get(path);
  if (publicPage && (request.method === 'GET' || request.method === 'HEAD')) {
    const [type, body] = publicPage;
    const response = reply(request.method === 'HEAD' ? null : body, 200, {
      'Content-Type': type.startsWith('text/') ? type + '; charset=utf-8' : type
    });
    if (path === '/' && new URL(request.url).hostname === 'biegwyzej.pl') {
      response.headers.delete('X-Robots-Tag');
    }
    return response;
  }
  if (Object.hasOwn(forms,path)) {
    const render=(message='',status=200,token='')=>loginForm(message,status,path,token);
    if (request.method==='GET') {
      const params=new URL(request.url).searchParams;
      if (path==='/login'&&params.get('password')==='changed') return render('Hasło zostało zapisane. Zaloguj się ponownie.');
      if (path==='/reset-password') {
        const token=params.get('token')??'';
        return validResetToken(token)?render('',200,token):render('Link do resetu jest nieprawidłowy.',400);
      }
      return render();
    }
    if (request.method!=='POST') return reply('Niedozwolone żądanie',405,{Allow:'GET, POST'});
    const form=new URLSearchParams(await request.text());
    const csrf=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-lejek-login=([a-f0-9]{64})(?:;|$)/)?.[1];
    const source=request.headers.get('Origin');
    const token=form.get('token')??'';
    // Browsers can send Origin: null for form posts under Referrer-Policy: no-referrer.
    // Those posts still need the form token and the matching host-only cookie.
    if (!csrf||csrf!==form.get('csrf')||(source&&source!=='null'&&source!==origin)) return render('Formularz wygasł. Spróbuj ponownie.',403,token);
    const email=(form.get('email')??'').trim().toLowerCase();
    const password=form.get('password')??'';
    const newPassword=form.get('new_password')??'';
    const validEmail=email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const changed=()=>redirect('/login?password=changed',{'Set-Cookie':cookie+'='+cookieOptions+'; Max-Age=0'});
    if (path==='/change-password'||path==='/reset-password') {
      if ([...newPassword].length<8||newPassword.length>128) return render('Nowe hasło musi mieć od 8 do 128 znaków.',400,token);
      if (newPassword!==form.get('confirm_password')) return render('Wpisane nowe hasła różnią się.',400,token);
    }
    if (path==='/reset-password') {
      if (validResetToken(token)&&!identity.allowAttempt('reset:'+token)) return render('Zbyt wiele prób. Spróbuj później.',429,token);
      if (sharedResetToken.test(token)) {
        const result=await accountsPost('/api/auth/password-reset/confirm',{
          token:token.slice(7),password:newPassword,bieg_wyzej:true
        });
        if (result.ok) return changed();
        if (result.status>=500) return render('Reset hasła administratora jest chwilowo niedostępny.',503,token);
        return render('Link do resetu jest nieprawidłowy, wygasł lub został już użyty.',400);
      }
      if (!localResetToken.test(token)||!await identity.resetPassword(token,newPassword))
        return render('Link do resetu jest nieprawidłowy, wygasł lub został już użyty.',400,token);
      return changed();
    }
    if (!validEmail) return render('Sprawdź adres e-mail.',400);
    if (path==='/forgot-password') {
      if (email===sharedAdmin) {
        const result=await accountsPost('/api/auth/password-reset/request',{email,bieg_wyzej:true});
        if (!result.ok) return render('Reset przez e-mail jest chwilowo niedostępny.',503);
      } else {
        if (!smtpReady) return render('Reset przez e-mail jest chwilowo niedostępny.',503);
        if (activeMailJobs<4&&identity.allowAttempt('forgot:'+email)) {
          const reset=identity.issueReset(email);
          if (reset) sendReset(email,reset);
        }
      }
      return render('Jeśli konto jest aktywne, otrzymasz e-mail z linkiem do ustawienia nowego hasła.',202);
    }
    if (!password||password.length>512) return render('Sprawdź e-mail i hasło.',401);
    if (!identity.allowAttempt(email)) return render('Zbyt wiele prób. Spróbuj później.',429);
    if (email!==sharedAdmin) {
      if (path==='/change-password') {
        return await identity.changePassword(email,password,newPassword)
          ?changed():render('Sprawdź e-mail i obecne hasło.',401);
      }
      const session=await identity.authenticate(email,password);
      if (!session) return render('Sprawdź e-mail i hasło.',401);
      return redirect('/daily.html',{'Set-Cookie':cookie+'='+session+cookieOptions+'; Max-Age=28800'});
    }
    const result=await accountsPost('/api/auth/login',{email,password});
    if (result.status===429) return render('Zbyt wiele prób. Spróbuj później.',429);
    if (result.status>=500) return render('Usługa konta administratora jest chwilowo niedostępna.',503);
    if (!result.ok) return render('Sprawdź e-mail i hasło.',401);
    const {token:session}=await result.json();
    if (typeof session!=='string'||!/^[\w.-]+$/.test(session)||!await adminAccount(session))
      return render('Sprawdź e-mail i hasło.',401);
    if (path==='/change-password') {
      const change=await accountsPost('/api/auth/change-password',{current_password:password,new_password:newPassword,bieg_wyzej:true},session);
      return change.ok?changed():render('Zmiana hasła administratora jest chwilowo niedostępna.',503);
    }
    return redirect('/daily.html',{'Set-Cookie':cookie+'=shared-'+session+cookieOptions+'; Max-Age=28800'});
  }
  const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-lejek=([\w.-]{1,4096})(?:;|$)/)?.[1];
  const localToken=token?.match(/^bw-([a-f0-9]{64})$/)?.[1];
  if(path==='/logout' && request.method==='POST' && request.headers.get('Origin')===origin) {
    if (localToken) identity.logout(localToken);
    return redirect('/login',{'Set-Cookie':cookie+'='+cookieOptions+'; Max-Age=0'});
  }
  const sharedToken=token?.startsWith('shared-')?token.slice(7):null;
  const account=localToken?identity.account(localToken):sharedToken?await adminAccount(sharedToken):null;
  if (!account?.email || !account?.id) {
    if(path.startsWith('/api/')) return Response.json({error:'Zaloguj się ponownie.'},{status:401,headers});
    return redirect('/login');
  }
  const forwarded=new Headers(request.headers);
  forwarded.set('oai-authenticated-user-email',account.email);
  forwarded.set('oai-authenticated-user-id',String(account.id));
  forwarded.set('x-lejek-verified-admin',account.role==='admin'?'1':'0');
  return worker.fetch(new Request(request,{headers:forwarded}),{DB,GIPHY_API_KEY,extractLessonText,passwordStatements:identity.passwordStatements,inviteReady,sendInvitation,sharedAdmin});
}
createServer(async (req,res)=>{
  try {
    const chunks=[];
    let bytes=0;
    const host=req.headers.host;
    const origin=allowedHosts.has(host)?'https://'+host:previewOrigin;
    const maxBytes=req.method==='POST'&&new URL(req.url,origin).pathname==='/api/lesson-import'?21_000_000:65_536;
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
