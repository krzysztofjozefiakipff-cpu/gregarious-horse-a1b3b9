import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);
const dom = {
  setup: $("setupView"), login: $("loginView"), blocked: $("noAccessView"), app: $("appView"),
  toast: $("toast"), offerForm: $("offerForm"), offersBody: $("offersBody"),
};
const validRoles = ["unassigned", "admin", "staff", "dealer"];
const states = ["draft", "pending", "published", "rejected"];
const names = { admin:"Administrator CARVELO", staff:"Pracownik CARVELO", dealer:"Dealer", unassigned:"Bez roli" };
const stateNames = { draft:"Szkic", pending:"Oczekuje", published:"Opublikowana", rejected:"Odrzucona" };
let client = null, user = null, profile = null, dealers = [], offers = [], accounts = [], editingId = null;
let toastTimer;

function show(view) {
  for (const el of [dom.setup,dom.login,dom.blocked,dom.app]) el.hidden = true;
  view.hidden = false;
}
function notify(message, error=false) {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.toggle("error", error);
  dom.toast.hidden = false;
  toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 6500);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch]);
}
function fmt(value) {
  return new Intl.NumberFormat("pl-PL", { style:"currency", currency:"PLN", maximumFractionDigits:2 })
    .format(Number(value)||0);
}
function internal() { return profile?.role==="admin" || profile?.role==="staff"; }
function must(result, label="Operacja") {
  if (result.error) throw new Error(label+": "+result.error.message);
  return result.data;
}
function dealerName(id) { return dealers.find((d) => d.id===id)?.name || "Dealer"; }
function canEdit(offer) {
  return internal() || (profile?.role==="dealer" && offer.source==="dealer" &&
    offer.dealer_id===profile.dealer_id && ["draft","pending","rejected"].includes(offer.status));
}
function canChangeStatus() { return internal(); }

async function refreshAuth() {
  if (!client) return;
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) { user=null; profile=null; show(dom.login); return; }
    user=data.user;
    const { data: p, error: ep }=await client.from("cv_profiles")
      .select("id,display_name,role,dealer_id,enabled").eq("id",user.id).maybeSingle();
    if(ep) throw ep;
    if(!p || !p.enabled || !validRoles.includes(p.role) || p.role==="unassigned" ||
        (p.role==="dealer"&&!p.dealer_id)) {
      profile=null; show(dom.blocked); return;
    }
    profile=p;
    $("identityLabel").textContent=(profile.display_name || user.email || "Użytkownik")+
      " · "+(user.email||"");
    $("roleLabel").textContent=names[profile.role];
    $("adminArea").hidden=profile.role!=="admin";
    $("dealerField").hidden=profile.role==="dealer";
    $("offerStatusField").hidden=profile.role==="dealer";
    show(dom.app);
    await refreshData();
  } catch(error) {
    notify("Błąd odczytu konta: "+(error.message||String(error)),true);
  }
}

async function refreshData() {
  if(!profile) return;
  try {
    const result=await client.from("cv_dealers").select("id,name,active").order("name");
    dealers=must(result,"Dealerzy")||[];
    // The database enforces row-level access; no client-side filter is trusted for security.
    const o=await client.from("cv_offers")
      .select("id,brand,model,body,fuel,gross_price,dealer_id,status,source,special,created_by,created_at")
      .order("created_at",{ascending:false}).limit(500);
    offers=must(o,"Oferty")||[];
    if(profile.role==="admin") {
      const a=await client.from("cv_profiles")
        .select("id,display_name,role,dealer_id,enabled").order("created_at",{ascending:false}).limit(100);
      accounts=must(a,"Konta")||[];
    } else accounts=[];
    renderAll();
  }catch(error){notify("Nie udało się pobrać danych: "+(error.message||String(error)),true);}
}

