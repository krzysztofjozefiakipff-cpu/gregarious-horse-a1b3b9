/*
 * CARVELO public inventory sync.
 * Uses only a publishable key, reads public approved inventory,
 * never queries accounts, leads, private data or service_role credentials.
 * Source: public.cv_offers + public.cv_dealers, protected by PostgreSQL RLS.
 */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./panel/config.js";

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_BODIES=new Set(["SUV","Sedan","Hatchback","Dostawczy"]);
const ALLOWED_FUELS=new Set(["Hybryda","Benzyna","Elektryczny","Diesel"]);
const REQUEST_TIMEOUT_MS=15000;
let refreshGeneration=0;

async function requestPublic(path) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  try {
    const response=await fetch(SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/"+path,{
      method:"GET",
      headers:{"apikey":SUPABASE_PUBLISHABLE_KEY,"Accept":"application/json"},
      credentials:"omit",cache:"no-store",signal:controller.signal
    });
    if(!response.ok)throw new Error("Odpowiedź API: HTTP "+response.status);
    const rows=await response.json();
    if(!Array.isArray(rows))throw new Error("Nieprawidłowe dane katalogu");
    return rows;
  } finally {clearTimeout(timer);}
}

function validateOffer(row,dealerMap){
  if(!row||!UUID_RE.test(String(row.id)) || row.status!=="published")return null;
  const price=Number(row.gross_price);
  if(!Number.isFinite(price)||price<=0||price>=100000000)return null;
  const brand=String(row.brand||"").trim().slice(0,70);
  const model=String(row.model||"").trim().slice(0,100);
  if(!brand||!model||!ALLOWED_BODIES.has(row.body)||!ALLOWED_FUELS.has(row.fuel))return null;
  if(!dealerMap.has(String(row.dealer_id)))return null; // don't show offers whose dealer is not active
  return {
    id:String(row.id),brand,model,body:row.body,fuel:row.fuel,
    price,dealer:dealerMap.get(String(row.dealer_id)),
    status:"approved",special:row.special===true,source:"remote",live:true
  };
}

async function requestPhotoRows(offerIds){
  if(!offerIds.length)return [];
  const ids=offerIds.filter(id=>UUID_RE.test(String(id)));
  if(!ids.length)return [];
  return requestPublic("cv_offer_photos?select=offer_id,processed_path,is_cover,sort_order,state,logo_applied&state=eq.approved&logo_applied=eq.true&offer_id=in.("+ids.join(",")+")&order=sort_order.asc&limit=1000");
}
async function signPhotoUrl(path){
  if(!path || !/^[0-9a-f-]+\/[0-9a-f-]+\/(?:carvelo-v1[.]png|ai\/[0-9a-f-]+[.]png)$/i.test(path))return null;
  const response=await fetch(SUPABASE_URL.replace(/\/$/,"")+"/storage/v1/object/sign/carvelo-photo-branded/"+path,{
    method:"POST",headers:{"apikey":SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({expiresIn:3600}),credentials:"omit",cache:"no-store"
  });
  if(!response.ok)return null;
  const data=await response.json();
  const signed=data?.signedURL??data?.signedUrl;
  if(typeof signed!=="string" || !signed.startsWith("/"))return null;
  return SUPABASE_URL.replace(/\/$/,"")+"/storage/v1"+signed;
}
async function loadPhotoGalleries(offers){
  if(!offers.length)return offers;
  const rows=await requestPhotoRows(offers.map(o=>o.id));
  const grouped=new Map();
  for(const row of rows){
    if(!row?.processed_path||!UUID_RE.test(String(row.offer_id)))continue;
    if(!grouped.has(row.offer_id))grouped.set(row.offer_id,[]);
    grouped.get(row.offer_id).push(row);
  }
  await Promise.all([...new Set(rows.map(r=>r.processed_path))].map(async path=>{
    const signed=await signPhotoUrl(path);
    if(signed)for(const offer of offers){
      const photo=(grouped.get(offer.id)||[]).find(p=>p.processed_path===path);
      if(photo)(offer.photos??=[]).push({url:signed,is_cover:photo.is_cover===true,sort_order:photo.sort_order??0});
    }
  }));
  for(const offer of offers){
    offer.photos=(offer.photos||[]).sort((a,b)=>Number(b.is_cover)-Number(a.is_cover)||a.sort_order-b.sort_order);
    offer.image=offer.photos[0]?.url??null;
  }
  return offers;
}

export async function refreshLiveCatalog(){
  const generation=++refreshGeneration;
  if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY){
    window.carveloReceiveLiveOffers?.([],"error","Brak konfiguracji katalogu");
    return;
  }
  try{
    const [remoteOffers,activeDealers]=await Promise.all([
      requestPublic("cv_offers?select=id,brand,model,body,fuel,gross_price,dealer_id,status,special&status=eq.published&order=created_at.desc&limit=500"),
      requestPublic("cv_dealers?select=id,name&active=eq.true&limit=500")
    ]);
    const dealers=new Map(activeDealers.filter(d=>d&&UUID_RE.test(String(d.id)))
      .map(d=>[String(d.id),String(d.name||"Dealer CARVELO").slice(0,160)]));
    const offers=remoteOffers.map(r=>validateOffer(r,dealers)).filter(Boolean);
    try { await loadPhotoGalleries(offers); }
    catch(error){console.warn("CARVELO photos:",error?.message||error);}
    if(generation===refreshGeneration)window.carveloReceiveLiveOffers?.(offers,"ready");
  }catch(error){
    if(generation===refreshGeneration){
      console.warn("CARVELO catalog fetch:",error?.message||error);
      window.carveloReceiveLiveOffers?.([],"error","Nie udało się pobrać ofert. Spróbuj ponownie.");
    }
  }
}
window.carveloRefreshLive=refreshLiveCatalog;
refreshLiveCatalog();
