// CARVELO: secured photo actions. This module never receives server secrets.
let getClient, notify, getRole, activeId=null, busy=false;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labels={review:"Do zatwierdzenia",approved:"Zatwierdzone",rejected:"Odrzucone"};
function aiErrorLabel(code){
 if(!code)return "";
 const value=String(code);
 if(value.startsWith("window_mask_uncertain")||value.startsWith("window_core_not_safe")||value==="window_mask_reaches_interior")
  return "Nie rozpoznano bezpiecznie widoku za szybą. Zachowano oryginał z logo CARVELO.";
 if(value==="window_no_visible_view")
  return "Na zdjęciu nie wykryto widoku na zewnątrz. Tło pozostało bez zmian.";
 if(value.startsWith("mask_quality_unreliable"))
  return "Maska tła wymaga kontroli. Oryginalne zdjęcie pozostaje bez zmian.";
 return "Przetwarzanie nie powiodło się. Oryginał został zachowany.";
}
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
 (data.ai_windows_enabled?" • Widok za szybami: BETA do akceptacji":" • Widok za szybami: tryb precyzyjny do zaznaczenia")+
 (data.offer_status==="published"?" • Zmiana zdjęć wymaga wycofania oferty z publikacji":"");
 const staff=["admin","staff"].includes(getRole());
 const aiEnabled=!!data.ai_worker_enabled;
 const windowsEnabled=!!data.ai_windows_enabled;
 const isPublished=data.offer_status==="published";
 $("photoList").innerHTML=rows.map(p=>{
   const category={exterior:"Zewnętrzne",interior:"Wnętrze",detail:"Detal",unknown:"Do oceny"}[p.photo_type]||"Do oceny";
   const btn=(action,label,cl)=>'<button type="button" class="'+cl+'" data-photo-action="'+action+'" data-photo-id="'+esc(p.id)+'">'+label+'</button>';
   const categoryOptions=[["unknown","Do oceny"],["exterior","Zewnętrzne"],["interior","Wnętrze"],["detail","Detal"]]
       .map(([k,v])=>'<option value="'+k+'" '+(p.photo_type===k?'selected':'')+'>'+v+'</option>').join("");
   const classify=staff?'<div class="photo-type-edit"><label>Typ zdjęcia <select data-photo-select>'+categoryOptions+
       '</select></label>'+btn("classify","Zapisz typ","secondary")+'</div>':"";
   const ai=(p.ai_job?'<small>AI: '+esc(({queued:"W kolejce",processing:"Przetwarzanie",review:"Do akceptacji",completed:"Zakończone",failed:"Błąd",cancelled:"Anulowane"})[p.ai_job.state]||p.ai_job.state)+
       (p.ai_job.error_code?' — '+esc(aiErrorLabel(p.ai_job.error_code)):'')+'</small>':"")+
       (!isPublished && ((aiEnabled&&p.photo_type==="exterior")||(windowsEnabled&&p.photo_type==="interior"))
          && !["queued","processing"].includes(p.ai_job?.state)
          ?btn("request_ai",p.photo_type==="interior"?"Zmień widok za szybami (BETA)":"Przetwórz w salonie AI (BETA)","secondary"):"")+
       (p.photo_type==="interior"&&!windowsEnabled?'<small>AI szyb: testy przed aktywacją — wnętrze bez zmian.</small>':"")+
       (staff && p.ai_candidate?.url?'<div class="photo-ai-candidate"><strong>Porównanie przed / po</strong>'+
           '<p class="muted">'+esc(p.ai_candidate.mode==="showroom_windows"?
             (p.ai_candidate.window_view_changed===false?
              "Fallback: automatycznie nie zmieniono widoku za szybami. Zachowano oryginał oraz logo CARVELO.":
              "Obróbka wnętrza: kontroluj kierownicę, fotele, uszczelki i słupki."): 
             "Porównaj oryginalny samochód z tłem CARVELO.")+'</p>'+
           (p.ai_candidate.review_required_reason?'<small>Powód dodatkowej kontroli: '+esc(p.ai_candidate.review_required_reason)+'</small>':"")+
           (p.ai_candidate.mask_confidence!=null?'<small>Wskaźnik maski AI: '+esc(Math.round(Number(p.ai_candidate.mask_confidence)*100))+'%</small>':"")+
           '<div class="photo-before-after">'+
           (p.original_preview_url?'<figure><figcaption>PRZED — oryginał</figcaption><img loading="lazy" src="'+esc(p.original_preview_url)+'" alt="Oryginał zdjęcia wnętrza, bez obróbki"></figure>':"")+
           '<figure><figcaption>PO — kandydat z logo CARVELO</figcaption><img loading="lazy" src="'+esc(p.ai_candidate.url)+'" alt="Wersja AI CARVELO do akceptacji"></figure></div>'+
           '<button type="button" class="secondary" data-photo-action="accept_ai" data-photo-id="'+esc(p.id)+
           '" data-version-id="'+esc(p.ai_candidate.id)+'">Zastosuj wersję AI do moderacji</button></div>':"");
   const manualMask=staff&&!isPublished&&p.photo_type==="interior"&&p.preview_url?
       '<button type="button" class="secondary" data-photo-action="mark_windows" data-photo-id="'+esc(p.id)+
       '" data-photo-preview="'+esc(p.preview_url)+'">🎯 Zaznacz widok za szybą</button>':"";
   const controls=manualMask+(staff&&p.state==="review"?(btn("approve","Zatwierdź","secondary")+btn("reject","Odrzuć","danger")):"")+
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
let maskPhotoId="",maskBase=null,maskPoints=[],maskPolygons=[];
function drawMaskPreview(){
 const canvas=$("windowMaskCanvas");
 if(!maskBase||!canvas)return;
 const ctx=canvas.getContext("2d");
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(maskBase,0,0,canvas.width,canvas.height);
 const trace=(points,closed)=>{
   if(!points.length)return;
   ctx.beginPath();
   ctx.moveTo(points[0][0]*canvas.width,points[0][1]*canvas.height);
   for(const pt of points.slice(1))ctx.lineTo(pt[0]*canvas.width,pt[1]*canvas.height);
   if(closed){ctx.closePath();ctx.fillStyle="rgba(0,164,231,.25)";ctx.fill();}
   ctx.lineWidth=Math.max(3,canvas.width*.004);
   ctx.strokeStyle=closed?"#19BFFB":"#FF6A6A";ctx.stroke();
   for(const [x,y] of points){ctx.beginPath();ctx.arc(x*canvas.width,y*canvas.height,
     Math.max(5,canvas.width*.006),0,Math.PI*2);ctx.fillStyle="#E6F8FF";ctx.fill();}
 };
 for(const polygon of maskPolygons)trace(polygon,true);
 trace(maskPoints,false);
 $("windowMaskStatus").textContent=maskPolygons.length+" zamkniętych obszarów. "+
   (maskPoints.length?("Teraz zaznaczono "+maskPoints.length+" punktów — zamknij obszar."):
   "Kliknij punkty wzdłuż widoku za szybą (maksymalnie 6 obszarów).");
}
function openWindowMask(photoId,imageUrl){
 if(busy||!["admin","staff"].includes(getRole()))return;
 const dialog=$("windowMaskDialog");
 maskPhotoId=photoId;maskPoints=[];maskPolygons=[];maskBase=null;
 $("windowMaskStatus").textContent="Ładowanie zdjęcia…";
 const img=new Image();
 img.onload=()=>{
  if(maskPhotoId!==photoId)return;
  maskBase=img;
  const canvas=$("windowMaskCanvas");
  canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  drawMaskPreview();
 };
 img.onerror=()=>{
  $("windowMaskStatus").textContent="Brak dostępu do podglądu. Odśwież galerię.";
 };
 img.src=imageUrl;
 dialog.showModal();
}
async function submitWindowMask(){
 if(busy||!activeId||!maskPhotoId)return;
 if(maskPoints.length){
  $("windowMaskStatus").textContent="Najpierw zamknij aktualny obszar.";
  return;
 }
 if(!maskPolygons.length){$("windowMaskStatus").textContent="Zaznacz co najmniej jeden obszar za szybą.";return;}
 const photoId=maskPhotoId, offerId=activeId;
 loading(true);$("windowMaskStatus").textContent="Zlecam bezpieczny montaż tła CARVELO…";
 try{
  await callFunction({action:"request_ai",offer_id:offerId,photo_id:photoId,window_polygons:maskPolygons});
  notify("Zlecono wersję ze wskazanym widokiem za szybami. Oryginał i wnętrze pozostają bez zmian.");
  $("windowMaskDialog").close();maskPhotoId="";maskPolygons=[];maskPoints=[];
 }catch(e){
  $("windowMaskStatus").textContent=e.message;
  notify("Maska szyb: "+e.message,true);
 }finally{
  loading(false);await refreshPhotos().catch(e=>notify(e.message,true));
 }
}
function initWindowMaskControls(){
 $("windowMaskCanvas").addEventListener("click",event=>{
  if(!maskBase||!maskPhotoId||maskPolygons.length>=6||maskPoints.length>=20)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const x=Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width));
  const y=Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height));
  if(y>.79){$("windowMaskStatus").textContent="Nie zaznaczaj dolnej części wnętrza. Wskaż tylko obszar za szybą.";return;}
  maskPoints.push([Number(x.toFixed(5)),Number(y.toFixed(5))]);drawMaskPreview();
 });
 $("windowMaskFinishBtn").addEventListener("click",()=>{
  if(maskPoints.length<3){$("windowMaskStatus").textContent="Obszar musi mieć co najmniej 3 punkty.";return;}
  maskPolygons.push(maskPoints);maskPoints=[];drawMaskPreview();
 });
 $("windowMaskUndoBtn").addEventListener("click",()=>{
  if(maskPoints.length)maskPoints.pop();else if(maskPolygons.length)maskPolygons.pop();
  drawMaskPreview();
 });
 $("windowMaskCloseBtn").addEventListener("click",()=>$("windowMaskDialog").close());
 $("windowMaskSaveBtn").addEventListener("click",submitWindowMask);
 $("windowMaskDialog").addEventListener("close",()=>{maskPhotoId="";maskBase=null;maskPoints=[];maskPolygons=[];});
}

export function initPhotoControls(clientGetter,notifyFn,roleGetter){
 getClient=clientGetter;notify=notifyFn;getRole=roleGetter;
 initWindowMaskControls();
 $("uploadPhotoBtn").addEventListener("click",uploadOfferPhotos);
 $("photoFiles").addEventListener("change",()=>{
   const n=$("photoFiles").files.length;
   $("photoSelection").textContent=n?"Wybrano "+n+" zdjęć.":"Możesz wybrać kilka zdjęć jednocześnie.";
 });
 $("photoList").addEventListener("click",event=>{
   const btn=event.target.closest("button[data-photo-action]");
   if(btn){
     if(btn.dataset.photoAction==="mark_windows"){
       openWindowMask(btn.dataset.photoId,btn.dataset.photoPreview);
       return;
     }
     const selected=btn.closest(".photo-card")?.querySelector("select[data-photo-select]");
     act(btn.dataset.photoAction,btn.dataset.photoId,{
       photo_type:selected?.value||"unknown",version_id:btn.dataset.versionId||""
     });
   }
 });
}
