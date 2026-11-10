const $=id=>document.getElementById(id);
const roleNames={admin:"Administrator CARVAMO",staff:"Pracownik CARVAMO",dealer:"Dealer",dealer_admin:"Administrator dealera",dealer_staff:"Pracownik dealera"};
let token="",me=null,dealers=[];
const BUILD="2026-11-10.8";
const workspaceTabs=[...document.querySelectorAll(".workspace-nav [role=tab]")];
function switchWorkspace(panel){
 const target=workspaceTabs.find(tab=>tab.dataset.panel===panel&&!tab.hidden);
 if(!target)return;
 if(panel==="offers")refreshOffers().catch(e=>notice("Oferty: "+e.message));
 if(panel==="leads")refreshLeads().catch(e=>notice("Leady: "+e.message));
 for(const tab of workspaceTabs){
  const selected=!tab.hidden&&tab.dataset.panel===panel;
  tab.setAttribute("aria-selected",String(selected));
  tab.tabIndex=selected?0:-1;
  const content=document.getElementById("section-"+tab.dataset.panel);
  if(content)content.hidden=!selected;
 }
}
for(const tab of workspaceTabs){
 tab.addEventListener("click",()=>switchWorkspace(tab.dataset.panel));
 tab.addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  event.preventDefault();
  const visible=workspaceTabs.filter(item=>!item.hidden);
  const index=visible.indexOf(tab);
  const next=event.key==="Home"?0:event.key==="End"?visible.length-1:
   (index+(event.key==="ArrowRight"?1:-1)+visible.length)%visible.length;
  switchWorkspace(visible[next].dataset.panel);visible[next].focus();
 });
}
function hasUnsavedWork(){
 return ["newEmail","newPhone","newPassword","currentPassword","replacementPassword","replacementPasswordAgain","offerBrand","offerModel","offerBody","offerFuel","offerPrice"]
 .some(id=>Boolean($(id)?.value));
}

