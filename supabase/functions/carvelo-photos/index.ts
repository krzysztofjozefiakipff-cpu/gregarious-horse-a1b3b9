import { Image } from "jsr:@matmen/imagescript@3.13.1";
import { withSupabase } from "npm:@supabase/server@1.9.2";

// Official CARVELO brand asset: same SVG as assets/brand/carvelo-wordmark-on-dark.svg.
// Never reconstruct the logo with generative AI, random fonts or browser-provided images.
const LOGO_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"480\" height=\"168\" viewBox=\"0 0 480 168\" role=\"img\" aria-label=\"carVelo — Authorized Dealer Network\"><title>carVelo — Authorized Dealer Network</title><path fill=\"#F8FAFD\" transform=\"translate(16.00 111.00) scale(0.11500 -0.11500)\" d=\"M524 161C467 85 415 55 336 55C214 55 117 151 117 273C117 396 212 492 334 492C415 492 482 453 524 381H607C563 491 458 560 335 560C171 560 42 434 42 275C42 112 172 -13 340 -13C408 -13 471 8 522 49C557 77 578 104 608 161Z\"/><path fill=\"#F8FAFD\" transform=\"translate(90.81 111.00) scale(0.11500 -0.11500)\" d=\"M620 547H546V450C491 526 425 560 330 560C166 560 42 436 42 272C42 108 167 -13 336 -13C429 -13 487 17 546 96V0H620ZM332 492C453 492 546 398 546 276C546 151 454 55 336 55C212 55 117 152 117 277C117 396 213 492 332 492Z\"/><path fill=\"#F8FAFD\" transform=\"translate(169.75 111.00) scale(0.11500 -0.11500)\" d=\"M63 0H137V319C136 418 191 479 292 487V560C213 556 166 529 137 469V547H63Z\"/><path fill=\"#D7192D\" transform=\"translate(204.76 111.00) scale(0.11500 -0.11500)\" d=\"M314 0H386L692 739H612L351 92L91 739H10Z\"/><path fill=\"#F8FAFD\" transform=\"translate(285.89 111.00) scale(0.11500 -0.11500)\" d=\"M611 249C611 324 601 370 574 418C525 506 430 560 325 560C166 560 42 435 42 276C42 114 169 -13 331 -13C450 -13 557 64 597 180H520C489 105 412 55 329 55C216 55 122 141 116 249ZM118 316C138 421 221 492 325 492C431 492 511 426 537 316Z\"/><path fill=\"#F8FAFD\" transform=\"translate(361.04 111.00) scale(0.11500 -0.11500)\" d=\"M63 0H137V739H63Z\"/><path fill=\"#F8FAFD\" transform=\"translate(384.44 111.00) scale(0.11500 -0.11500)\" d=\"M329 560C166 560 42 437 42 277C42 108 165 -13 335 -13C495 -13 613 108 613 272C613 439 494 560 329 560ZM329 492C450 492 538 399 538 271C538 145 452 55 333 55C207 55 117 146 117 275C117 399 208 492 329 492Z\"/><path d=\"M16 145 H101.5 M378.5 145 H464\" fill=\"none\" stroke=\"#F8FAFD\" stroke-width=\"1.15\" opacity=\".74\"/><g transform=\"translate(113.49 0)\"><path fill=\"#F8FAFD\" transform=\"translate(0.00 151.00) scale(0.01330 -0.01330)\" d=\"M11 0H89L197 249H541L648 0H729L411 739H328ZM225 316 370 655 512 316Z\"/><path fill=\"#F8FAFD\" transform=\"translate(12.14 151.00) scale(0.01330 -0.01330)\" d=\"M76 739V278C76 183 91 127 128 78C172 20 245 -13 327 -13C410 -13 483 20 527 78C564 127 579 183 579 278V739H505V278C505 211 494 160 471 125C443 82 388 55 327 55C267 55 212 82 184 125C161 160 150 211 150 278V739Z\"/><path fill=\"#F8FAFD\" transform=\"translate(23.15 151.00) scale(0.01330 -0.01330)\" d=\"M176 0H250V672H419V739H7V672H176Z\"/><path fill=\"#F8FAFD\" transform=\"translate(31.12 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H150V347H533V0H607V739H533V414H150V739H76Z\"/><path fill=\"#F8FAFD\" transform=\"translate(42.50 151.00) scale(0.01330 -0.01330)\" d=\"M435 752C223 752 44 579 44 374C44 159 218 -13 436 -13C649 -13 825 160 825 369C825 580 649 752 435 752ZM435 684C608 684 750 541 750 368C750 197 607 55 436 55C260 55 119 197 119 372C119 541 264 684 435 684Z\"/><path fill=\"#F8FAFD\" transform=\"translate(56.36 151.00) scale(0.01330 -0.01330)\" d=\"M359 276C501 291 577 369 577 502C577 594 538 664 466 703C420 728 357 739 259 739H76V0H150V672H254C332 672 384 664 424 645C474 621 502 571 502 504C502 420 464 367 390 348C355 339 307 335 225 335L474 0H566Z\"/><path fill=\"#F8FAFD\" transform=\"translate(66.73 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H150V739H76Z\"/><path fill=\"#F8FAFD\" transform=\"translate(72.04 151.00) scale(0.01330 -0.01330)\" d=\"M17 0H474V67H101L463 672V739H28V672H380L17 67Z\"/><path fill=\"#F8FAFD\" transform=\"translate(80.72 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H480V67H150V340H469V407H150V672H480V739H76Z\"/><path fill=\"#F8FAFD\" transform=\"translate(90.15 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H275C386 0 464 17 529 55C641 121 700 229 700 367C700 506 642 616 533 681C462 723 384 739 250 739H76ZM150 67V672H253C364 672 437 657 491 625C576 573 625 480 625 370C625 273 587 188 519 133C460 86 384 67 253 67Z\"/><path fill=\"#F8FAFD\" transform=\"translate(108.33 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H275C386 0 464 17 529 55C641 121 700 229 700 367C700 506 642 616 533 681C462 723 384 739 250 739H76ZM150 67V672H253C364 672 437 657 491 625C576 573 625 480 625 370C625 273 587 188 519 133C460 86 384 67 253 67Z\"/><path fill=\"#F8FAFD\" transform=\"translate(120.53 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H480V67H150V340H469V407H150V672H480V739H76Z\"/><path fill=\"#F8FAFD\" transform=\"translate(129.96 151.00) scale(0.01330 -0.01330)\" d=\"M11 0H89L197 249H541L648 0H729L411 739H328ZM225 316 370 655 512 316Z\"/><path fill=\"#F8FAFD\" transform=\"translate(142.10 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H456V67H150V739H76Z\"/><path fill=\"#F8FAFD\" transform=\"translate(150.54 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H480V67H150V340H469V407H150V672H480V739H76Z\"/><path fill=\"#F8FAFD\" transform=\"translate(159.97 151.00) scale(0.01330 -0.01330)\" d=\"M359 276C501 291 577 369 577 502C577 594 538 664 466 703C420 728 357 739 259 739H76V0H150V672H254C332 672 384 664 424 645C474 621 502 571 502 504C502 420 464 367 390 348C355 339 307 335 225 335L474 0H566Z\"/><path fill=\"#F8FAFD\" transform=\"translate(176.33 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H150V650L590 0H664V739H590V126L176 739H76Z\"/><path fill=\"#F8FAFD\" transform=\"translate(188.47 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H480V67H150V340H469V407H150V672H480V739H76Z\"/><path fill=\"#F8FAFD\" transform=\"translate(197.90 151.00) scale(0.01330 -0.01330)\" d=\"M176 0H250V672H419V739H7V672H176Z\"/><path fill=\"#F8FAFD\" transform=\"translate(205.87 151.00) scale(0.01330 -0.01330)\" d=\"M221 0H317L479 606L643 0H738L950 739H874L692 96L515 739H445L268 96L86 739H10Z\"/><path fill=\"#F8FAFD\" transform=\"translate(220.93 151.00) scale(0.01330 -0.01330)\" d=\"M435 752C223 752 44 579 44 374C44 159 218 -13 436 -13C649 -13 825 160 825 369C825 580 649 752 435 752ZM435 684C608 684 750 541 750 368C750 197 607 55 436 55C260 55 119 197 119 372C119 541 264 684 435 684Z\"/><path fill=\"#F8FAFD\" transform=\"translate(234.79 151.00) scale(0.01330 -0.01330)\" d=\"M359 276C501 291 577 369 577 502C577 594 538 664 466 703C420 728 357 739 259 739H76V0H150V672H254C332 672 384 664 424 645C474 621 502 571 502 504C502 420 464 367 390 348C355 339 307 335 225 335L474 0H566Z\"/><path fill=\"#F8FAFD\" transform=\"translate(245.16 151.00) scale(0.01330 -0.01330)\" d=\"M76 0H150V202L246 320L492 0H585L293 379L585 739H492L150 314V739H76Z\"/></g></svg>";
const LOGO_VERSION = "carvelo-v1";
const BUCKET_RAW = "carvelo-photo-originals";
const BUCKET_MARKED = "carvelo-photo-branded";
const MAX_BYTES = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedOrigins = new Set([
 "https://carvelov2.netlify.app", "https://carvelo.pl", "https://www.carvelo.pl",
 "http://localhost:3000", "http://localhost:8888"
]);
const allowedTypes = new Set(["exterior","interior","detail","unknown"]);

