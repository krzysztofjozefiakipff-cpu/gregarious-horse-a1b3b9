// Offer details are served by the private CARVAMO OVH backend through same-origin HTTPS.
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedParams=["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid","fbclid","msclkid"];
const params=new URLSearchParams(location.search);
const id=params.get("offer");
const node=document.getElementById("offer-detail");
const list=document.getElementById("portal-main");
const hero=document.getElementById("portal-hero");
function elem(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function row(dl,label,value){const wrap=elem("div");wrap.append(elem("dt",label),elem("dd",value||"Nie podano — zapytaj dealera"));dl.append(wrap)}
function val(v){return typeof v==="string"&&v.trim()?v.trim():""}
function format(n){return Number(n).toLocaleString("pl-PL")+" zł"}
function source(){const out={};for(const k of allowedParams){const v=params.get(k);if(v)out[k]=v.slice(0,160)}try{if(document.referrer){const host=new URL(document.referrer).hostname;if(host&&host!==location.hostname)out.referrer_host=host.slice(0,160)}}catch{}return out}
function showError(msg){node.replaceChildren(elem("p",msg,"detail-status error"))}
async function load(){
if(!id)return;
list.classList.add("detail-hidden");hero.classList.add("detail-hidden");node.classList.remove("detail-hidden");
if(!ID.test(id)){if(id.startsWith("demo-")){const demo=[["demo-omoda5","OMODA","OMODA 5",109900],["demo-jaecoo7","JAECOO","JAECOO 7",139900],["demo-mghs","MG","MG HS Hybrid+",149900],["demo-omoda9","OMODA","OMODA 9",199900],["demo-maxus9","MAXUS","MAXUS Deliver 9",119900],["demo-jaecoo5","JAECOO","JAECOO 5",114900]].find(x=>x[0]===id);if(demo){render({id:demo[0],brand:demo[1],model:demo[2],gross_price:demo[3]},{name:"Salon do potwierdzenia"},{},true);return}}showError("Nieprawidłowy adres oferty.");return}
try{
const res=await fetch("/api/public/offers/"+encodeURIComponent(id),{headers:{Accept:"application/json"},credentials:"omit",cache:"no-store"});
if(!res.ok)throw Error("Nie udało się pobrać oferty");
const payload=await res.json();
const o=payload.offer;
if(!o){showError("Ta oferta nie jest już dostępna w katalogu.");return}
render(o,{name:o.dealer_name||"Autoryzowany dealer"},{version_name:o.trim_name||"",availability_confirmed:false});
}catch(e){showError("Nie można teraz pobrać oferty. Spróbuj ponownie później.")}}
function render(o,dealer,details,isDemo=false){
node.replaceChildren();
const back=elem("a","← Wszystkie samochody","detail-back");back.href="/";node.append(back);
const shell=elem("article",undefined,"detail-shell");const head=elem("div",undefined,"detail-hero");head.append(elem("div","CARVAMO · DOBRA CENA. PROSTO OD DEALERA.","detail-tag"),elem("h1",val(o.brand)+" "+val(o.model)),elem("p",isDemo?"Oferta demonstracyjna — dostępność niepotwierdzona":details.availability_confirmed&&details.availability_confirmed_at&&details.availability_confirmed_by?"Dostępność potwierdzona":"Zapytaj o dostępność"));shell.append(head);
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
const submit=elem("button",isDemo?"Formularz niedostępny dla oferty demonstracyjnej":"Zapytaj o tę ofertę");submit.type="submit";submit.disabled=isDemo;form.append(submit);
const note=elem("p","Formularz pozostaje wyłączony do czasu uruchomienia zapisu zapytań na OVH.","detail-notice");form.append(note);
const status=elem("div",undefined,"detail-status detail-hidden");status.role="status";form.append(status);
// Lead submission is deliberately unavailable until the OVH endpoint is deployed.
submit.disabled=true;
submit.textContent="Zapytania chwilowo niedostępne";
status.textContent="Przygotowujemy bezpieczny formularz zapytań na serwerze OVH.";
status.classList.remove("detail-hidden");
right.append(form);grid.append(left,right);shell.append(grid);node.append(shell);document.title=val(o.brand)+" "+val(o.model)+" — oferta CARVAMO"}
load();
