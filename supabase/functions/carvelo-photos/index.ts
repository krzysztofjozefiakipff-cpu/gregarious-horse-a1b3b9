import { Image } from "jsr:@matmen/imagescript@3.13.1";
import { withSupabase } from "npm:@supabase/server@1.9.2";

// Official CARVELO brand asset: same SVG as assets/brand/carvelo-wordmark-on-dark.svg.
// Never reconstruct the logo with generative AI, random fonts or browser-provided images.
const LOGO_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"943\" height=\"166\" viewBox=\"0 0 943 166\" role=\"img\" aria-label=\"CARVELO\"><title>CARVELO — oficjalny logotyp</title><g><path fill=\"#F8FAFD\" transform=\"translate(6 148) scale(0.096644295 -0.096644295)\" d=\"M774 -24C1110 -24 1366 184 1416 509H1148C1106 320 966 213 776 213C502 213 338 424 338 744C338 1066 503 1277 776 1277C967 1277 1107 1169 1147 979H1416C1366 1305 1110 1514 774 1514C363 1514 72 1212 72 744C72 279 363 -24 774 -24Z\"/><path fill=\"#F8FAFD\" transform=\"translate(151 148) scale(0.096644295 -0.096644295)\" d=\"M13 0H297L419 356H997L1116 0H1407L877 1490H545ZM493 573 565 783C610 920 655 1063 711 1251C767 1063 811 920 855 783L925 573Z\"/><path fill=\"#F8FAFD\" transform=\"translate(290 148) scale(0.096644295 -0.096644295)\" d=\"M124 0H388V542H688C691 542 693 542 695 542L975 0H1266L955 590C1132 662 1238 811 1238 1014C1238 1306 1033 1490 705 1490H124ZM388 760V1266H690C868 1266 978 1169 978 1014C978 858 868 760 692 760Z\"/><path fill=\"#D7192D\" transform=\"translate(419 148) scale(0.096644295 -0.096644295)\" d=\"M545 0H874L1396 1490H1113L853 707C814 581 768 429 712 240C655 429 608 581 568 707L299 1490H13Z\"/><path fill=\"#F8FAFD\" transform=\"translate(557 148) scale(0.096644295 -0.096644295)\" d=\"M124 0H1159V229H388V644H1101V869H388V1261H1159V1490H124Z\"/><path fill=\"#F8FAFD\" transform=\"translate(677 148) scale(0.096644295 -0.096644295)\" d=\"M124 0H1079V229H388V1490H124Z\"/><path fill=\"#F8FAFD\" transform=\"translate(788 148) scale(0.096644295 -0.096644295)\" d=\"M766 -24C1165 -24 1460 279 1460 744C1460 1211 1165 1514 766 1514C367 1514 72 1211 72 744C72 280 367 -24 766 -24ZM766 213C522 213 338 404 338 744C338 1085 522 1277 766 1277C1009 1277 1193 1085 1193 744C1193 404 1009 213 766 213Z\"/></g></svg>";
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

  if(action==="list") {
    const r=await supabase.from("cv_offer_photos")
      .select("id,offer_id,photo_type,background_mode,state,is_cover,sort_order,logo_applied,logo_version,processed_path,created_at")
      .eq("offer_id",offerId).order("sort_order",{ascending:true}).order("created_at");
    if(r.error)throw r.error;
    const items=await Promise.all((r.data??[]).map(async(photo)=>{
      const signed=await supabaseAdmin.storage.from(BUCKET_MARKED).createSignedUrl(photo.processed_path,180);
      return {...photo,preview_url:signed.data?.signedUrl??null,processed_path:undefined};
    }));
    return json(req,{photos:items});
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
    const by=Math.max(0,image.height-badgeH-padding);
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
      return json(req,{ok:true,photo_id:photoId,state:"review",
        message:"Zapisano zdjęcie z logo CARVELO. Oczekuje na akceptację.",
        background_mode:"original"});
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