const buildLabel=document.getElementById("buildVersion");if(buildLabel)buildLabel.textContent="Wersja panelu: "+BUILD;
const notice=(s)=>{$("msg").textContent=s};
async function api(path,options={}){
 const res=await fetch(path,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),...options.headers},cache:"no-store",credentials:"omit"});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(data.error||"Błąd komunikacji z serwerem");
 return data;
}
function el(tag,text){const node=document.createElement(tag);node.textContent=String(text??"");return node}
function dealerName(id){return dealers.find(x=>String(x.id)===String(id))?.name|| (id?"Przypisany dealer":"—")}
async function refresh(){
 const data=await api("/api/accounts");const tbody=$("accounts");tbody.replaceChildren();
 for(const user of data.accounts){
  const tr=document.createElement("tr");
  for(const value of [user.email,roleNames[user.role]||user.role,dealerName(user.dealer_id),user.enabled?"Aktywne":"Zablokowane",user.has_phone?"Do weryfikacji":"Brak"])tr.appendChild(el("td",value));
  const td=document.createElement("td");if(user.id!==me.id && user.role!=="admin"){
   const b=el("button",user.enabled?"Zablokuj":"Aktywuj");b.className="outline";
   b.addEventListener("click",async()=>{if(!confirm("Zmienić status konta "+user.email+"?"))return;try{await api("/api/accounts/"+encodeURIComponent(user.id)+"/status",{method:"PATCH",body:JSON.stringify({enabled:!user.enabled})});await refresh()}catch(e){notice(e.message)}});td.appendChild(b)
  }tr.appendChild(td);tbody.appendChild(tr)
 }
}
function configure(){
 $("identity").textContent=me.email+" · "+roleNames[me.role];
 const roles=["admin","staff"].includes(me.role)?["staff","dealer","dealer_admin","dealer_staff"]:["dealer_staff"];
 $("newRole").replaceChildren(...roles.map(r=>{const o=el("option",roleNames[r]);o.value=r;return o}));
 $("newRole").addEventListener("change",syncRole);
 const dealerSelect=$("newDealer");dealerSelect.replaceChildren();
 const placeholder=el("option","Wybierz dealera");placeholder.value="";dealerSelect.appendChild(placeholder);
 for(const d of (Array.isArray(dealers)?dealers:[])){const o=el("option",d.name);o.value=d.id;dealerSelect.appendChild(o)}
 syncRole();
}
function syncRole(){const r=$("newRole").value;const isInternal=["admin","staff"].includes(r);$("dealerWrap").hidden=isInternal||me.role==="dealer_admin";$("newDealer").required=!isInternal&&["admin","staff"].includes(me.role)}
$("login").addEventListener("submit",async e=>{e.preventDefault();try{
 const r=await api("/api/auth/login",{method:"POST",body:JSON.stringify({email:$("email").value,password:$("password").value})});token=r.token;$("password").value="";
 me=(await api("/api/auth/me")).account;
 if(!["admin","staff","dealer","dealer_admin","dealer_staff"].includes(me.role))throw new Error("Brak dostępu do panelu");
 const canManageAccounts=["admin","staff","dealer_admin"].includes(me.role);
 const dealerResponse=me.role==="admin"?await api("/api/dealers"):{dealers:[]};
 dealers=Array.isArray(dealerResponse.dealers)?dealerResponse.dealers:[];
 if(me.role==="admin"&&!Array.isArray(dealerResponse.dealers))notice("Lista dealerów ma nieprawidłowy format. Konta wewnętrzne nadal można obsługiwać.");
 if(canManageAccounts)configure();configureOffers();
 for(const tab of workspaceTabs){
  const management=["accounts","create"].includes(tab.dataset.panel);
  tab.hidden=management&&!canManageAccounts;
 }
 $("tab-leads").hidden=me.role==="dealer";
 if(canManageAccounts)await refresh();
 switchWorkspace(canManageAccounts?"accounts":"offers");$("loginBox").hidden=true;$("dashboard").hidden=false;$("availability").hidden=true;if(Array.isArray(dealerResponse.dealers))notice("");
 }catch(err){token="";notice(err.message)}});
$("create").addEventListener("submit",async e=>{e.preventDefault();try{
 const role=$("newRole").value;const dealer_id=me.role==="dealer_admin"?me.dealer_id:(["staff","admin"].includes(role)?null:$("newDealer").value);
 await api("/api/accounts",{method:"POST",body:JSON.stringify({email:$("newEmail").value,role,dealer_id,temporary_password:$("newPassword").value,phone:$("newPhone").value})});
 $("newPhone").value="";$("newEmail").value="";$("newPassword").value="";await refresh();notice("Konto utworzone")
 }catch(err){notice(err.message)}});
$("changePassword").addEventListener("submit",async e=>{e.preventDefault();
 if ($("replacementPassword").value !== $("replacementPasswordAgain").value) { notice("Hasła się różnią."); $("replacementPasswordAgain").focus(); return; }
 try{
 await api("/api/auth/change-password",{method:"POST",body:JSON.stringify({current_password:$("currentPassword").value,new_password:$("replacementPassword").value})});
 $("changePassword").reset();token="";me=null;
 $("dashboard").hidden=true;$("loginBox").hidden=false;notice("Hasło zmienione. Zaloguj się ponownie nowym hasłem.");
 }catch(err){notice(err.message)}
});
$("logout").addEventListener("click",()=>{if(hasUnsavedWork()&&!confirm("Masz niezapisane dane formularza. Wylogowanie je usunie. Kontynuować?"))return; $("create").reset();$("changePassword").reset();$("offerCreate").reset();token="";me=null;switchWorkspace("accounts");$("dashboard").hidden=true;$("loginBox").hidden=false;notice("Wylogowano")});
let resetToken = null;

