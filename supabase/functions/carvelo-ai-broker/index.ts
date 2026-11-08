// CARVELO broker between GitHub Actions OIDC workers and private Supabase resources.
// No permanent keys are sent to GitHub runners or stored in this public repository.
// Every request must carry a signed, short-lived GitHub Actions JWT for a single workflow.
import { jwtVerify, createRemoteJWKSet } from "npm:jose@6.1.1";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const EXPECTED_REPO = "krzysztofjozefiakipff-cpu/gregarious-horse-a1b3b9";
const WORKFLOW = EXPECTED_REPO+"/.github/workflows/carvelo-photo-worker.yml@refs/heads/main";
const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const JWKS = createRemoteJWKSet(new URL(OIDC_ISSUER+"/.well-known/jwks"));
const MAX_FILE = 7*1024*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET="carvelo-photo-branded";
function reply(obj:unknown,status=200){return Response.json(obj,{status,headers:{"Cache-Control":"no-store"}});}

async function authenticate(req:Request){
 const authorization=req.headers.get("Authorization")||"";
 const token=authorization.startsWith("Bearer ")?authorization.slice(7):"";
 if(!token||token.length>9000)throw new Error("invalid_authorization");
 const {payload}=await jwtVerify(token,JWKS,{issuer:OIDC_ISSUER,audience:"carvelo-photo-worker",algorithms:["RS256"],clockTolerance:"30s"});
 if(payload.repository!==EXPECTED_REPO||
    payload.repository_id!=="1450149559"||
    payload.repository_owner_id!=="354026620"||
    payload.workflow_ref!==WORKFLOW||
    payload.ref!=="refs/heads/main"||
    payload.repository_visibility!=="public"||
    !["schedule","workflow_dispatch","push"].includes(String(payload.event_name||""))||
    payload.runner_environment!=="github-hosted"||
    !/^[0-9]{5,32}$/.test(String(payload.run_id||"")))
   throw new Error("github_workflow_not_authorized");
 return String(payload.run_id);
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return reply({error:"POST only"},405);
 let runId="";
 try{runId=await authenticate(req);}
 catch(e){console.warn("CARVELO broker OIDC rejected");return reply({error:"Unauthorized GitHub workflow"},401);}
 const url=Deno.env.get("SUPABASE_URL")||"";
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!key)return reply({error:"Backend configuration unavailable"},503);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
   const ct=req.headers.get("content-type")||"";
   if(ct.startsWith("application/json")){
     const payload=await req.json();
     if(payload.action==="seed_e2e_photo"){
       // One fixed smoke-test placeholder, never a dealer's actual image.
       const photoId="92379820-a063-4919-9bc0-62fb70820cbd";
       const row=await admin.from("cv_offer_photos")
         .select("id,offer_id,original_path,uploaded_by,photo_type,state,logo_applied")
         .eq("id",photoId).maybeSingle();
       if(row.error)throw row.error;
       const photo=row.data;
       if(!photo || photo.original_path!=="8e5ff6cb-8490-4849-82c1-5ffd7e0754bb/"+photoId+"/e2e-original.webp"
          ||photo.photo_type!=="exterior"||photo.logo_applied!==false||photo.state!=="review")
         return reply({error:"Test placeholder not available"},409);
       const offer=await admin.from("cv_offers").select("status").eq("id",photo.offer_id).maybeSingle();
       if(offer.error||offer.data?.status==="published")return reply({error:"Test offer is published"},409);
       const existing=await admin.from("cv_photo_jobs").select("id").eq("photo_id",photoId).limit(1);
       if(existing.error)throw existing.error;
       if(existing.data?.length)return reply({error:"E2E job already exists"},409);
       const path="https://raw.githubusercontent.com/"+EXPECTED_REPO+"/main/assets/carvelo-hero-v3.webp";
       const res=await fetch(path,{signal:AbortSignal.timeout(20000)});
       if(!res.ok)return reply({error:"Sample unavailable"},503);
       const bytes=new Uint8Array(await res.arrayBuffer());
       if(bytes.byteLength<10000||bytes.byteLength>4000000||
          String.fromCharCode(...bytes.subarray(0,4))!=="RIFF"||
          String.fromCharCode(...bytes.subarray(8,12))!=="WEBP")
         return reply({error:"Invalid public sample"},415);
       const uploaded=await admin.storage.from("carvelo-photo-originals").upload(
          photo.original_path,bytes,{contentType:"image/webp",upsert:false});
       if(uploaded.error)throw uploaded.error;
       const job=await admin.from("cv_photo_jobs").insert({
          photo_id:photoId,requested_by:photo.uploaded_by,
          target_mode:"showroom_exterior",state:"queued"
       }).select("id").single();
       if(job.error){
         await admin.storage.from("carvelo-photo-originals").remove([photo.original_path]);
         throw job.error;
       }
       return reply({ok:true,test_job_created:true,job_id:job.data.id});
     }
     if(payload.action==="claim"){
       const r=await admin.rpc("cv_ai_claim",{p_run_id:runId});
       if(r.error)throw r.error;
       if(!r.data)return reply({job:null});
       const job=r.data;
       const signed=await admin.storage.from("carvelo-photo-originals").createSignedUrl(job.original_path,600);
       if(signed.error)throw signed.error;
       // Download URL is short-lived, private and NEVER printed by the workflow.
       return reply({job:{id:job.job_id,photo_id:job.photo_id,offer_id:job.offer_id,
          type:job.photo_type,mode:job.target_mode,attempt:job.attempt,
          original_url:signed.data.signedUrl}});
     }
     if(payload.action==="fail"){
       const id=String(payload.job_id||"");
       if(!UUID.test(id))return reply({error:"Invalid job"},400);
       const r=await admin.rpc("cv_ai_fail",{p_job:id,p_run_id:runId,p_code:String(payload.error_code||"worker_failed").slice(0,100)});
       if(r.error)throw r.error;
       return reply({ok:true,state:r.data?.state});
     }
     return reply({error:"Unknown operation"},400);
   }
   if(ct.startsWith("multipart/form-data")){
     const len=Number(req.headers.get("content-length")||0);
     if(len>MAX_FILE+20000)return reply({error:"File too large"},413);
     const form=await req.formData();
     if(form.get("action")!=="complete")return reply({error:"Unknown operation"},400);
     const jobId=String(form.get("job_id")||"");
     const photoId=String(form.get("photo_id")||"");
     const offerId=String(form.get("offer_id")||"");
     if(!UUID.test(jobId)||!UUID.test(photoId)||!UUID.test(offerId))return reply({error:"Invalid IDs"},400);
     const jobCheck=await admin.from("cv_photo_jobs")
       .select("id,photo_id,worker_run_id,state").eq("id",jobId).maybeSingle();
     if(jobCheck.error)throw jobCheck.error;
     if(jobCheck.data?.photo_id!==photoId||jobCheck.data?.state!=="processing"||
        jobCheck.data?.worker_run_id!==runId)return reply({error:"Job claim expired"},409);
     const photoCheck=await admin.from("cv_offer_photos")
       .select("id,offer_id").eq("id",photoId).maybeSingle();
     if(photoCheck.error)throw photoCheck.error;
     if(photoCheck.data?.offer_id!==offerId)return reply({error:"Wrong offer"},403);
     const file=form.get("file");
     if(!(file instanceof File)||file.size>MAX_FILE||file.size<2000)return reply({error:"Invalid image size"},413);
     const bytes=new Uint8Array(await file.arrayBuffer());
     const validPNG=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&
       bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
     if(!validPNG)return reply({error:"Only actual PNG is supported"},415);
     // Trusted, signed OIDC worker creates this filename. Brand QA remains mandatory before publication.
     const path=offerId+"/"+photoId+"/ai/"+crypto.randomUUID()+".png";
     const uploaded=await admin.storage.from(BUCKET).upload(path,bytes,{contentType:"image/png",cacheControl:"0",upsert:false});
     if(uploaded.error)throw uploaded.error;
     const completed=await admin.rpc("cv_ai_complete",{p_job:jobId,p_run_id:runId,p_result_path:path});
     if(completed.error){
       await admin.storage.from(BUCKET).remove([path]);
       throw completed.error;
     }
     return reply({ok:true,state:"review",version_id:completed.data?.version_id});
   }
   return reply({error:"Unsupported media type"},415);
 }catch(e){
   console.error("CARVELO broker error",e instanceof Error?e.message:"unknown");
   return reply({error:"Worker request failed"},500);
 }
});
