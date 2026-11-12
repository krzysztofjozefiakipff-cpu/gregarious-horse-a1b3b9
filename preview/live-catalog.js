// Public catalog is served by the CARVAMO OVH accounts API, not Supabase.
const API="/api/public/offers";
export async function loadPublishedOffers(){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(API,{headers:{Accept:"application/json"},credentials:"omit",cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error("Catalog HTTP "+response.status);
    const payload=await response.json();
    if(!payload||!Array.isArray(payload.offers))throw new Error("Invalid OVH catalog response");
    return payload.offers.filter(o=>o&&o.id&&o.brand&&o.model&&Number.isFinite(Number(o.gross_price))&&Number(o.gross_price)>0).map(o=>({
      id:String(o.id),brand:String(o.brand).slice(0,70),model:String(o.model).slice(0,100),
      type:String(o.body||o.fuel||"Nowy samochód").slice(0,40),price:Number(o.gross_price),
      dealer:String(o.dealer_name||"Autoryzowany dealer").slice(0,120),live:true,tone:"light"
    }));
  }finally{clearTimeout(timeout)}
}