function showRecovery(confirming) {
 $("loginBox").hidden = true;
 $("recoveryBox").hidden = false;
 $("requestReset").hidden = confirming;
 $("confirmReset").hidden = !confirming;
 $(confirming ? "resetPassword" : "resetEmail").focus();
}

function openResetLink() {
 const tokenFromLink = new URLSearchParams(location.hash.slice(1)).get("reset");
 if (!tokenFromLink) return;
 resetToken = tokenFromLink;
 history.replaceState(null, "", location.pathname + location.search);
 $("dashboard").hidden = true;
 $("availability").hidden = true;
 $("confirmReset").reset();
 notice("");
 showRecovery(true);
}

window.addEventListener("hashchange", openResetLink);
window.addEventListener("pageshow", openResetLink);
openResetLink();

function showLogin() {
 resetToken = null;
 $("confirmReset").reset();
 $("recoveryBox").hidden = true;
 $("loginBox").hidden = false;
 $("email").focus();
}

$("forgot").addEventListener("click", () => {
 $("resetEmail").value = $("email").value;
 notice("");
 showRecovery(false);
});
$("backToLogin").addEventListener("click", () => { notice(""); showLogin(); });
for (const [form, path, payload, success] of [
 ["requestReset", "request", () => ({email: $("resetEmail").value}), () => {
  notice("Jeśli istnieje aktywne konto dla tego adresu, otrzymasz link do ustawienia nowego hasła.");
 }],
 ["confirmReset", "confirm", () => ({token: resetToken, password: $("resetPassword").value}), () => {
  showLogin();
  notice("Hasło zostało zmienione. Zaloguj się nowym hasłem.");
 }],
]) {
 $(form).addEventListener("submit", async event => {
  event.preventDefault();
  if (form === "confirmReset" && $("resetPassword").value !== $("resetPasswordAgain").value) {
   notice("Hasła się różnią.");
   $("resetPasswordAgain").focus();
   return;
  }
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  notice("");
  try {
   await api("/api/auth/password-reset/" + path, {method: "POST", body: JSON.stringify(payload())});
   success();
  } catch (error) {
   notice(error.message);
  } finally {
   button.disabled = false;
  }
 });
}
try {
 const health = await api("/api/health");
 if (health.status === "ok") {
  $("availability").hidden = true;
  if ($("recoveryBox").hidden) $("loginBox").hidden = false;
 }
} catch { /* Keep the availability notice visible. */ }