function headers(req: Request): HeadersInit {
 const origin = req.headers.get("origin") ?? "";
 return {
   "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://carvelov2.netlify.app",
   "Vary":"Origin",
   "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
   "Access-Control-Allow-Methods":"POST,OPTIONS",
   "Cache-Control":"no-store"
 };
}
function json(req: Request,value:unknown,status=200) {
 return Response.json(value,{status,headers:headers(req)});
}
function fail(req:Request,status:number,message:string) {
 return json(req,{error:message},status);
}
function errText(e:unknown) { return e instanceof Error ? e.message : String(e); }

function validatedWindowPolygons(input:unknown):number[][][]|null {
 if(!Array.isArray(input)||input.length<1||input.length>6)return null;
 let total=0;const output:number[][][]=[];
 for(const polygon of input){
   if(!Array.isArray(polygon)||polygon.length<3||polygon.length>20)return null;
   const points:number[][]=[];
   for(const point of polygon){
     if(!Array.isArray(point)||point.length!==2||point.some((v:unknown)=>
          typeof v!=="number"||!Number.isFinite(v)||v<0||v>1))return null;
     if(point[1]>.79)return null;
     points.push([point[0],point[1]]);
   }
   let area=0;
   for(let k=0;k<points.length;k++){
      const a=points[k],b=points[(k+1)%points.length];
      area+=a[0]*b[1]-b[0]*a[1];
   }
   const safeArea=Math.abs(area)*.5;
   if(safeArea<.002||safeArea>.25)return null;
   total+=safeArea;output.push(points);
 }
 return total<=.35?output:null;
}

