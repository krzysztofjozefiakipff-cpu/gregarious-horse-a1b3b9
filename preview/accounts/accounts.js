const $=id=>document.getElementById(id);
const roleNames={admin:"Administrator CARVAMO",staff:"Pracownik CARVAMO",dealer:"Dealer",dealer_admin:"Administrator dealera",dealer_staff:"Pracownik dealera"};
let token="",me=null,dealers=[];let importedSpec=null;
const BUILD="2026-11-10.18";
const workspaceTabs=[...document.querySelectorAll(".workspace-nav [role=tab]")];
function switchWorkspace(panel){
 const target=workspaceTabs.find(tab=>tab.dataset.panel===panel&&!tab.hidden);
 if(!target)return;
 if(panel==="offers"){refreshOffers().catch(e=>notice("Oferty: "+e.message));refreshCatalog().catch(e=>notice("Katalog: "+e.message));}
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
 return ["newEmail","newPhone","newPassword","currentPassword","replacementPassword","replacementPasswordAgain","offerBrand","offerModel","offerBody","offerFuel","offerPrice","offerVersion","offerEngine","offerPower"]
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
 if(canManageAccounts)configure();configureOffers();$("catalogLink").hidden=!(["admin","staff"].includes(me.role));
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
  const publish=["draft","rejected"].includes(offer.status);
  if(publish||offer.status==="published"){
   const button=el("button",publish?"Opublikuj":"Wycofaj");
   button.className=publish?"":"outline";
   button.addEventListener("click",async()=>{
    button.disabled=true;
    try{const result=await api("/api/offers/"+encodeURIComponent(offer.id)+"/"+(publish?"publish":"withdraw"),{method:"PATCH"});await refreshOffers();notice(result.status==="pending"?"Oferta oczekuje na zatwierdzenie CARVAMO.":publish?"Oferta opublikowana.":"Oferta wycofana.")}catch(e){notice(e.message)}finally{button.disabled=false}
   });action.appendChild(button);
  }
  if(offer.status==="pending"&&["admin","staff"].includes(me.role)){
   for(const [decision,label] of [["approve","Zatwierdź"],["reject","Odrzuć"]]){
    const button=el("button",label);button.className=decision==="reject"?"outline":"";
    button.addEventListener("click",async()=>{button.disabled=true;try{await api("/api/offers/"+encodeURIComponent(offer.id)+"/review",{method:"PATCH",body:JSON.stringify({decision})});await refreshOffers();notice(decision==="approve"?"Oferta zatwierdzona.":"Oferta odrzucona.")}catch(e){notice(e.message)}finally{button.disabled=false}});action.appendChild(button);
   }
  }
  tr.appendChild(action);body.appendChild(tr);
 }
 if(!body.children.length){const tr=el("tr"),td=el("td","Brak ofert.");td.colSpan=4;tr.appendChild(td);body.appendChild(tr)}
}
$("offersRefresh").addEventListener("click",()=>refreshOffers().catch(e=>notice(e.message)));
function syncOfferChoices(){
 for(const id of ["offerFuel","offerDrive","offerTransmission","offerBody"]){
  const value=$(id).value;
  document.querySelectorAll('[data-choice-for="'+id+'"]').forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.choiceValue===value)));
 }
}
document.querySelectorAll("[data-choice-for]").forEach(button=>{
 button.addEventListener("click",()=>{
  const select=$(button.dataset.choiceFor);
  select.value=select.value===button.dataset.choiceValue?"":button.dataset.choiceValue;
  syncOfferChoices();
 });
});
$("offerCreate").addEventListener("submit",async event=>{
 event.preventDefault();const form=event.currentTarget;const button=form.querySelector('[type="submit"]');button.disabled=true;
 if(!$("offerFuel").value){notice("Zaznacz rodzaj paliwa.");button.disabled=false;return;}
 if(!$("offerBody").value){notice("Zaznacz rodzaj nadwozia.");button.disabled=false;return;}
 const payload={brand:$("offerBrand").value,model:$("offerModel").value,body:$("offerBody").value,fuel:$("offerFuel").value,gross_price:$("offerPrice").value,special:$("offerSpecial").checked,trim_name:$("offerVersion").value,engine_name:$("offerEngine").value,power_hp:$("offerPower").value||null,drive_type:$("offerDrive").value||null,transmission_type:$("offerTransmission").value||null};
 const brand=payload.brand.trim().toLocaleLowerCase("pl"),model=payload.model.trim().toLocaleLowerCase("pl");
 if(!catalogVehicles.some(x=>x.brand.toLocaleLowerCase("pl")===brand&&x.model.toLocaleLowerCase("pl")===model)){
  notice("Wybierz markę i model z podpowiedzi katalogu CARVAMO.");button.disabled=false;return;
 }
 if(["admin","staff"].includes(me.role))payload.dealer_id=$("offerDealer").value;
 try{const created=await api("/api/offers",{method:"POST",body:JSON.stringify(payload)});let saved=true;if(importedSpec&&created.offer?.id){try{await api("/api/offers/"+created.offer.id+"/specification",{method:"PUT",body:JSON.stringify(importedSpec)})}catch(err){saved=false;notice("Szkic zapisany, ale specyfikacja nie została zapisana: "+err.message)}}form.reset();syncOfferChoices();if(saved){importedSpec=null;$("offerPdfResult").replaceChildren();$("offerPdf").value=""}try{await refreshOffers()}catch(refreshError){notice("Szkic zapisany, ale nie udało się odświeżyć listy: "+refreshError.message);return}if(saved)notice("Szkic zapisany"+(importedSpec?" ze specyfikacją.":"."))}catch(e){notice(e.message)}finally{button.disabled=false}
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

let catalogVehicles=[];
async function refreshCatalog(){
 if(!token)return;
 const response=await api("/api/vehicle-catalog");
 catalogVehicles=response.vehicles||[];
 fillCatalog("offerBrands",[...new Set(catalogVehicles.map(x=>x.brand))]);
 updateCatalogModels();
}
function fillCatalog(id,values){
 const list=$(id);list.replaceChildren();
 for(const value of values.filter(Boolean).sort((a,b)=>a.localeCompare(b,"pl"))){const option=document.createElement("option");option.value=value;list.appendChild(option)}
}
function updateCatalogModels(){
 const brand=$("offerBrand").value.trim().toLowerCase();
 fillCatalog("offerModels",[...new Set(catalogVehicles.filter(x=>x.brand.toLowerCase()===brand).map(x=>x.model))]);
 updateCatalogTrims();
}
function updateCatalogTrims(){
 const brand=$("offerBrand").value.trim().toLowerCase(),model=$("offerModel").value.trim().toLowerCase();
 fillCatalog("offerVersions",[...new Set(catalogVehicles.filter(x=>x.brand.toLowerCase()===brand&&x.model.toLowerCase()===model).map(x=>x.trim_name))]);
}
$("offerBrand").addEventListener("input",()=>{updateCatalogModels();$("offerBrand").setCustomValidity("");});
$("offerModel").addEventListener("input",()=>{updateCatalogTrims();$("offerModel").setCustomValidity("");});


$("offerPdfImport").addEventListener("click",async()=>{
 const file=$("offerPdf").files?.[0],button=$("offerPdfImport"),result=$("offerPdfResult");
 if(!file){notice("Wybierz plik PDF.");return}
 if(file.size>10*1024*1024){notice("PDF może mieć maksymalnie 10 MB.");return}
 button.disabled=true;result.textContent="Odczytywanie dokumentu…";
 try{
  const data=new FormData();data.append("file",file);
  const response=await fetch("/api/offers/import-specification",{method:"POST",headers:{Authorization:"Bearer "+token},body:data,cache:"no-store"});
  const parsed=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(parsed.error||"Nie udało się odczytać PDF");
  const candidates=parsed.candidates||{};
  for(const [field,id] of Object.entries({brand:"offerBrand",model:"offerModel",trim_name:"offerVersion",power_hp:"offerPower",gross_price:"offerPrice",fuel:"offerFuel",transmission_type:"offerTransmission",drive_type:"offerDrive"})){
   if(candidates[field]!==null&&candidates[field]!==undefined&&candidates[field]!==""&&$(id)){
    $(id).value=String(candidates[field]);
   }
  }
  updateCatalogModels();updateCatalogTrims();syncOfferChoices();
  importedSpec={optional_equipment:parsed.equipment||[],standard_equipment:[],other_details:parsed.other_details||{}};
  result.replaceChildren();
  const heading=document.createElement("strong");heading.textContent="Odczytano "+parsed.pages+" str. — sprawdź wszystkie wartości przed zapisaniem.";result.appendChild(heading);
  const equipment=document.createElement("details"),summary=document.createElement("summary");summary.textContent="Rozpoznane wyposażenie ("+(parsed.equipment||[]).length+")";equipment.appendChild(summary);
  const list=document.createElement("ul");
  for(const item of parsed.equipment||[]){const li=document.createElement("li");li.textContent=item;list.appendChild(li)}
  equipment.appendChild(list);result.appendChild(equipment);
  const details=document.createElement("details"),title=document.createElement("summary"),pre=document.createElement("pre");
  title.textContent="Pełny odczytany tekst specyfikacji (do weryfikacji)";pre.textContent=parsed.source_text||"";pre.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto";
  details.append(title,pre);result.appendChild(details);
  notice("Specyfikacja odczytana. Sprawdź pola i wyposażenie przed zapisaniem oferty.");
 }catch(e){result.textContent="";notice(e.message)}finally{button.disabled=false}
});
