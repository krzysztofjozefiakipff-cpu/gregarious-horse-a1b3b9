// CARVELO — live photo-processing progress. Percent reflects completed milestones, not ETA.
const stages={
 queued:"Oczekiwanie na wolnego workera",preparing:"Przygotowanie zdjęcia",
 installing:"Instalowanie narzędzi AI",loading_model:"Ładowanie modelu AI",
 downloading:"Pobieranie zdjęcia",segmenting:"Analiza samochodu i szyb",
 compositing:"Montaż tła, realistycznych cieni i odbicia",
 branding:"Nakładanie logo CARVELO",uploading:"Zapisywanie zdjęcia",
 review:"Gotowe do akceptacji",completed:"Zakończone",failed:"Błąd",cancelled:"Anulowano"
};
let pollTimer=null,tickTimer=null,pending=false;
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isActive=j=>j&&["queued","processing"].includes(j.state);
const percent=j=>j?.state==="queued"?0:Math.max(0,Math.min(100,Number(j?.progress_percent)||0));
const stage=j=>stages[j?.state==="queued"?"queued":j?.progress_stage]||stages[j?.state]||"Przetwarzanie";
function duration(iso,finishedAt){
 const t=Date.parse(iso||"");
 if(!Number.isFinite(t))return "—";
 const end=Date.parse(finishedAt||"");
 const s=Math.max(0,Math.floor(((Number.isFinite(end)?end:Date.now())-t)/1000));
 const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
 return h?h+" godz. "+String(m).padStart(2,"0")+" min":m+" min "+String(sec).padStart(2,"0")+" s";
}
export function progressMarkup(photoId,job){
 if(!isActive(job)&&job?.state!=="review")return "";
 const pc=job.state==="review"?100:percent(job),started=job.state==="queued"?job.created_at:(job.started_at||job.created_at);
 return '<div class="cv-ai-progress" data-progress-photo="'+escape(photoId)+'">'+
 '<div class="cv-ai-head"><strong data-ai-stage>'+escape(stage(job))+'</strong><b data-ai-value>'+pc+'%</b></div>'+
 '<div class="cv-ai-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pc+'" aria-label="Postęp obróbki zdjęcia">'+
 '<span class="cv-ai-fill" style="width:'+pc+'%"></span></div>'+
 '<small data-ai-elapsed data-job-state="'+escape(job.state)+'" data-start="'+escape(started)+'" data-finished="'+escape(job.finished_at||"")+'">'+
 (job.state==="queued"?"Czas oczekiwania: ":"Czas obróbki: ")+duration(started,job.finished_at)+'</small>'+
 '<small class="cv-ai-disclaimer">Procent oznacza zakończone etapy, nie przewidywany czas.</small></div>';
}
export function stopPhotoProgress(){
 if(pollTimer!==null)clearInterval(pollTimer);
 if(tickTimer!==null)clearInterval(tickTimer);
 pollTimer=null;tickTimer=null;
}
function tickElapsed(){
 if(document.hidden)return;
 for(const el of document.querySelectorAll("#photoList [data-ai-elapsed]")){
  el.textContent=(el.dataset.jobState==="queued"?"Czas oczekiwania: ":"Czas obróbki: ")+duration(el.dataset.start,el.dataset.finished);
 }
}
export function startPhotoProgress(rows,options){
 stopPhotoProgress();
 if(!rows.some(row=>isActive(row.ai_job)))return;
 const {getOfferId,fetchJobs,onFinished,isBusy}=options;
 const selectedOfferId=getOfferId();
 async function poll(){
  if(!selectedOfferId||selectedOfferId!==getOfferId()||pending||isBusy()||document.hidden)return;
  pending=true;
  try{
   const jobs=await fetchJobs(selectedOfferId);
   if(selectedOfferId!==getOfferId())return;
   let completed=false;
   for(const job of jobs){
    const root=Array.from(document.querySelectorAll("#photoList [data-progress-photo]"))
      .find(el=>el.dataset.progressPhoto===job.photo_id);
    if(!root)continue;
    if(!isActive(job)){completed=true;break;}
    const pc=percent(job);
    const fill=root.querySelector(".cv-ai-fill");
    if(fill)fill.style.width=pc+"%";
    root.querySelector("[role=progressbar]")?.setAttribute("aria-valuenow",String(pc));
    const text=root.querySelector("[data-ai-value]");
    if(text)text.textContent=pc+"%";
    const label=root.querySelector("[data-ai-stage]");
    if(label)label.textContent=stage(job);
    const timer=root.querySelector("[data-ai-elapsed]");
    if(timer){
     timer.dataset.jobState=job.state;
     timer.dataset.start=job.state==="queued"?job.created_at:job.started_at||job.created_at||"";
    }
   }
   if(completed)await onFinished();
   else tickElapsed();
  }catch(e){console.warn("CARVELO photo status temporarily unavailable",e?.message||e)}
  finally{pending=false;}
 }
 pollTimer=setInterval(poll,7000);
 tickTimer=setInterval(tickElapsed,1000);
 tickElapsed();
}