function fillDealerOptions() {
  if(!profile) return;
  const filtered=profile.role==="dealer"
    ? dealers.filter((d)=>d.id===profile.dealer_id)
    : dealers.filter((d)=>d.active);
  $("offerDealer").innerHTML='<option value="">Wybierz dealera</option>'+
    filtered.map((d)=>'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>').join("");
  if(profile.role==="dealer") {
    $("offerDealer").value=profile.dealer_id||"";
    $("offerDealer").disabled=true;
    $("offerStatus").value="pending";
    $("offerStatus").disabled=true;
  } else {
    $("offerDealer").disabled=false;
    $("offerStatus").disabled=false;
  }
}
function renderAll(){
  $("metricAll").textContent=offers.length;
  $("metricPublished").textContent=offers.filter((o)=>o.status==="published").length;
  $("metricPending").textContent=offers.filter((o)=>o.status==="pending").length;
  fillDealerOptions();
  renderOffers();
  if(profile.role==="admin") {renderDealers();renderAccounts();}
}
function renderOffers() {
  $("offersEmpty").hidden=offers.length>0;
  dom.offersBody.innerHTML=offers.map((o)=>{
    const controls=[
      canEdit(o)?'<button type="button" class="secondary" data-offer="'+esc(o.id)+'" data-action="edit">Edytuj</button>':"",
      canChangeStatus()&&o.status!=="published"?
        '<button type="button" class="secondary" data-offer="'+esc(o.id)+'" data-action="publish">Publikuj</button>':"",
      canChangeStatus()&&o.status!=="rejected"?
        '<button type="button" class="danger" data-offer="'+esc(o.id)+'" data-action="reject">Odrzuć</button>':"",
    ].filter(Boolean).join("");
    return '<tr><td><strong>'+esc(o.brand)+' '+esc(o.model)+'</strong><small>'+esc(o.body)+
      ' · '+esc(o.fuel)+(o.special?' · Specjalna':'')+'</small></td>'+
      '<td>'+esc(dealerName(o.dealer_id))+'</td><td>'+fmt(o.gross_price)+'</td>'+
      '<td><span class="pill '+esc(o.status)+'">'+esc(stateNames[o.status]||o.status)+'</span></td>'+
      '<td>'+esc(o.source==="dealer"?"Dealer":"CARVELO")+'</td><td><div class="row-actions">'+
      (controls||'<span class="muted">Tylko odczyt</span>')+'</div></td></tr>';
  }).join("");
}
function renderDealers(){
  const list=$("dealersList");
  list.textContent=dealers.length
    ? dealers.map(d=>d.name+(d.active?"":" (nieaktywny)")).join(" • ")
    :"Nie dodano jeszcze dealerów.";
}
function renderAccounts(){
  $("accountsEmpty").hidden=accounts.length>0;
  $("accountsBody").innerHTML=accounts.map((p)=>{
    const roleOptions=validRoles.map((r)=>'<option value="'+r+'" '+(p.role===r?"selected":"")+">"+
      esc(names[r])+"</option>").join("");
    const dealerOptions='<option value="">Brak przypisania</option>'+dealers.map((d)=>
      '<option value="'+esc(d.id)+'" '+(p.dealer_id===d.id?"selected":"")+">"+
      esc(d.name)+"</option>").join("");
    return '<tr data-account="'+esc(p.id)+'"><td><strong>'+esc(p.display_name||"Użytkownik")+
      '</strong><small>'+esc(p.id)+'</small></td>'+
      '<td><select data-field="role" aria-label="Rola użytkownika">'+roleOptions+'</select></td>'+
      '<td><select data-field="dealer" aria-label="Przypisany dealer">'+dealerOptions+'</select></td>'+
      '<td><input type="checkbox" data-field="enabled" aria-label="Konto aktywne" '+(p.enabled?"checked":"")+'></td>'+
      '<td><button type="button" class="secondary" data-save-account="'+esc(p.id)+'">Zapisz</button></td></tr>';
  }).join("");
}

