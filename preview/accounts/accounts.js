const $=id=>document.getElementById(id);
const roleNames={admin:"Administrator CARVAMO",staff:"Pracownik CARVAMO",dealer:"Dealer",dealer_admin:"Administrator dealera",dealer_staff:"Pracownik dealera"};
let token="",me=null,dealers=[];
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
 $("newDealer").replaceChildren(...[(()=>{const o=el("option","Wybierz dealera");o.value="";return o})(),...dealers.map(d=>{const o=el("option",d.name);o.value=d.id;return o})()]);
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
$("logout").addEventListener("click",()=>{token="";me=null;$("dashboard").hidden=true;$("loginBox").hidden=false;notice("Wylogowano")});
try{const r=await api("/api/health");if(r.status==="ok"){$("availability").hidden=true;$("loginBox").hidden=false}}catch{ /* The API is deliberately private until authenticated reverse-proxy rollout. */ }
