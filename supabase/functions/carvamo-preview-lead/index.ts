import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const URL=Deno.env.get("SUPABASE_URL")||"";
const KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(URL,KEY,{auth:{persistSession:false}});
const ORIGIN="https://preview.carvamo.com";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed=["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid","fbclid","msclkid"];
function response(data,status=200,origin=ORIGIN){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","access-control-allow-origin":origin,"access-control-allow-methods":"POST, PATCH, OPTIONS","access-control-allow-headers":"authorization, apikey, content-type","cache-control":"no-store","vary":"Origin"}})}
function clean(v,max){return typeof v==="string"?v.trim().slice(0,max):""}
async function hash(s){const bytes=new TextEncoder().encode(s);return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(b=>b.toString(16).padStart(2,"0")).join("")}
async function qualify(req,body){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return response({error:"Wymagane logowanie"},401);
 const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return response({error:"Nieautoryzowany"},401);
 const {data:profile}=await db.from("cv_profiles").select("role,enabled").eq("id",user.id).single();
 if(!profile?.enabled||!["admin","staff"].includes(profile.role))return response({error:"Brak uprawnień"},403);
 if(!UUID.test(body.lead_id||"")||!["qualified","unqualified","contacted"].includes(body.status))return response({error:"Nieprawidłowe dane"},400);
 const change={status:body.status,qualified_at:body.status==="qualified"?new Date().toISOString():null,qualified_by:body.status==="qualified"?user.id:null};
 const {data,error:err}=await db.from("cv_preview_leads").update(change).eq("id",body.lead_id).select("id,status").single();
 if(err)return response({error:"Nie można zaktualizować"},500);
 return response({ok:true,lead:data});
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(origin!==ORIGIN)return response({error:"Niedozwolone źródło"},403,"null");
 if(req.method==="OPTIONS")return response({ok:true});
 if(!["POST","PATCH"].includes(req.method))return response({error:"Metoda niedozwolona"},405);
 if(Number(req.headers.get("content-length")||0)>7000)return response({error:"Za duże zgłoszenie"},413);
 let body;try{body=await req.json()}catch{return response({error:"Nieprawidłowy JSON"},400)}
 if(req.method==="PATCH")return qualify(req,body);
 const id=clean(body.offer_id,40);
 const full_name=clean(body.full_name,120),email=clean(body.email,180).toLowerCase(),phone=clean(body.phone,30),message=clean(body.message,1200);
 if(!UUID.test(id)||full_name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.replace(/\D/g,"").length<6||body.consent!==true)return response({error:"Nieprawidłowe dane formularza"},400);
 if(body.website)return response({ok:true,reference:"Przyjęto"},200);
 const ip=clean(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown",100);
 const hour=new Date();hour.setUTCMinutes(0,0,0);
 const ipHash=await hash("carvamo-preview-v1:"+ip);
 const {data:rate}=await db.from("cv_preview_lead_rate").select("requests").eq("ip_hash",ipHash).eq("window_start",hour.toISOString()).maybeSingle();
 if((rate?.requests||0)>=3)return response({error:"Limit zgłoszeń. Spróbuj później."},429);
 const {data:offer}=await db.from("cv_offers").select("id,dealer_id,status").eq("id",id).eq("status","published").eq("deletion_pending",false).maybeSingle();
 if(!offer)return response({error:"Oferta nie jest dostępna"},404);
 const {data:dealer}=await db.from("cv_dealers").select("id").eq("id",offer.dealer_id).eq("active",true).maybeSingle();
 if(!dealer)return response({error:"Oferta nie jest dostępna"},404);
 const attribution={};if(body.attribution&&typeof body.attribution==="object"){for(const k of allowed){const v=clean(body.attribution[k],160);if(v)attribution[k]=v}}
 const {data,error}=await db.from("cv_preview_leads").insert({offer_id:id,dealer_id:offer.dealer_id,full_name,email,phone,message,attribution}).select("id").single();
 if(error){console.error("Preview lead insert failed",error.code);return response({error:"Nie udało się zapisać zgłoszenia"},500)}
 await db.from("cv_preview_lead_rate").upsert({ip_hash:ipHash,window_start:hour.toISOString(),requests:(rate?.requests||0)+1},{onConflict:"ip_hash,window_start"});
 return response({ok:true,reference:data.id.slice(0,8).toUpperCase()},201);
});
