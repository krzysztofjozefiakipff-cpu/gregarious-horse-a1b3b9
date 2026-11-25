const names={petrol:"Benzyna",lpg:"LPG",hev:"Hybryda (HEV)",phev:"Hybryda plug-in (PHEV)",ev:"Elektryczny (BEV)"};
function n(id){return Number(document.getElementById(id).value)||0}function fmt(v){return v.toLocaleString("pl-PL",{style:"currency",currency:"PLN"})}
function powerCost(){let grid=n("elec"),pv=n("pv")/100,source=document.getElementById("surplus").value==="yes"?n("pvCost"):grid;return grid*(1-pv)+source*pv}
function calc(t){let km=n("km"),years=n("years"),buy=n("buy_"+t),cons=n("cons_"+t),p=0;
if(t==="petrol")p=cons*n("petrol");if(t==="lpg")p=cons*n("lpg");if(t==="hev")p=cons*n("petrol");
if(t==="phev"){let share=Math.max(0,Math.min(100,n("share_phev")))/100;p=cons*n("petrol")*(1-share)+17*powerCost()*share}
if(t==="ev")p=cons*powerCost();
let annual=p*km/100,period=annual*years;return {t,buy,p,annual,period,total:buy+period}}
function update(){let a=["petrol","lpg","hev","phev","ev"].map(calc),byRun=[...a].sort((x,y)=>x.p-y.p),byTotal=[...a].sort((x,y)=>x.total-y.total),cheap=byTotal[0],dear=[...a].sort((x,y)=>y.total-x.total)[0];
document.getElementById("bestRun").textContent=fmt(byRun[0].p);document.getElementById("bestRunHint").textContent=names[byRun[0].t]+" — najniższy koszt / 100 km";
document.getElementById("bestTotal").textContent=fmt(cheap.total);document.getElementById("bestTotalHint").textContent=names[cheap.t]+" przez "+n("years")+" lat";
document.getElementById("saving").textContent=fmt(dear.total-cheap.total);document.getElementById("savingHint").textContent=names[dear.t]+" vs "+names[cheap.t];
let out=document.getElementById("out");out.innerHTML="";byTotal.forEach((r,i)=>{let tr=document.createElement("tr");if(i===0)tr.className="winner";[names[r.t],fmt(r.p),fmt(r.annual),fmt(r.period),fmt(r.buy),fmt(r.total)].forEach(v=>{let td=document.createElement("td");td.textContent=v;tr.appendChild(td)});out.appendChild(tr)});
document.getElementById("analysis").textContent="Przy podanych założeniach najniższy koszt zakupu i paliwa/energii w okresie ma "+names[cheap.t]+" ("+fmt(cheap.total)+"). Najniższy bieżący koszt 100 km ma "+names[byRun[0].t]+" ("+fmt(byRun[0].p)+"). Wynik zależy od przebiegu, cen paliw i prądu oraz sposobu korzystania z PV.";
}
document.querySelectorAll("input,select").forEach(e=>{e.addEventListener("input",update);e.addEventListener("change",update)});update();

document.querySelector('[data-tool-print]').addEventListener('click',()=>window.print());
document.querySelector('[data-tool-reset]').addEventListener('click',()=>window.location.reload());
