import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./panel/config.js";
const API=SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/";
const headers={"apikey":SUPABASE_PUBLISHABLE_KEY,"Accept":"application/json"};
async function get(path){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);try{const r=await fetch(API+path,{method:"GET",headers,credentials:"omit",cache:"no-store",signal:controller.signal});if(!r.ok)throw new Error("HTTP "+r.status);return await r.json()}finally{clearTimeout(timer)}}
function valid(r,dealers){const price=Number(r.gross_price);return r&&r.status==="published"&&r.brand&&r.model&&Number.isFinite(price)&&price>0&&price<100000000&&dealers.has(r.dealer_id)}
export async function loadPublishedOffers(){
const [offers,active]=await Promise.all([get("cv_offers?select=id,brand,model,body,fuel,gross_price,dealer_id,status,special&status=eq.published&order=created_at.desc&limit=100"),get("cv_dealers?select=id,name&active=eq.true&limit=500")]);
if(!Array.isArray(offers)||!Array.isArray(active))throw new Error("Invalid public catalog response");
const dealers=new Map(active.map(d=>[d.id,d.name]));
return offers.filter(o=>valid(o,dealers)).map(o=>({id:o.id,brand:String(o.brand).slice(0,70),model:String(o.model).slice(0,100),type:String(o.body||o.fuel||"Nowy samochód").slice(0,40),price:Number(o.gross_price),dealer:String(dealers.get(o.dealer_id)||"Autoryzowany dealer").slice(0,120),live:true,tone:"light"}));
}
