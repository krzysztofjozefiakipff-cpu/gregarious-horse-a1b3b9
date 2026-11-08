// CARVELO: secured photo actions. This module never receives server secrets.
let getClient, notify, getRole, activeId=null, busy=false;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labels={review:"Do zatwierdzenia",approved:"Zatwierdzone",rejected:"Odrzucone"};
async function callFunction(body){
 const client=getClient();if(!client)throw Error("Zaloguj się ponownie.");
 const res=await client.functions.invoke("carvelo-photos",{body});
 if(res.error){let details;try{details=await res.error.context?.json?.()}catch{}throw Error(details?.error||res.error.message||"Błąd operacji zdjęcia");}
 if(res.data?.error)throw Error(res.data.error);
 return res.data;
}
function loading(v){busy=v;for(const id of ["uploadPhotoBtn","photoFiles","photoType"]){const el=$(id);if(el)el.disabled=v;}}
export function selectPhotos(offerId,offerName){
 activeId=offerId||null;
 $("photoBlock").hidden=!activeId;
 $("photoOfferLabel").textContent=activeId?(offerName||"Wybrana oferta"):"";
 $("photoList").innerHTML="";
 $("photoStatus").textContent="Zdjęcia są znakowane logotypem CARVELO przed akceptacją.";
 if(activeId)refreshPhotos().catch(e=>notify(e.message,true));
}
export function clearPhotos(){selectPhotos(null,"");}
export async function refreshPhotos(){
 if(!activeId||busy)return;
 const id=activeId;
 const data=await callFunction({action:"list",offer_id:id});
 if(activeId!==id)return;
 const rows=data.photos||[];
 $("photoStatus").textContent=(rows.length?"Liczba zdjęć: "+rows.length+" • każde z logo CARVELO":"Brak zdjęć. Dodaj pierwszą fotografię.") +
 (data.ai_worker_enabled?" • Studio AI aktywne":" • AI salonu wyłączone")+
 (data.ai_windows_enabled?" • Widok za szybami: BETA do akceptacji":" • Widok za szybami: testy") ;
 const staff=["admin","staff"].includes(getRole());
 const aiEnabled=!!data.ai_worker_enabled;
 const windowsEnabled=!!data.ai_windows_enabled;
 $("photoList").innerHTML=rows.map(p=>{
   const category={exterior:"Zewnętrzne",interior:"Wnętrze",detail:"Detal",unknown:"Do oceny"}[p.photo_type]||"Do oceny";
   const btn=(action,label,cl)=>'<button type="button" class="'+cl+'" data-photo-action="'+action+'" data-photo-id="'+esc(p.id)+'">'+label+'</button>';
   const categoryOptions=[["unknown","Do oceny"],["exterior","Zewnętrzne"],["interior","Wnętrze"],["detail","Detal"]]
       .map(([k,v])=>'<option value="'+k+'" '+(p.photo_type===k?'selected':'')+'>'+v+'</option>').join("");
   const classify=staff?'<div class="photo-type-edit"><label>Typ zdjęcia <select data-photo-select>'+categoryOptions+
       '</select></label>'+btn("classify","Zapisz typ","secondary")+'</div>':"";
   const ai=(p.ai_job?'<small>AI: '+esc(({queued:"W kolejce",processing:"Przetwarzanie",review:"Do akceptacji",completed:"Zakończone",failed:"Błąd",cancelled:"Anulowane"})[p.ai_job.state]||p.ai_job.state)+
       (p.ai_job.error_code?' — '+esc(p.ai_job.error_code):'')+'</small>':"")+
       (((aiEnabled&&p.photo_type==="exterior")||(windowsEnabled&&p.photo_type==="interior"))
          && !["queued","processing"].includes(p.ai_job?.state)
          ?btn("request_ai",p.photo_type==="interior"?"Zmień widok za szybami (BETA)":"Przetwórz w salonie AI (BETA)","secondary"):"")+
       (p.photo_type==="interior"&&!windowsEnabled?'<small>AI szyb: testy przed aktywacją — wnętrze bez zmian.</small>':"")+
       (staff && p.ai_candidate?.url?'<div class="photo-ai-candidate"><small>Nowe tło CARVELO — podgląd do decyzji</small>'+
           '<p class="muted">Porównaj z oryginałem. Wnętrze i wyposażenie muszą być nienaruszone.</p>'+
           '<img loading="lazy" src="'+esc(p.ai_candidate.url)+'" alt="Wersja AI zdjęcia samochodu z logo CARVELO">'+
           '<button type="button" class="secondary" data-photo-action="accept_ai" data-photo-id="'+esc(p.id)+
           '" data-version-id="'+esc(p.ai_candidate.id)+'">Zastosuj wersję AI do moderacji</button></div>':"");
   const controls=(staff&&p.state==="review"?(btn("approve","Zatwierdź","secondary")+btn("reject","Odrzuć","danger")):"")+
      (staff&&p.state==="approved"&&!p.is_cover?btn("cover","Ustaw główne","secondary"):"")+btn("delete","Usuń","secondary");
   return '<article class="photo-card"><div class="photo-preview">'+(p.preview_url?'<img src="'+esc(p.preview_url)+'" alt="Zdjęcie samochodu z logo CARVELO" loading="lazy">':'Brak podglądu')+
    '</div><div class="photo-desc"><strong>'+(p.is_cover?'★ Główne':'Zdjęcie')+'</strong><span>'+esc(labels[p.state]||p.state)+'</span>'+
    '<small>'+esc(category)+' • '+(p.background_mode==='showroom'?(p.photo_type==='interior'?'zmieniony widok za szybami':'tło CARVELO'):'oryginalne tło')+'</small><small>Logo CARVELO: '+(p.logo_applied?'✓ dodane':'do sprawdzenia')+'</small>'+classify+ai+
    '<div class="photo-actions">'+controls+'</div></div></article>';
 }).join("")||'<p class="muted">Dodaj fotografie — logo CARVELO zostanie naniesione automatycznie. Zdjęcia wnętrz i detali zachowują swoje tło.</p>';
}
export async function uploadOfferPhotos(){
 if(!activeId){notify("Najpierw zapisz ofertę.",true);return;}
 const files=Array.from($("photoFiles").files||[]);
 if(!files.length){notify("Wybierz zdjęcia do przesłania.",true);return;}
 if(files.length>40){notify("Maksymalnie 40 zdjęć.",true);return;}
 const id=activeId;loading(true);let saved=0,failed=0;
 try{
  for(const f of files){
    if(!["image/jpeg","image/png","image/webp"].includes(f.type)||f.size>4*1024*1024||f.size<2000){
      notify("Nieprawidłowy plik: "+f.name+". Limit 4 MB; JPG, PNG, WebP.",true);failed++;continue;
    }
    $("photoStatus").textContent="Przesyłanie "+(saved+failed+1)+"/"+files.length+": "+f.name;
    const form=new FormData();
    form.set("offer_id",id);form.set("photo_type",$("photoType").value);form.set("file",f,f.name);
    try{await callFunction(form);saved++;}catch(e){failed++;notify(f.name+": "+e.message,true);}
  }
  $("photoFiles").value="";
  $("photoSelection").textContent="Możesz wybrać kilka zdjęć jednocześnie.";
  notify("Przesłano "+saved+" zdjęć z logo CARVELO."+(failed?" Błędy: "+failed:""),failed>0&&saved===0);
 }finally{loading(false);await refreshPhotos().catch(e=>notify(e.message,true))}
}
async function act(action,id,extra={}){
 if(busy||!activeId)return;
 if(action==="delete"&&!window.confirm("Usunąć to zdjęcie?"))return;
 const offerId=activeId;
 loading(true);
 try{
   const payload={action,offer_id:offerId,photo_id:id};
   if(action==="classify")payload.photo_type=extra.photo_type;
   if(action==="accept_ai")payload.version_id=extra.version_id;
   await callFunction(payload);
   notify(({approve:"Zaakceptowano zdjęcie.",reject:"Odrzucono zdjęcie.",cover:"Ustawiono zdjęcie główne.",delete:"Usunięto zdjęcie."})[action]||"Zapisano.");
 }catch(e){notify(e.message,true)}
 finally{loading(false);await refreshPhotos().catch(e=>notify(e.message,true))}
}
export function initPhotoControls(clientGetter,notifyFn,roleGetter){
 getClient=clientGetter;notify=notifyFn;getRole=roleGetter;
 $("uploadPhotoBtn").addEventListener("click",uploadOfferPhotos);
 $("photoFiles").addEventListener("change",()=>{
   const n=$("photoFiles").files.length;
   $("photoSelection").textContent=n?"Wybrano "+n+" zdjęć.":"Możesz wybrać kilka zdjęć jednocześnie.";
 });
 $("photoList").addEventListener("click",event=>{
   const btn=event.target.closest("button[data-photo-action]");
   if(btn){
     const selected=btn.closest(".photo-card")?.querySelector("select[data-photo-select]");
     act(btn.dataset.photoAction,btn.dataset.photoId,{
       photo_type:selected?.value||"unknown",version_id:btn.dataset.versionId||""
     });
   }
 });
}