async function aiIsEnabled(admin:any,mode:"exterior"|"interior"="exterior"):Promise<boolean> {
  const style=mode==="interior"?"windows-v1":"showroom-v1";
  const r=await admin.from("cv_photo_styles").select("is_active").eq("code",style).maybeSingle();
  return !r.error&&r.data?.is_active===true;
}
async function enqueueForType(admin:any,photoId:string,requesterId:string,kind:string,polygons:number[][][]|null=null) {
  if(kind!=="exterior"&&kind!=="interior")return {queued:false};
  const active=await admin.from("cv_photo_jobs").select("id").eq("photo_id",photoId)
    .in("state",["queued","processing"]).limit(1);
  if(active.error)throw active.error;
  if(active.data?.length)return {queued:false,duplicate:true};
  const target=kind==="interior"?"showroom_windows":"showroom_exterior";
  const job=await admin.from("cv_photo_jobs").insert({photo_id:photoId,requested_by:requesterId,
    target_mode:target,state:"queued",window_polygons:polygons}).select("id").single();
  if(job.error)throw job.error;
  void wakeWorker();
  return {queued:true,job_id:job.data.id};
}

// Optional instant start. Missing/expired token never blocks photo upload.
// Store a fine-grained GitHub Actions:write token ONLY as Supabase Edge Function secret.
// The scheduled worker remains a safe fallback.
async function wakeWorker():Promise<void>{
 const token=Deno.env.get("CARVELO_GITHUB_DISPATCH_TOKEN");
 if(!token)return;
 const url="https://api.github.com/repos/krzysztofjozefiakipff-cpu/gregarious-horse-a1b3b9/actions/workflows/carvelo-photo-worker.yml/dispatches";
 try{
  const response=await fetch(url,{method:"POST",headers:{
   "Authorization":"Bearer "+token,"Accept":"application/vnd.github+json",
   "X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"
  },body:JSON.stringify({ref:"main"}),signal:AbortSignal.timeout(4500)});
  if(!response.ok)console.warn("CARVELO dispatch unavailable:",response.status);
 }catch(e){console.warn("CARVELO dispatch failed; scheduled fallback active",errText(e));}
}

