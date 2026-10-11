import {timingSafeEqual} from 'node:crypto';

export function notificationHandler({secret,verify,send,claim,finish}) {
 return async request=>{
  if(request.method!=='POST')return new Response(null,{status:405});
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(!secret||Buffer.byteLength(supplied)!==Buffer.byteLength(secret)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(secret)))return new Response(null,{status:401});
  let body;try{body=await request.json();}catch{return new Response(null,{status:400});}
  if(!['verify','test','dispatch'].includes(body.mode))return new Response(null,{status:400});
  try{
   if(body.mode==='verify'){await verify();return Response.json({smtpVerified:true});}
   if(body.mode==='test'){await send({test:true});return Response.json({smtpAccepted:true});}
   const rows=await claim();let sent=0,failed=0;
   for(const row of rows){
    try{await send(row);}catch(error){
     // SMTP timeout may occur after acceptance; hold for human verification rather than send twice.
     const uncertain=['ETIMEDOUT','ESOCKET','ECONNECTION'].includes(error.code);
     await finish(row,uncertain?'UNKNOWN':'FAILED',String(error.code||'SMTP_ERROR').slice(0,60));failed++;continue;
    }
    await finish(row,'SENT','');sent++;
   }
   return Response.json({sent,failed});
  }catch{return Response.json({error:'NOTIFICATION_FAILED'},{status:502});}
 };
}
