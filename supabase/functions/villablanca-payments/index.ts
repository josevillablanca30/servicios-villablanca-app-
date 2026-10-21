// Supabase Edge Function — Checkout Pro Mercado Pago + email de asignación.
// DEPLOY SIN CLAVES: falla cerrado hasta configurar MP_ACCESS_TOKEN,
// MP_WEBHOOK_SECRET, RESEND_API_KEY y VILLABLANCA_EMAIL_FROM como secretos.
const origin='https://lnhptqaqtzilyaigyehq.supabase.co';
const selfUrl='https://lnhptqaqtzilyaigyehq.functions.supabase.co/villablanca-payments';
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, apikey, content-type','access-control-allow-methods':'POST,GET,OPTIONS','cache-control':'no-store'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json; charset=utf-8'}});
const env=(k:string)=>Deno.env.get(k)||'';
const serviceKey=()=>env('SUPABASE_SERVICE_ROLE_KEY');
const token=()=>env('MP_ACCESS_TOKEN');
async function db(path:string,opts:RequestInit={}):Promise<any>{
 const secret=serviceKey();if(!secret)throw new Error('Base de datos no configurada');
 const resp=await fetch(origin+'/rest/v1/'+path,{...opts,headers:{apikey:secret,Authorization:'Bearer '+secret,'content-type':'application/json',...(opts.headers||{})}});
 if(!resp.ok)throw new Error('Base de datos: '+resp.status);
 const body=await resp.text();return body?JSON.parse(body):null;
}
const unit:Record<string,number>={
 'sofa-l':75000,'poltrona':25000,'sitial':20000,'silla-respaldo':6500,'silla-simple':5000,
 'respaldo-pequeno':25000,'respaldo-grande':35000,'colchon-pequeno':38080,'colchon-grande':47600,
 'alfombra-1':47600,'alfombra-2':71400,'alfombra-3':89250,
 'auto-city':25000,'auto-suv':30000,'tapiz-auto-2':40000,'tapiz-auto-3':60000
};
const extras:Record<string,{price:number,hours:number}>={
 planchado:{price:9520,hours:1},'lavado-ropa':{price:9520,hours:1},doblado:{price:9520,hours:1},closet:{price:9520,hours:1},
 refri:{price:9520,hours:1},horno:{price:9520,hours:1},vidrios:{price:3000,hours:0},hyla:{price:20000,hours:0},
 campana:{price:12000,hours:0},terraza:{price:9520,hours:1},mascotas:{price:9520,hours:1},
 cortinas:{price:9520,hours:1},'alfombras-m2':{price:9520,hours:1},balde:{price:9990,hours:0},
 aspiradora:{price:7500,hours:0},'piso-techo':{price:20000,hours:0}
};
const int=(value:any)=>Number.isSafeInteger(Number(value))?Number(value):NaN;
const err=(detail:string,status=400)=>json({error:detail},status);
function verifiedPrice(order:any,tasks:any[]):number {
 if(!tasks.length||tasks.length>15)throw Error('Orden incompleta');
 let total=0,car=false;
 for(const task of tasks){
  const qty=int(task.quantity),id=task.service_id;
  if(!(qty>=1&&qty<=25))throw Error('Cantidad no válida');
  const list=task.extras||[];if(!Array.isArray(list)||list.length>25)throw Error('Extras no válidos');
  const seen=new Set<string>();let hours=0,extraCost=0;
  for(const item of list){
   const opt=extras[item.id];const q=int(item.qty);
   if(!opt||seen.has(item.id)||!(q>=1&&q<=20))throw Error('Extra no reconocido');
   seen.add(item.id);
   if((id==='aseo-hogar')===(item.id==='piso-techo'))throw Error('Extra no aplicable al servicio');
   if(item.id==='piso-techo'&&!['tapiz-auto-2','tapiz-auto-3'].includes(id))throw Error('Extra no aplicable');
   hours+=opt.hours*q;extraCost+=opt.price*q;
  }
  if(id==='aseo-hogar'){
   const base=Number(task.base_hours),duration=Number(task.duration_hours);
   const details=task.work_details||{};
   const bedrooms=parseInt(String(details.bedrooms||'2'),10),bathrooms=parseInt(String(details.bathrooms||'1'),10);
   const min=bedrooms>=3&&bathrooms>=2?6:4;
   if(!Number.isInteger(base)||base<min||base>10||duration!==base+hours||duration>10)throw Error('Duración de aseo no válida');
   const start=String(order.slot).startsWith('Mañana')?8:13;
   if(start+duration>18)throw Error('Horario insuficiente');
   total+=(base*9520+extraCost)*qty;
  }else {
   const price=unit[id];if(!price)throw Error('Esta tarifa requiere confirmación antes del abono');
   if(list.some(x=>x.id!=='piso-techo'))throw Error('Extras no aplicables a este servicio');
   total+=(price+extraCost)*qty;
  }
  if(id==='auto-city'||id==='auto-suv')car=true;
 }
 if(car&&!['San Felipe','Los Andes'].includes(order.commune)){
  if(order.commune==='Otra comuna (consultar)')throw Error('Recargo de traslado no confirmado');
  total+=5000;
 }
 if(!Number.isInteger(total)||total<1||total>20000000)throw Error('Total fuera de rango');
 return total;
}
function compareSafe(a:Uint8Array,b:Uint8Array){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
async function webhookAuth(req:Request,id:string){
 const secret=env('MP_WEBHOOK_SECRET');if(!secret)return false;
 const sig=req.headers.get('x-signature')||'',requestId=req.headers.get('x-request-id')||'';
 const ts=sig.match(/(?:^|,)ts=(\d+)/)?.[1],v1=sig.match(/(?:^|,)v1=([0-9a-fA-F]{64})/)?.[1];
 if(!ts||!v1||!requestId||!/^\d+$/.test(id)||Math.abs(Date.now()-Number(ts)*(ts.length<=10?1000:1))>600000)return false;
 const manifest='id:'+id.toLowerCase()+';request-id:'+requestId+';ts:'+ts+';';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(manifest)));
 const given=new Uint8Array(v1.match(/../g)!.map(x=>parseInt(x,16)));
 return compareSafe(expected,given);
}
async function mpWebhook(req:Request){
 if(!env('MP_WEBHOOK_SECRET')||!token())return err('Servicio de pagos no activado',503);
 const body=await req.json().catch(()=>({}));
 const u=new URL(req.url);
 const id=String(u.searchParams.get('data.id')||body?.data?.id||'');
 if(body?.type!=='payment'&&u.searchParams.get('type')!=='payment')return json({ok:true,ignored:true});
 if(!await webhookAuth(req,id))return err('Firma de Mercado Pago no válida',401);
 const check=await fetch('https://api.mercadopago.com/v1/payments/'+id,{headers:{Authorization:'Bearer '+token()}});
 if(!check.ok)return err('No se pudo verificar el pago con Mercado Pago',502);
 const payment=await check.json();
 const orderId=String(payment.external_reference||'');
 if(!/^[0-9a-f-]{36}$/i.test(orderId))return err('Referencia desconocida',400);
 const orders=await db('vb_demo_orders?select=*&id=eq.'+encodeURIComponent(orderId)+'&limit=1');
 const o=orders?.[0];if(!o)return err('Pedido inexistente',404);
 const paid=Number(payment.transaction_amount);
 if(payment.currency_id!=='CLP'||paid!==Number(o.deposit_amount)||!o.mp_preference_id)return err('Monto o referencia incorrecta',409);
 const status=payment.status==='approved'?'Abono aprobado':payment.status==='pending'||payment.status==='in_process'?'Abono pendiente':'Abono rechazado';
 await db('vb_demo_orders?id=eq.'+orderId,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({payment_status:status,mp_payment_id:String(payment.id),paid_at:payment.status==='approved'?new Date().toISOString():null})});
 return json({ok:true});
}
async function preference(req:Request){
 if(!token()||!env('MP_WEBHOOK_SECRET'))return err('Mercado Pago requiere credencial y firma de Webhooks configuradas antes de activar cobros.',503);
 const b=await req.json().catch(()=>({}));
 const id=String(b.orderId||''),ref=String(b.clientReference||'');
 if(!/^[0-9a-f-]{36}$/i.test(id)||!(/^[A-Za-z0-9-]{18,80}$/).test(ref))return err('Identificador inválido',400);
 const o=(await db('vb_demo_orders?select=*&id=eq.'+id+'&client_reference=eq.'+encodeURIComponent(ref)))?.[0];
 if(!o)return err('Pedido no encontrado',404);
 if(o.paid_at)return err('Abono ya pagado',409);
 const tasks=await db('vb_demo_tasks?select=*&order_id=eq.'+id);
 let total=0;try{total=verifiedPrice(o,tasks)}catch(e){return err(String((e as Error).message),422)}
 const amount=Math.round(total*.3);
 const mp=await fetch('https://api.mercadopago.com/checkout/preferences',{method:'POST',headers:{
  Authorization:'Bearer '+token(),'Content-Type':'application/json','X-Idempotency-Key':'VB-'+id
 },body:JSON.stringify({
  items:[{id:'abono-'+o.display_code,title:'Abono 30% Servicios Villablanca · '+o.display_code,quantity:1,currency_id:'CLP',unit_price:amount}],
  external_reference:id,
  payer:o.customer_email?{email:o.customer_email}:undefined,
  notification_url:selfUrl+'/webhook',
  back_urls:{success:selfUrl+'/return?result=success',failure:selfUrl+'/return?result=failure',pending:selfUrl+'/return?result=pending'},
  auto_return:'approved'
 })});
 const response=await mp.json().catch(()=>({}));
 const checkoutUrl=token().startsWith('TEST-')?response.sandbox_init_point:response.init_point;
 if(!mp.ok||!response.id||!/^https:\/\/[^\s]+$/.test(checkoutUrl||''))return err('Mercado Pago no generó el enlace de pago',502);
 await db('vb_demo_orders?id=eq.'+id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({
  deposit_amount:amount,mp_preference_id:response.id,payment_status:'Pendiente de abono'
 })});
 return json({initPoint:checkoutUrl,depositAmount:amount,totalAmount:total,remaining:total-amount,orderCode:o.display_code,testMode:token().startsWith('TEST-')});
}
async function notify(req:Request){
 if(!env('RESEND_API_KEY')||!env('VILLABLANCA_EMAIL_FROM'))return err('Servicio de correo aún no configurado (Resend y dominio verificado).',503);
 const auth=req.headers.get('authorization')||'',jwt=auth.replace(/^Bearer /i,'');
 if(!jwt||!auth.startsWith('Bearer '))return err('Inicia sesión como administrador',401);
 const authResp=await fetch(origin+'/auth/v1/user',{headers:{apikey:serviceKey(),Authorization:'Bearer '+jwt}});
 if(!authResp.ok)return err('Sesión expirada',401);
 const user=await authResp.json();const member=(await db('vb_demo_admins?select=user_id&user_id=eq.'+user.id+'&limit=1'))?.[0];
 if(!member)return err('Acceso de empresa requerido',403);
 const pending=await db('vb_demo_email_outbox?select=*&status=eq.pending&limit=10');
 let sent=0;
 for(const row of pending||[]){
  const o=(await db('vb_demo_orders?select=*&id=eq.'+row.order_id))?.[0];if(!o)continue;
  const tasks=await db('vb_demo_tasks?select=*&order_id=eq.'+o.id);
  if(!tasks.length||tasks.some((t:any)=>!t.assigned_worker_id&&t.status!=='Cancelado'))continue;
  const ids=[...new Set(tasks.map((t:any)=>t.assigned_worker_id).filter(Boolean))];
  const staff=await Promise.all(ids.map(async id=>(await db('vb_demo_workers?select=name,specialty&id=eq.'+id))?.[0]));
  const esc=(s:string)=>String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]!));
  const html='<h2>Tu servicio fue agendado exitosamente</h2><p>Antes de la fecha reservada te enviamos la ficha de presentación de la persona a cargo:</p>'+
   '<p><strong>Pedido:</strong> '+esc(o.display_code)+'<br><strong>Fecha:</strong> '+esc(o.service_date)+'<br><strong>Horario:</strong> '+esc(o.slot)+'</p>'+
   staff.filter(Boolean).map((x:any)=>'<p><strong>Funcionario/a:</strong> '+esc(x.name)+'<br><strong>Especialidad:</strong> '+esc(x.specialty)+'</p>').join('')+
   '<p>Gracias por preferirnos.<br>Saluda,<br>Equipo de Administración<br>Servicios Villablanca</p>';
  const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':row.id},body:JSON.stringify({from:env('VILLABLANCA_EMAIL_FROM'),to:[row.recipient],subject:'Tu servicio fue agendado · '+o.display_code,html})});
  if(result.ok){
   await db('vb_demo_email_outbox?id=eq.'+row.id,{method:'PATCH',body:JSON.stringify({status:'sent',sent_at:new Date().toISOString(),attempts:row.attempts+1})});
   await db('vb_demo_orders?id=eq.'+o.id,{method:'PATCH',body:JSON.stringify({assignment_notified_at:new Date().toISOString()})});
   sent++;
  }else{
   await db('vb_demo_email_outbox?id=eq.'+row.id,{method:'PATCH',body:JSON.stringify({status:'failed',attempts:row.attempts+1,last_error:'Error proveedor '+result.status})});
  }
 }
 return json({sent});
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const path=new URL(req.url).pathname;
 try {
  if(req.method==='GET'&&path.endsWith('/return')){
    return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Servicios Villablanca</title><body style="font:16px system-ui;padding:40px;background:#231329;color:white"><h1>Gracias por visitar Mercado Pago</h1><p>El resultado definitivo del abono se verificará con Mercado Pago y aparecerá en el panel de Servicios Villablanca. Puedes volver a la aplicación.</p></body></html>',{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }
  if(req.method==='GET'&&path.endsWith('/status'))return json({paymentsReady:Boolean(token()&&env('MP_WEBHOOK_SECRET')),emailReady:Boolean(env('RESEND_API_KEY')&&env('VILLABLANCA_EMAIL_FROM'))});
  if(req.method==='POST'&&path.endsWith('/webhook'))return await mpWebhook(req);
  if(req.method==='POST'&&path.endsWith('/create'))return await preference(req);
  if(req.method==='POST'&&path.endsWith('/notify'))return await notify(req);
  return err('Ruta no encontrada',404);
 }catch(e){console.error('Pago/notificación:',(e as Error).message);return err('No fue posible completar esta operación. Intenta nuevamente.',500)}
});
