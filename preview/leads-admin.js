// CARVAMO leads: OVH-only authenticated accounts API.
let token="";
const $=id=>document.getElementById(id);
function msg(t){$("feedback").textContent=t}
async function api(method,path,body){
 const response=await fetch(path,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},credentials:"omit",body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||"Błąd API");
 return data;
}
$("login-form").addEventListener("submit",async event=>{
 event.preventDefault();const form=new FormData(event.target);msg("Logowanie...");
 try{
  const data=await api("POST","/api/auth/login",{email:form.get("email"),password:form.get("password")});
  if(!data.token)throw Error("Brak sesji");
  token=data.token;
  await refresh();$("login").hidden=true;$("board").hidden=false;msg("");
 }catch(error){token="";msg("Nie udało się zalogować lub brak uprawnień.")}
});
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
async function refresh(){const data=await api("GET","/api/leads");const leads=data.leads||[];$("stats").textContent="Zapytania: "+leads.length+" · Zakwalifikowane: "+leads.filter(l=>l.status==="qualified").length+" · Uwaga: metryka dotyczy wyłącznie ostatnich 100 zgłoszeń.";const target=$("leads");target.replaceChildren();const campaigns=new Map();for(const l of leads){const key=String(l.attribution?.utm_campaign||"(bez kampanii)");const c=campaigns.get(key)||{total:0,qualified:0};c.total++;if(l.status==="qualified")c.qualified++;campaigns.set(key,c)}const summary=el("section");summary.className="lead";summary.append(el("h2","Wyniki według kampanii (ostatnie 100 zapytań)"));for(const [campaign,c] of campaigns){summary.append(el("p",campaign+": "+c.total+" zgłoszeń · "+c.qualified+" zakwalifikowanych"))}summary.append(el("p","Koszt wartościowego leada = wydatki na kampanię / liczba zakwalifikowanych kontaktów. Koszty reklam należy pobrać z systemu reklamowego."));target.append(summary);for(const l of leads){const box=el("article");box.className="lead";box.append(el("h2",l.full_name+" · "+l.status));for(const line of ["Oferta: "+l.offer_id,"E-mail: "+l.email,"Telefon: "+l.phone,"Wiadomość: "+(l.message||"—"),"Źródło: "+JSON.stringify(l.attribution||{}),"Data: "+new Date(l.created_at).toLocaleString("pl-PL")])box.append(el("p",line));const select=el("select");for(const [v,label] of [["new","Nowe"],["contacted","Po rozmowie"],["qualified","Zakwalifikowany"],["unqualified","Niezakwalifikowany"]]){const opt=el("option",label);opt.value=v;select.append(opt)}select.value=l.status;select.addEventListener("change",async()=>{try{select.disabled=true;await api("PATCH","/api/leads/"+encodeURIComponent(l.id)+"/status",{status:select.value});await refresh();msg("Status zapisany.")}catch(e){msg("Nie udało się zapisać statusu.")}finally{select.disabled=false}});box.append(select);target.append(box)}}
$("refresh").addEventListener("click",()=>refresh().catch(()=>msg("Błąd odczytu zgłoszeń.")));
$("logout").addEventListener("click",()=>{token="";$("board").hidden=true;$("login").hidden=false;$("leads").replaceChildren();msg("Wylogowano.")});