function clearOfferForm(){
  editingId=null;
  dom.offerForm.reset();
  $("offerFormTitle").textContent="Dodaj nową ofertę";
  $("saveOfferBtn").textContent="Dodaj ofertę →";
  $("cancelEditBtn").hidden=true;
  fillDealerOptions();
}
async function saveOffer(event){
  event.preventDefault();
  if(!profile)return;
  const value=(id)=>$(id).value.trim();
  const price=Number(value("offerPrice"));
  const dealerId=profile.role==="dealer"?profile.dealer_id:value("offerDealer");
  if(!dealerId||!Number.isFinite(price)||price<=0||price>=100000000) {
    notify("Wybierz dealera i podaj poprawną cenę.",true);return;
  }
  const payload={
    brand:value("offerBrand"),model:value("offerModel"),body:value("offerBody"),fuel:value("offerFuel"),
    gross_price:price,dealer_id:dealerId,special:$("offerSpecial").checked,
    status:profile.role==="dealer"?"pending":value("offerStatus"),
  };
  const button=$("saveOfferBtn");button.disabled=true;
  try{
    if(editingId){
      const result=await client.from("cv_offers").update(payload).eq("id",editingId)
        .select("id").maybeSingle();
      const updated=must(result,"Edycja oferty");
      if(!updated)throw new Error("Nie zaktualizowano oferty — sprawdź uprawnienia.");
      notify("Oferta została zaktualizowana.");
    } else {
      const result=await client.from("cv_offers").insert(payload).select("id").single();
      must(result,"Dodanie oferty");
      notify("Oferta zapisana w centralnej bazie.");
    }
    clearOfferForm();
    await refreshData();
  }catch(error){notify(error.message||String(error),true)}
  finally{button.disabled=false}
}
function editOffer(id){
  const o=offers.find((x)=>x.id===id);
  if(!o||!canEdit(o))return;
  editingId=id;
  $("offerBrand").value=o.brand;$("offerModel").value=o.model;
  $("offerBody").value=o.body;$("offerFuel").value=o.fuel;
  $("offerPrice").value=o.gross_price;$("offerDealer").value=o.dealer_id;
  $("offerStatus").value=o.status;$("offerSpecial").checked=!!o.special;
  $("offerFormTitle").textContent="Edytuj ofertę";
  $("saveOfferBtn").textContent="Zapisz zmiany →";
  $("cancelEditBtn").hidden=false;
  $("offerFormBlock").scrollIntoView({behavior:"smooth",block:"start"});
}
async function changeOfferStatus(id, status){
  if(!canChangeStatus()||!["published","rejected"].includes(status))return;
  try{
    const r=await client.from("cv_offers").update({status}).eq("id",id).select("id").maybeSingle();
    if(!must(r,"Zmiana statusu"))throw new Error("Nie zmieniono statusu.");
    notify(status==="published"?"Oferta opublikowana.":"Oferta odrzucona.");
    await refreshData();
  }catch(error){notify(error.message||String(error),true);}
}
async function addDealer(event){
  event.preventDefault();
  if(profile?.role!=="admin")return;
  const name=$("newDealerName").value.trim();
  if(name.length<2){notify("Nazwa dealera jest zbyt krótka.",true);return}
  try{
    must(await client.from("cv_dealers").insert({name}),"Dodanie dealera");
    $("dealerForm").reset();
    notify("Dealer został dodany.");
    await refreshData();
  }catch(error){notify(error.message||String(error),true);}
}
async function saveAccount(id){
  if(profile?.role!=="admin")return;
  const row=[...$("accountsBody").querySelectorAll("tr")].find((x)=>x.dataset.account===id);
  if(!row)return;
  const role=row.querySelector('[data-field="role"]').value;
  const dealer=row.querySelector('[data-field="dealer"]').value||null;
  const enabled=row.querySelector('[data-field="enabled"]').checked;
  if(!validRoles.includes(role)){notify("Nieprawidłowa rola.",true);return}
  if(role==="dealer"&&!dealer){notify("Przypisz dealera, zanim aktywujesz konto dealerskie.",true);return}
  if(role==="unassigned"&&enabled){notify("Konto bez roli musi pozostać wyłączone.",true);return}
  if(id===user.id&&(!enabled||role!=="admin")){
    notify("Nie możesz odebrać sobie dostępu administratora w tym panelu.",true);return;
  }
  try{
    const r=await client.from("cv_profiles").update({
      role, dealer_id:role==="dealer"?dealer:null, enabled
    }).eq("id",id).select("id").maybeSingle();
    if(!must(r,"Zmiana uprawnień"))throw new Error("Konto nie zostało zaktualizowane.");
    notify("Zapisano uprawnienia konta.");
    await refreshData();
  }catch(error){notify(error.message||String(error),true);}
}

async function logIn(event){
  event.preventDefault();
  const email=$("loginEmail").value.trim();
  const password=$("loginPassword").value;
  const btn=dom.login.querySelector('button[type="submit"]');btn.disabled=true;
  try{
    const {error}=await client.auth.signInWithPassword({email,password});
    if(error)throw error;
    $("loginPassword").value="";
    await refreshAuth();
  }catch(error){notify("Nie udało się zalogować: "+(error.message||String(error)),true);}
  finally{btn.disabled=false}
}
async function logOut(){
  if(client)await client.auth.signOut();
  user=null;profile=null;offers=[];accounts=[];clearOfferForm();show(dom.login);
  notify("Wylogowano.");
}
function attach(){
  $("loginForm").addEventListener("submit",logIn);
  $("logoutBtn").addEventListener("click",logOut);
  $("noAccessLogout").addEventListener("click",logOut);
  $("refreshBtn").addEventListener("click",refreshAuth);
  dom.offerForm.addEventListener("submit",saveOffer);
  $("resetFormBtn").addEventListener("click",()=>setTimeout(clearOfferForm,0));
  $("cancelEditBtn").addEventListener("click",clearOfferForm);
  $("dealerForm").addEventListener("submit",addDealer);
  dom.offersBody.addEventListener("click",async (event)=>{
    const btn=event.target.closest("button[data-offer]");
    if(!btn)return;
    const id=btn.dataset.offer,action=btn.dataset.action;
    if(action==="edit")editOffer(id);
    if(action==="publish")await changeOfferStatus(id,"published");
    if(action==="reject")await changeOfferStatus(id,"rejected");
  });
  $("accountsBody").addEventListener("click",async (event)=>{
    const btn=event.target.closest("button[data-save-account]");
    if(btn)await saveAccount(btn.dataset.saveAccount);
  });
}
async function boot(){
  attach();
  if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY){
    show(dom.setup);return;
  }
  try{
    const endpoint=new URL(SUPABASE_URL);
    if(endpoint.protocol!=="https:")throw new Error("Adres Supabase musi używać HTTPS.");
    const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm");
    client=createClient(endpoint.href.replace(/\/$/,""),SUPABASE_PUBLISHABLE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    client.auth.onAuthStateChange((event)=>{
      if(event==="SIGNED_OUT"){user=null;profile=null;show(dom.login);}
    });
    await refreshAuth();
  }catch(error){
    show(dom.setup);
    notify("Konfiguracja panelu jest niekompletna: "+(error.message||String(error)),true);
  }
}
boot();
