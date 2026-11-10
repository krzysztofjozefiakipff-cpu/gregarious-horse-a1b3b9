import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./panel/config.js";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedParams=["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid","fbclid","msclkid"];
const params=new URLSearchParams(location.search);
const id=params.get("offer");
const node=document.getElementById("offer-detail");
const list=document.getElementById("portal-main");
const hero=document.getElementById("portal-hero");
const proof=document.getElementById("portal-proof");
function elem(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function row(dl,label,value){const wrap=elem("div");wrap.append(elem("dt",label),elem("dd",value||"Nie podano — zapytaj dealera"));dl.append(wrap)}
function val(v){return typeof v==="string"&&v.trim()?v.trim():""}
function format(n){return Number(n).toLocaleString("pl-PL")+" zł"}
function source(){const out={};for(const k of allowedParams){const v=params.get(k);if(v)out[k]=v.slice(0,160)}return out}
function showError(msg){node.replaceChildren(elem("p",msg,"detail-status error"))}
async function load(){
if(!id)return;
list.classList.add("detail-hidden");hero.classList.add("detail-hidden");proof.classList.add("detail-hidden");node.classList.remove("detail-hidden");
if(!ID.test(id)){showError("Nieprawidłowy adres oferty.");return}
try{
const api=SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/";
const heads={apikey:SUPABASE_PUBLISHABLE_KEY,Accept:"application/json"};
const res=await fetch(api+"cv_offers?select=id,brand,model,body,fuel,gross_price,dealer_id,status,special&id=eq."+encodeURIComponent(id)+"&status=eq.published&limit=1",{headers:heads,cache:"no-store"});
if(!res.ok)throw Error("Nie udało się pobrać oferty");
const rows=await res.json();const o=rows[0];if(!o){showError("Ta oferta nie jest już dostępna w katalogu.");return}
const dr=await fetch(api+"cv_dealers?select=id,name&active=eq.true&id=eq."+encodeURIComponent(o.dealer_id)+"&limit=1",{headers:heads,cache:"no-store"});
if(!dr.ok)throw Error("Nie udało się zweryfikować dealera");
const dealers=await dr.json();if(!dealers[0]){showError("Oferta nie jest obecnie dostępna.");return}
let details={};try{const mr=await fetch(api+"cv_preview_offer_details?select=version_name,discount_terms,purchase_terms,financing_terms,pickup_city,availability_confirmed,availability_confirmed_at,availability_confirmed_by&offer_id=eq."+encodeURIComponent(id)+"&limit=1",{headers:heads,cache:"no-store"});if(mr.ok){const m=await mr.json();details=m[0]||{}}}catch(e){console.warn("Offer details unavailable")}
render(o,dealers[0],details);
}catch(e){showError("Nie można teraz pobrać oferty. Spróbuj ponownie później.")}}
function render(o,dealer,details){
node.replaceChildren();
const back=elem("a","← Wszystkie samochody","detail-back");back.href="/";node.append(back);
const shell=elem("article",undefined,"detail-shell");const head=elem("div",undefined,"detail-hero");head.append(elem("div","CARVAMO · DOBRA CENA. PROSTO OD DEALERA.","detail-tag"),elem("h1",val(o.brand)+" "+val(o.model)),elem("p",details.availability_confirmed&&details.availability_confirmed_at&&details.availability_confirmed_by?"Dostępność potwierdzona":"Zapytaj o dostępność"));shell.append(head);
const grid=elem("div",undefined,"detail-grid"),left=elem("div"),right=elem("div",undefined,"detail-form");
const price=elem("div",format(o.gross_price),"detail-price");price.prepend(elem("small","Cena brutto wg opublikowanej oferty"));left.append(price);
const dl=elem("dl",undefined,"detail-facts");row(dl,"Model",val(o.brand)+" "+val(o.model));row(dl,"Wersja wyposażenia",val(details.version_name)||"Nie podano — zapytaj dealera");row(dl,"Cena brutto",format(o.gross_price));row(dl,"Salon / miasto odbioru",val(dealer.name)+" · "+(val(details.pickup_city)||"miasto do potwierdzenia"));row(dl,"Dostępność",details.availability_confirmed&&details.availability_confirmed_at&&details.availability_confirmed_by?"Dostępność potwierdzona":"Zapytaj o dostępność");left.append(dl);
const terms=elem("div",undefined,"detail-terms");terms.append(elem("h3","Warunki oferty"),elem("p","Warunki rabatu: "+(val(details.discount_terms)||"nie podano — potwierdź u dealera.")),elem("p","Warunki zakupu: "+(val(details.purchase_terms)||"nie podano — potwierdź u dealera.")),elem("p","Warunki finansowania: "+(val(details.financing_terms)||"nie podano — potwierdź u dealera. Cena może zależeć od sposobu finansowania.")));left.append(terms);
right.append(elem("h2","Zapytaj o tę ofertę"),elem("p",val(o.brand)+" "+val(o.model)+" · "+format(o.gross_price)),elem("p","Środowisko testowe: do prób używaj wyłącznie fikcyjnych danych kontaktowych. Formularz nie jest jeszcze produkcyjnym kanałem obsługi klientów.","detail-status"));
const form=elem("form");form.id="offer-lead-form";form.autocomplete="on";
for(const [name,label,type] of [["full_name","Imię i nazwisko","text"],["email","E-mail","email"],["phone","Telefon","tel"]]){const l=elem("label",label);l.htmlFor="lead-"+name;const inp=elem("input");inp.name=name;inp.id=l.htmlFor;inp.type=type;inp.maxLength=120;inp.required=true;form.append(l,inp)}
const label=elem("label","Wiadomość (opcjonalnie)");label.htmlFor="lead-message";const textarea=elem("textarea");textarea.id=label.htmlFor;textarea.name="message";textarea.maxLength=1200;textarea.rows=3;form.append(label,textarea);
const consent=elem("label",undefined,"consent");const checkbox=elem("input");checkbox.type="checkbox";checkbox.required=true;checkbox.name="consent";consent.append(checkbox,elem("span","Wyrażam zgodę na kontakt w sprawie tej oferty. Zapoznałem/am się z informacją o przetwarzaniu danych."));form.append(consent);
const honeypot=elem("input");honeypot.name="website";honeypot.tabIndex=-1;honeypot.autocomplete="off";honeypot.setAttribute("aria-hidden","true");honeypot.style.cssText="position:absolute;left:-9999px";form.append(honeypot);
const submit=elem("button","Zapytaj o tę ofertę");submit.type="submit";form.append(submit);
const note=elem("p","Dane testowe zostaną zapisane w wydzielonej tabeli zgłoszeń CARVAMO Preview. Nie są automatycznie przekazywane dealerowi.","detail-notice");form.append(note);
const status=elem("div",undefined,"detail-status detail-hidden");status.role="status";form.append(status);
form.addEventListener("submit",async e=>{e.preventDefault();if(!form.reportValidity())return;submit.disabled=true;status.classList.add("detail-hidden");try{
const f=new FormData(form);const payload={offer_id:o.id,full_name:String(f.get("full_name")||""),email:String(f.get("email")||""),phone:String(f.get("phone")||""),message:String(f.get("message")||""),consent:f.get("consent")==="on",website:String(f.get("website")||""),attribution:source()};
const response=await fetch(SUPABASE_URL.replace(/\/$/,"")+"/functions/v1/carvamo-preview-lead",{method:"POST",headers:{"content-type":"application/json",apikey:SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify(payload)});
const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw Error(data.error||"Nie udało się zapisać zapytania");
form.reset();status.textContent="Zapytanie zostało zapisane. Numer: "+data.reference;status.classList.remove("detail-hidden");status.classList.remove("error");
}catch(err){status.textContent="Nie udało się wysłać zapytania. Spróbuj ponownie później.";status.classList.remove("detail-hidden");status.classList.add("error")}finally{submit.disabled=false}});
right.append(form);grid.append(left,right);shell.append(grid);node.append(shell);document.title=val(o.brand)+" "+val(o.model)+" — oferta CARVAMO"}
load();
