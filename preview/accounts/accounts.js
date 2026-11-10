const $=id=>document.getElementById(id);
const roleNames={admin:"Administrator CARVAMO",staff:"Pracownik CARVAMO",dealer:"Dealer",dealer_admin:"Administrator dealera",dealer_staff:"Pracownik dealera"};
let token="",me=null,dealers=[];
const BUILD="2026-11-10.4";
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
  for(const value of [user.email,roleNames[user.role]||user.role,dealerName(user.dealer_id),user.enabled?"Aktywne":"Zablokowane"])tr.appendChild(el("td",value));
  const td=document.createElement("td");if(user.id!==me.id && user.role!=="admin"){
   const b=el("button",user.enabled?"Zablokuj":"Aktywuj");b.className="outline";
   b.addEventListener("click",async()=>{if(!confirm("Zmienić status konta "+user.email+"?"))return;try{await api("/api/accounts/"+encodeURIComponent(user.id)+"/status",{method:"PATCH",body:JSON.stringify({enabled:!user.enabled})});await refresh()}catch(e){notice(e.message)}});td.appendChild(b)
  }tr.appendChild(td);tbody.appendChild(tr)
 }
}
function configure(){
 $("identity").textContent=me.email+" · "+roleNames[me.role];
 const roles=me.role==="admin"?["staff","dealer","dealer_admin","dealer_staff"]:["dealer_staff"];
 $("newRole").replaceChildren(...roles.map(r=>{const o=el("option",roleNames[r]);o.value=r;return o}));
 $("newRole").addEventListener("change",syncRole);
 const dealerSelect=$("newDealer");dealerSelect.replaceChildren();
 const placeholder=el("option","Wybierz dealera");placeholder.value="";dealerSelect.appendChild(placeholder);
 for(const d of (Array.isArray(dealers)?dealers:[])){const o=el("option",d.name);o.value=d.id;dealerSelect.appendChild(o)}
 syncRole();
}
function syncRole(){const r=$("newRole").value;const isInternal=["admin","staff"].includes(r);$("dealerWrap").hidden=isInternal||me.role==="dealer_admin";$("newDealer").required=!isInternal&&me.role==="admin"}
$("login").addEventListener("submit",async e=>{e.preventDefault();try{
 const r=await api("/api/auth/login",{method:"POST",body:JSON.stringify({email:$("email").value,password:$("password").value})});token=r.token;$("password").value="";
 me=(await api("/api/auth/me")).account;
 if(!["admin","dealer_admin"].includes(me.role))throw new Error("Twoja rola nie umożliwia zarządzania kontami");
 const dealerResponse=me.role==="admin"?await api("/api/dealers"):{dealers:[]};
 dealers=Array.isArray(dealerResponse.dealers)?dealerResponse.dealers:[];
 if(me.role==="admin"&&!Array.isArray(dealerResponse.dealers))notice("Lista dealerów ma nieprawidłowy format. Konta wewnętrzne nadal można obsługiwać.");
 configure();await refresh();$("loginBox").hidden=true;$("dashboard").hidden=false;$("availability").hidden=true;if(Array.isArray(dealerResponse.dealers))notice("");
 }catch(err){token="";notice(err.message)}});
$("create").addEventListener("submit",async e=>{e.preventDefault();try{
 const role=$("newRole").value;const dealer_id=me.role==="dealer_admin"?me.dealer_id:(["staff","admin"].includes(role)?null:$("newDealer").value);
 await api("/api/accounts",{method:"POST",body:JSON.stringify({email:$("newEmail").value,role,dealer_id,temporary_password:$("newPassword").value})});
 $("newEmail").value="";$("newPassword").value="";await refresh();notice("Konto utworzone")
 }catch(err){notice(err.message)}});
$("changePassword").addEventListener("submit",async e=>{e.preventDefault();
 if ($("replacementPassword").value !== $("replacementPasswordAgain").value) { notice("Hasła się różnią."); $("replacementPasswordAgain").focus(); return; }
 try{
 await api("/api/auth/change-password",{method:"POST",body:JSON.stringify({current_password:$("currentPassword").value,new_password:$("replacementPassword").value})});
 $("changePassword").reset();token="";me=null;
 $("dashboard").hidden=true;$("loginBox").hidden=false;notice("Hasło zmienione. Zaloguj się ponownie nowym hasłem.");
 }catch(err){notice(err.message)}
});
$("logout").addEventListener("click",()=>{token="";me=null;$("dashboard").hidden=true;$("loginBox").hidden=false;notice("Wylogowano")});
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
