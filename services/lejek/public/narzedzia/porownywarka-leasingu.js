const fields = [
 {section:"Dane oferty"},
 {key:"model",label:"Marka / model / wersja",type:"text",placeholder:"Np. OMODA 5 HEV"},
 {key:"financier",label:"Finansujący / leasingodawca",type:"text",placeholder:"Nazwa firmy"},
 {section:"Warunki leasingu"},
 {key:"price",label:"Cena zakupu samochodu (brutto)",type:"money"},
 {key:"down",label:"Opłata wstępna (brutto)",type:"money"},
 {key:"downPct",label:"Opłata wstępna (% ceny)",type:"computedPct"},
 {key:"count",label:"Liczba rat",type:"number",default:36},
 {key:"installment",label:"Wysokość raty leasingowej (brutto)",type:"money"},
 {key:"monthlyExtra",label:"Dodatkowe koszty miesięczne (brutto)",type:"money",hint:"Np. GAP, ubezpieczenie lub serwis płatne poza ratą"},
 {key:"monthlyDetails",label:"Szczegóły kosztów miesięcznych",type:"text",placeholder:"Co zawiera koszt?"},
 {key:"buyout",label:"Wykup końcowy (brutto)",type:"money"},
 {key:"oneTime",label:"Dodatkowe koszty jednorazowe (brutto)",type:"money",hint:"Np. prowizja, rejestracja, opłata administracyjna"},
 {section:"Gratisy — wartość rynkowa"},
 {key:"tires",label:"Opony",type:"money"},
 {key:"mats",label:"Dywaniki",type:"money"},
 {key:"ceramic",label:"Powłoka ceramiczna",type:"money"},
 {key:"otherGifts",label:"Inne gratisy",type:"money",hint:"Np. akcesoria, przeglądy, pakiet ubezpieczenia"},
 {key:"giftDetails",label:"Opis pozostałych gratisów",type:"text",placeholder:"Wymień dodatki"},
];
const sides = [{id:"our",container:"ourFields"},{id:"comp",container:"compFields"}];
const moneyKeys = new Set(["price","down","installment","monthlyExtra","buyout","oneTime","tires","mats","ceramic","otherGifts"]);
function makeFields(side){
 const root=document.getElementById(side.container);
 fields.forEach(f=>{
  if(f.section){const s=document.createElement("div");s.className="section";s.textContent=f.section;root.appendChild(s);return;}
  const wrap=document.createElement("div");wrap.className="field"+(["monthlyDetails","giftDetails"].includes(f.key)?" full":"");
  const id=side.id+"_"+f.key;const lab=document.createElement("label");lab.htmlFor=id;lab.textContent=f.label;wrap.appendChild(lab);
  const input=document.createElement("input");input.id=id;input.dataset.side=side.id;input.dataset.key=f.key;
  if(f.type==="computedPct"){input.readOnly=true;input.className="computed";input.value="0,0%";}
  else if(f.type==="number"){input.type="number";input.min="1";input.max="120";input.step="1";input.value=f.default||36;}
  else if(f.type==="money"){input.type="number";input.min="0";input.step="0.01";input.placeholder="0,00";}
  else {input.type="text";input.placeholder=f.placeholder||"";}
  if(f.hint){input.title=f.hint;lab.title=f.hint;}
  input.addEventListener("input",update);
  wrap.appendChild(input);root.appendChild(wrap);
 });
}
sides.forEach(makeFields);
function val(side,key){const el=document.getElementById(side+"_"+key);if(!el)return 0;return el.type==="text"?el.value:(Number(el.value)||0);}
function money(n){return (Number.isFinite(n)?n:0).toLocaleString("pl-PL",{style:"currency",currency:"PLN"});}
function pct(n){return (Number.isFinite(n)?n:0).toLocaleString("pl-PL",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";}
function calc(side){
 const price=val(side,"price"),down=val(side,"down"),count=Math.max(0,val(side,"count")),installment=val(side,"installment"),monthlyExtra=val(side,"monthlyExtra"),buyout=val(side,"buyout"),oneTime=val(side,"oneTime");
 const gifts=val(side,"tires")+val(side,"mats")+val(side,"ceramic")+val(side,"otherGifts");
 const total=down+count*(installment+monthlyExtra)+buyout+oneTime;
 return {gifts,total,net:total-gifts,downPct:price?down/price*100:0};
}
function update(){
 const a=calc("our"),b=calc("comp");
 document.getElementById("our_downPct").value=pct(a.downPct);
 document.getElementById("comp_downPct").value=pct(b.downPct);
 document.getElementById("ourTotal").textContent=money(a.net);
 document.getElementById("compTotal").textContent=money(b.net);
 const diff=b.net-a.net, save=document.getElementById("saving");
 save.textContent=(diff>0?"+":"")+money(diff);
 save.className="value "+(diff>0?"positive":diff<0?"negative":"");
 document.getElementById("savingHint").textContent=diff>0?"Nasza oferta jest tańsza o "+money(diff):diff<0?"Oferta konkurencji jest tańsza o "+money(-diff):"Koszty obu ofert są takie same";
 document.getElementById("ourGross").textContent=money(a.total);document.getElementById("ourGifts").textContent=money(a.gifts);document.getElementById("ourNet").textContent=money(a.net);
 document.getElementById("compGross").textContent=money(b.total);document.getElementById("compGifts").textContent=money(b.gifts);document.getElementById("compNet").textContent=money(b.net);
}
function resetAll(){document.querySelectorAll("input").forEach(i=>{if(i.readOnly)return;i.value=i.type==="number"&&i.dataset.key==="count"?"36":"";});update();}
update();

document.querySelector('[data-tool-print]').addEventListener('click',()=>window.print());
document.querySelector('[data-tool-reset]').addEventListener('click',resetAll);