const processRequest = withSupabase({auth:"user"},async(req,ctx)=>{
 try{
  if(req.method!=="POST")return fail(req,405,"Dozwolony tylko POST");
  const {supabase, supabaseAdmin, userClaims}=ctx;
  const uid=userClaims?.id;
  if(!uid)return fail(req,401,"Zaloguj się do CARVELO");

  const type=req.headers.get("content-type")??"";
  const multipart=type.includes("multipart/form-data");
  const data=multipart?await req.formData():await req.json();
  const action=String(multipart?"upload":(data.action??"")).trim();
  const offerId=String(multipart?data.get("offer_id"):(data.offer_id??""));
  if(!UUID.test(offerId))return fail(req,400,"Nieprawidłowy identyfikator oferty");

  const profileRes=await supabase.from("cv_profiles").select("id,role,dealer_id,enabled").eq("id",uid).maybeSingle();
  const profile=profileRes.data;
  if(profileRes.error||!profile?.enabled)return fail(req,403,"Nieaktywne konto");
  const offerRes=await supabase.from("cv_offers").select("id,dealer_id,source,status").eq("id",offerId).maybeSingle();
  const offer=offerRes.data;
  if(offerRes.error||!offer)return fail(req,404,"Oferta niedostępna");
  const staff=profile.role==="admin"||profile.role==="staff";
  const ownDealer=profile.role==="dealer"&&offer.dealer_id===profile.dealer_id&&offer.source==="dealer";
  if(!staff&&!ownDealer)return fail(req,403,"Brak dostępu do zdjęć tej oferty");

  if(action==="progress"){
    // Low-cost polling: no signed Storage URLs, only jobs belonging to this offer.
    const ownedPhotos=await supabase.from("cv_offer_photos").select("id").eq("offer_id",offerId).limit(40);
    if(ownedPhotos.error)throw ownedPhotos.error;
    const ids=(ownedPhotos.data??[]).map(row=>row.id);
    if(!ids.length)return json(req,{jobs:[]});
    const jobs=await supabase.from("cv_photo_jobs")
      .select("id,photo_id,state,progress_percent,progress_stage,progress_at,created_at,started_at,finished_at,attempts,error_code")
      .in("photo_id",ids).order("created_at",{ascending:false}).limit(400);
    if(jobs.error)throw jobs.error;
    const latest=new Map<string,unknown>();
    for(const job of jobs.data??[])if(!latest.has(job.photo_id))latest.set(job.photo_id,job);
    return json(req,{jobs:[...latest.values()]});
  }

  if(action==="delete_offer"){
    if(profile.role!=="admin")return fail(req,403,"Tylko administrator CARVELO może trwale usunąć ofertę");
    if(String(data.confirm??"")!=="USUŃ")return fail(req,400,"Potwierdź usunięcie wpisując USUŃ");
    // One database transaction cancels pending queue messages, removes rows,
    // and records all private media paths for reliable cleanup.
    const prepared=await supabaseAdmin.rpc("cv_delete_offer_admin",{
      p_offer_id:offerId,p_actor_id:uid
    });
    if(prepared.error){
      if(prepared.error.message?.includes("offer_ai_processing_busy"))
        return fail(req,409,"Trwa obróbka AI zdjęcia. Usuń ofertę po zakończeniu tego zadania.");
      if(prepared.error.message?.includes("offer_not_found"))
        return fail(req,404,"Nie znaleziono oferty do usunięcia.");
      throw prepared.error;
    }
    const batch=prepared.data;
    const faults:string[]=[];
    for(const [bucket,paths] of [[BUCKET_RAW,batch.original_paths],[BUCKET_MARKED,batch.branded_paths]] as [string,string[]][]){
      if(!Array.isArray(paths))continue;
      for(let i=0;i<paths.length;i+=100){
        const list=paths.slice(i,i+100).filter(path=>typeof path==="string"&&path.startsWith(offerId+"/"));
        if(!list.length)continue;
        const removed=await supabaseAdmin.storage.from(bucket).remove(list);
        if(removed.error)faults.push(bucket+":"+String(removed.error.message||"storage_error").slice(0,120));
      }
    }
    const recorded=await supabaseAdmin.from("cv_offer_cleanup_batches").update({
      state:faults.length?"failed":"done",
      last_error:faults.length?faults.join("; ").slice(0,450):null,
      finished_at:new Date().toISOString()
    }).eq("id",batch.batch_id);
    if(recorded.error)console.error("CARVELO cleanup journal:",recorded.error.message);
    return json(req,{ok:true,deleted:true,cleanup_pending:faults.length>0,
      removed_original_files:batch.original_paths?.length??0,
      removed_branded_files:batch.branded_paths?.length??0});
  }

  if(action==="list") {
    const r=await supabase.from("cv_offer_photos")
      .select("id,offer_id,photo_type,background_mode,state,is_cover,sort_order,logo_applied,logo_version,processed_path,created_at")
      .eq("offer_id",offerId).order("sort_order",{ascending:true}).order("created_at");
    if(r.error)throw r.error;
    const items=await Promise.all((r.data??[]).map(async(photo)=>{
      const signed=await supabaseAdmin.storage.from(BUCKET_MARKED).createSignedUrl(photo.processed_path,180);
      return {...photo,preview_url:signed.data?.signedUrl??null,processed_path:undefined};
    }));
    const ids=items.map((x)=>x.id);
    if(ids.length){
      const [jr,vr]=await Promise.all([
        supabase.from("cv_photo_jobs").select("id,photo_id,state,target_mode,error_code,created_at,started_at,finished_at,progress_percent,progress_stage,progress_at,attempts").in("photo_id",ids).order("created_at",{ascending:false}).limit(250),
        supabase.from("cv_photo_versions").select("id,photo_id,result_path,qa_status,mode,logo_applied,mask_confidence,window_view_changed,review_required_reason").in("photo_id",ids).eq("qa_status","review").limit(250)
      ]);
      if(jr.error||vr.error)throw (jr.error||vr.error);
      const jobs=new Map(),versions=new Map();
      for(const j of jr.data||[])if(!jobs.has(j.photo_id))jobs.set(j.photo_id,j);
      for(const v of vr.data||[])if(!versions.has(v.photo_id))versions.set(v.photo_id,v);
      for(const item of items){
        const job=jobs.get(item.id),version=versions.get(item.id);
        if(job)item.ai_job={state:job.state,mode:job.target_mode,error_code:job.error_code,
          job_id:job.id,progress_percent:job.progress_percent,progress_stage:job.progress_stage,
          created_at:job.created_at,started_at:job.started_at,finished_at:job.finished_at,
          progress_at:job.progress_at,attempts:job.attempts};
        if(version && (profile.role==="admin"||profile.role==="staff")){
          const signed=await supabaseAdmin.storage.from(BUCKET_MARKED).createSignedUrl(version.result_path,180);
          item.ai_candidate={id:version.id,url:signed.data?.signedUrl||null,
            mode:version.mode,logo_applied:version.logo_applied,
            mask_confidence:version.mask_confidence,
            window_view_changed:version.window_view_changed,
            review_required_reason:version.review_required_reason};
          const source=await supabaseAdmin.from("cv_offer_photos").select("original_path").eq("id",item.id).maybeSingle();
          if(!source.error && source.data?.original_path){
            const original=await supabaseAdmin.storage.from(BUCKET_RAW).createSignedUrl(source.data.original_path,180);
            item.original_preview_url=original.data?.signedUrl??null;
          }
        }
      }
    }
    return json(req,{photos:items,offer_status:offer.status,ai_worker_enabled:await aiIsEnabled(supabaseAdmin),ai_windows_enabled:await aiIsEnabled(supabaseAdmin,"interior")});
  }

  if(action==="upload") {
    if(ownDealer && !["draft","pending","rejected"].includes(offer.status))
      return fail(req,403,"Dealer nie może zmieniać opublikowanej oferty");
    const file=data.get("file");
    const declaredType=String(data.get("photo_type")||"unknown");
    if(!(file instanceof File)||!allowedTypes.has(declaredType))
      return fail(req,400,"Wskaż zdjęcie i kategorię");
    if(file.size<2000||file.size>MAX_BYTES)
      return fail(req,413,"Zdjęcie musi mieć od 2 KB do 4 MB");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))
      return fail(req,415,"Dozwolone: JPEG, PNG, WebP");
    const count=await supabaseAdmin.from("cv_offer_photos").select("id",{count:"exact",head:true}).eq("offer_id",offerId);
    if(count.error)throw count.error;
    if((count.count??0)>=40)return fail(req,409,"Limit 40 zdjęć na samochód");
    const bytes=new Uint8Array(await file.arrayBuffer());
    const isJpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const isPng=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
    const isWebp=String.fromCharCode(...bytes.subarray(0,4))==="RIFF"&&
       String.fromCharCode(...bytes.subarray(8,12))==="WEBP";
    if(!isJpeg&&!isPng&&!isWebp)return fail(req,415,"Nieprawidłowa zawartość zdjęcia");
    if((file.type==="image/jpeg"&&!isJpeg)||(file.type==="image/png"&&!isPng)||
       (file.type==="image/webp"&&!isWebp))return fail(req,415,"Format pliku jest niezgodny z zawartością");

    // Decode and re-encode on server: client cannot bypass or remove the CARVELO watermark.
    let original:Image;
    try{original=await Image.decode(bytes) as Image;}
    catch{return fail(req,415,"Nie udało się odczytać zdjęcia");}
    if(!Number.isSafeInteger(original.width)||!Number.isSafeInteger(original.height)||
       original.width<400||original.height<300||
       original.width*original.height>12000000)return fail(req,400,"Zdjęcie ma niewłaściwą rozdzielczość");
    // ImageScript works on pixels; resizing a very large original keeps CPU use bounded.
    const image=original.clone();
    if(image.width>1400)image.resize(1400,Image.RESIZE_AUTO);
    if(image.height>1400)image.resize(Image.RESIZE_AUTO,1400);
    const padding=Math.max(12,Math.round(image.width*.025));
    const logoW=Math.min(300,Math.max(100,Math.round(image.width*.22)));
    const logo=await Image.renderSVG(LOGO_SVG,{size:logoW,mode:Image.SVG_MODE_WIDTH});
    const padX=Math.max(9,Math.round(logoW*.07));
    const padY=Math.max(7,Math.round(logo.height*.19));
    const badgeW=logo.width+padX*2, badgeH=logo.height+padY*2;
    const badge=await Image.renderSVG(
      '<svg xmlns="http://www.w3.org/2000/svg" width="'+badgeW+'" height="'+badgeH+
      '"><rect width="100%" height="100%" rx="10" fill="#081827" fill-opacity=".75"/></svg>');
    const bx=Math.max(0,image.width-badgeW-padding);
    const by=Math.max(0,Math.round(image.height*.03)); // CARVELO identity: upper-right corner
    image.composite(badge,{x:bx,y:by});
    image.composite(logo,{x:bx+padX,y:by+padY,opacity:.98});
    const branded=new Uint8Array(await image.encode({compression:4}));
    if(branded.byteLength>12582912)return fail(req,413,"Obraz po obróbce jest zbyt duży");

    const photoId=crypto.randomUUID();
    const extension=isJpeg?"jpg":isPng?"png":"webp";
    const originalPath=offerId+"/"+photoId+"/original."+extension;
    const markedPath=offerId+"/"+photoId+"/carvelo-v1.png";
    let savedRaw=false,savedMarked=false;
    try{
      const raw=await supabaseAdmin.storage.from(BUCKET_RAW).upload(originalPath,bytes,
        {contentType:file.type,upsert:false,cacheControl:"0"});
      if(raw.error)throw raw.error;savedRaw=true;
      const proc=await supabaseAdmin.storage.from(BUCKET_MARKED).upload(markedPath,branded,
        {contentType:"image/png",upsert:false,cacheControl:"60"});
      if(proc.error)throw proc.error;savedMarked=true;
      const insert=await supabaseAdmin.from("cv_offer_photos").insert({
        id:photoId,offer_id:offerId,uploaded_by:uid,original_path:originalPath,
        processed_path:markedPath,photo_type:declaredType,
        background_mode:"original",logo_applied:true,logo_version:LOGO_VERSION,
        state:"review",sort_order:(count.count??0)+1
      }).select("id").single();
      if(insert.error)throw insert.error;
      let autoJob=null;
      if(offer.status!=="published" &&
         (declaredType==="exterior"||declaredType==="interior") &&
         await aiIsEnabled(supabaseAdmin,declaredType)){
        try{autoJob=await enqueueForType(supabaseAdmin,photoId,uid,declaredType)}
        catch(e){console.error("CARVELO AI autoqueue failed",errText(e))}
      }
      return json(req,{ok:true,photo_id:photoId,state:"review",
        message:autoJob?.queued?"Zdjęcie z logo dodane. Automatyczna obróbka tła w kolejce.":"Zapisano zdjęcie z logo CARVELO. Oczekuje na akceptację.",
        ai_job_queued:!!autoJob?.queued,background_mode:"original"});
    }catch(e){
      if(savedMarked)await supabaseAdmin.storage.from(BUCKET_MARKED).remove([markedPath]);
      if(savedRaw)await supabaseAdmin.storage.from(BUCKET_RAW).remove([originalPath]);
      throw e;
    }
  }

  const photoId=String(data.photo_id??"");
  if(!UUID.test(photoId))return fail(req,400,"Nieprawidłowe zdjęcie");
  const p=await supabaseAdmin.from("cv_offer_photos").select("*")
    .eq("id",photoId).eq("offer_id",offerId).maybeSingle();
  if(p.error||!p.data)return fail(req,404,"Zdjęcie nie istnieje");
  const photo=p.data;

  if(action==="classify"){
    if(offer.status==="published")return fail(req,409,"Wycofaj opublikowaną ofertę przed zmianami");
    const category=String(data.photo_type||"unknown");
    if(!allowedTypes.has(category))return fail(req,400,"Nieprawidłowa kategoria");
    const changed=await supabaseAdmin.from("cv_offer_photos").update({photo_type:category})
      .eq("id",photoId).eq("offer_id",offerId);
    if(changed.error)throw changed.error;
    let queued=false;
    if((category==="exterior"||category==="interior") &&
       await aiIsEnabled(supabaseAdmin,category)){
      try{queued=(await enqueueForType(supabaseAdmin,photoId,uid,category)).queued}
      catch(e){console.error("CARVELO AI classify enqueue error",errText(e))}
    }
    return json(req,{ok:true,photo_type:category,ai_job_queued:queued});
  }
  if(action==="request_ai"){
    // Published offers may be processed into PRIVATE previews by CARVELO staff.
    // Replacing the public image is blocked in cv_photo_accept_ai_version.
    if(offer.status==="published"&&!staff)
      return fail(req,403,"Tylko zespół CARVELO może przygotować prywatny podgląd opublikowanej oferty");
    if(photo.photo_type!=="exterior"&&photo.photo_type!=="interior")
      return fail(req,400,"AI obsługuje ujęcia zewnętrzne oraz widok przez szyby na zdjęciach wnętrza");
    const manual=Object.prototype.hasOwnProperty.call(data,"window_polygons");
    let polygons:number[][][]|null=null;
    if(manual){
      if(!staff||photo.photo_type!=="interior")
        return fail(req,403,"Zaznaczenie szyb może wykonać tylko CARVELO dla zdjęcia wnętrza");
      polygons=validatedWindowPolygons(data.window_polygons);
      if(!polygons)return fail(req,400,"Nieprawidłowy obszar szyby: zaznacz tylko widok na zewnątrz, maksymalnie 6 wielokątów");
    }
    if(!manual&&!(await aiIsEnabled(supabaseAdmin,photo.photo_type)))
      return fail(req,503,"Tryb automatyczny dla tego zdjęcia nie jest jeszcze aktywny. Możesz ręcznie zaznaczyć szybę.");
    const existing=await supabaseAdmin.from("cv_photo_jobs").select("id").eq("photo_id",photoId)
      .in("state",["queued","processing"]).limit(1);
    if(existing.error)throw existing.error;
    if(existing.data?.length)return fail(req,409,"Obróbka tego zdjęcia jest już w kolejce");
    const result=await enqueueForType(supabaseAdmin,photoId,uid,photo.photo_type,polygons);
    return json(req,{ok:true,job_id:result.job_id??null,status:result.queued?"queued":"already_queued"});
  }
  if(action==="accept_ai"){
    if(!staff)return fail(req,403,"Tylko CARVELO może zatwierdzić wersję AI");
    const versionId=String(data.version_id??"");
    if(!UUID.test(versionId))return fail(req,400,"Nieprawidłowa wersja zdjęcia");
    const version=await supabase.from("cv_photo_versions")
      .select("id,photo_id,qa_status").eq("id",versionId).eq("photo_id",photoId).maybeSingle();
    if(version.error||!version.data||version.data.qa_status!=="review")
      return fail(req,409,"Brak kandydatu AI oczekującego na zatwierdzenie");
    const res=await supabaseAdmin.rpc("cv_photo_accept_ai_version",{p_version_id:versionId,p_reviewer_id:uid});
    if(res.error)throw res.error;
    return json(req,{ok:true,result:res.data});
  }

  if(action==="reject_ai"){
    if(!staff)return fail(req,403,"Tylko CARVELO może odrzucić wynik AI");
    const versionId=String(data.version_id??"");
    if(!UUID.test(versionId))return fail(req,400,"Nieprawidłowa wersja zdjęcia");
    const version=await supabase.from("cv_photo_versions")
      .select("id,qa_status,photo_id").eq("id",versionId).eq("photo_id",photoId).maybeSingle();
    if(version.error||!version.data||version.data.qa_status!=="review")
      return fail(req,409,"Ta wersja nie oczekuje na akceptację");
    const denied=await supabaseAdmin.from("cv_photo_versions").update({
      qa_status:"rejected",reviewed_by:uid,reviewed_at:new Date().toISOString()
    }).eq("id",versionId).eq("photo_id",photoId).eq("qa_status","review");
    if(denied.error)throw denied.error;
    const closed=await supabaseAdmin.from("cv_photo_jobs").update({state:"completed"})
      .eq("result_version_id",versionId).eq("state","review");
    if(closed.error)throw closed.error;
    return json(req,{ok:true,original_unchanged:true});
  }
  if(action==="approve"){
    if(!staff)return fail(req,403,"Zatwierdzać zdjęcia może tylko CARVELO");
    if(!photo.logo_applied||photo.logo_version!==LOGO_VERSION)
      return fail(req,409,"Brak obowiązkowego logo CARVELO");
    if(photo.state==="approved")return json(req,{ok:true});
    const cover=await supabaseAdmin.from("cv_offer_photos")
      .select("id").eq("offer_id",offerId).eq("state","approved").eq("is_cover",true).limit(1);
    if(cover.error)throw cover.error;
    const update=await supabaseAdmin.from("cv_offer_photos").update({
      state:"approved",is_cover:(cover.data??[]).length===0,reviewed_by:uid,reviewed_at:new Date().toISOString()
    }).eq("id",photoId);
    if(update.error)throw update.error;
    return json(req,{ok:true});
  }
  if(action==="cover"){
    if(!staff)return fail(req,403,"Zdjęcie główne wybiera CARVELO");
    if(photo.state!=="approved")return fail(req,409,"Najpierw zatwierdź zdjęcie");
    if(offer.status==="published")
      return fail(req,409,"Aby zmienić okładkę, najpierw zdejmij ofertę z publikacji");
    // A partial unique index requires demoting the previous cover first.
    const clear=await supabaseAdmin.from("cv_offer_photos").update({is_cover:false})
      .eq("offer_id",offerId).eq("is_cover",true);
    if(clear.error)throw clear.error;
    const set=await supabaseAdmin.from("cv_offer_photos").update({is_cover:true}).eq("id",photoId);
    if(set.error)throw set.error;
    return json(req,{ok:true});
  }
  if(action==="reject"){
    if(!staff)return fail(req,403,"Zdjęcia może odrzucać tylko CARVELO");
    if(offer.status==="published"||photo.is_cover)
      return fail(req,409,"Najpierw wycofaj opublikowaną ofertę lub zmień zdjęcie główne");
    const update=await supabaseAdmin.from("cv_offer_photos").update({
      state:"rejected",reviewed_by:uid,reviewed_at:new Date().toISOString()
    }).eq("id",photoId);
    if(update.error)throw update.error;
    return json(req,{ok:true});
  }
  if(action==="delete"){
    if(offer.status==="published")return fail(req,409,"Wycofaj ofertę z publikacji przed usunięciem zdjęcia");
    if(!staff&&!(ownDealer&&["draft","pending","rejected"].includes(offer.status)))
      return fail(req,403,"Brak prawa usunięcia zdjęcia");
    const del=await supabaseAdmin.from("cv_offer_photos").delete().eq("id",photoId);
    if(del.error)throw del.error;
    await Promise.all([
      supabaseAdmin.storage.from(BUCKET_MARKED).remove([photo.processed_path]),
      supabaseAdmin.storage.from(BUCKET_RAW).remove([photo.original_path])
    ]);
    return json(req,{ok:true});
  }
  return fail(req,400,"Nieobsługiwana operacja");
 }catch(e){console.error("CARVELO photo processing:",errText(e));return fail(req,500,"Błąd obróbki zdjęcia. Spróbuj ponownie.");}
});

export default {
 fetch(req:Request) {
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
  return processRequest(req);
 }
};