function configureOffers(){
 const admin=me.role==="admin",wrap=$("offerDealerWrap"),select=$("offerDealer");
 wrap.hidden=!admin;select.required=admin;select.replaceChildren();
 if(admin){
  const empty=el("option","Wybierz dealera");empty.value="";select.appendChild(empty);
  for(const d of dealers){const option=el("option",d.name);option.value=d.id;select.appendChild(option)}
 }
}
function formatPrice(value){const n=Number(value);return Number.isFinite(n)?n.toLocaleString("pl-PL",{style:"currency",currency:"PLN"}):"—"}
async function refreshOffers(){
 if(!token||!me)return;
 const data=await api("/api/offers"),body=$("offersRows");body.replaceChildren();
 for(const offer of data.offers||[]){
  const tr=el("tr"),name=el("td",(offer.brand||"")+" "+(offer.model||""));
  tr.append(name,el("td",formatPrice(offer.gross_price)),el("td",offer.status||"—"));
  const action=el("td");
  const publish=["draft","pending","rejected"].includes(offer.status);
  if(publish||offer.status==="published"){
   const button=el("button",publish?"Opublikuj":"Wycofaj");
   button.className=publish?"":"outline";
   button.addEventListener("click",async()=>{
    button.disabled=true;
    try{await api("/api/offers/"+encodeURIComponent(offer.id)+"/"+(publish?"publish":"withdraw"),{method:"PATCH"});await refreshOffers();notice(publish?"Oferta opublikowana.":"Oferta wycofana.")}catch(e){notice(e.message)}finally{button.disabled=false}
   });action.appendChild(button);
  }
  tr.appendChild(action);body.appendChild(tr);
 }
 if(!body.children.length){const tr=el("tr"),td=el("td","Brak ofert.");td.colSpan=4;tr.appendChild(td);body.appendChild(tr)}
}
$("offersRefresh").addEventListener("click",()=>refreshOffers().catch(e=>notice(e.message)));
$("offerCreate").addEventListener("submit",async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
 const payload={brand:$("offerBrand").value,model:$("offerModel").value,body:$("offerBody").value,fuel:$("offerFuel").value,gross_price:$("offerPrice").value,special:$("offerSpecial").checked};
 if(me.role==="admin")payload.dealer_id=$("offerDealer").value;
 try{await api("/api/offers",{method:"POST",body:JSON.stringify(payload)});event.currentTarget.reset();await refreshOffers();notice("Szkic zapisany. Możesz go opublikować.")}catch(e){notice(e.message)}finally{button.disabled=false}
});
async function refreshLeads(){
 if(!token||!me)return;
 const manager=["admin","staff","dealer_admin"].includes(me.role);
 $("leadsInfo").textContent=me.role==="dealer_admin"?"Leady Twojego dealera. Możesz przydzielać je pracownikom.":me.role==="dealer_staff"?"Widzisz tylko własne przypisane leady.":"Leady wszystkich dealerów.";
 const data=await api("/api/leads");
 let assignees=[];
 if(manager){try{assignees=(await api("/api/leads/assignees")).assignees||[]}catch(e){notice("Nie udało się pobrać pracowników: "+e.message)}}
 const body=$("leadsRows");body.replaceChildren();
 for(const lead of data.leads||[]){
  const tr=el("tr");tr.append(el("td",lead.full_name||"—"),el("td",[lead.email,lead.phone].filter(Boolean).join(" · ")));
  const statusCell=el("td"),status=document.createElement("select");
  for(const [value,label] of [["new","Nowy"],["contacted","Kontakt"],["qualified","Zakwalifikowany"],["unqualified","Niezakwalifikowany"]]){const option=el("option",label);option.value=value;status.appendChild(option)}
  status.value=lead.status||"new";
  status.addEventListener("change",async()=>{status.disabled=true;try{await api("/api/leads/"+encodeURIComponent(lead.id)+"/status",{method:"PATCH",body:JSON.stringify({status:status.value})});notice("Status zapisany.")}catch(e){notice(e.message);await refreshLeads().catch(()=>{})}finally{status.disabled=false}});
  statusCell.appendChild(status);tr.appendChild(statusCell);
  const ownerCell=el("td");
  if(manager){
   const select=document.createElement("select"),empty=el("option","Nieprzypisany");empty.value="";select.appendChild(empty);
   for(const person of assignees){if(String(person.dealer_id)!==String(lead.dealer_id))continue;const option=el("option",person.email);option.value=person.id;select.appendChild(option)}
   select.value=lead.assigned_to||"";
   select.addEventListener("change",async()=>{select.disabled=true;try{await api("/api/leads/"+encodeURIComponent(lead.id)+"/assign",{method:"PATCH",body:JSON.stringify({assigned_to:select.value||null})});notice("Pracownik przypisany.")}catch(e){notice(e.message);await refreshLeads().catch(()=>{})}finally{select.disabled=false}});
   ownerCell.appendChild(select);
  }else ownerCell.textContent="Przypisany do mnie";
  tr.appendChild(ownerCell);body.appendChild(tr);
 }
 if(!body.children.length){const tr=el("tr"),td=el("td","Brak leadów w Twoim zakresie.");td.colSpan=4;tr.appendChild(td);body.appendChild(tr)}
}
$("leadsRefresh").addEventListener("click",()=>refreshLeads().catch(e=>notice(e.message)));
