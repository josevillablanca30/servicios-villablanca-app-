/* Servicios Villablanca: conexión Supabase para DEMO entre teléfonos.
   Sin credenciales privadas ni pagos. Si falta configuración, permanece en modo local. */
(function(global){
 'use strict';
 const cfg=global.VILLABLANCA_CLOUD_CONFIG||{};
 const url=String(cfg.url||'').replace(/\/+$/,'');
 const key=String(cfg.publishableKey||'');
 const enabled=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.length>20;
 const SESSION_KEY='vb_demo_admin_auth_v1';
 const clean=()=>{try{localStorage.removeItem(SESSION_KEY);}catch(e){} };
 function session(){try{const raw=localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw):null;}catch(e){return null;}}
 function store(x){try{localStorage.setItem(SESSION_KEY,JSON.stringify(x));}catch(e){}}
 async function request(path,{method='GET',body=null,admin=false,token=null}={}){
  if(!enabled)throw Error('Supabase no está configurado en esta compilación de GitHub.');
  const headers={'apikey':key,'Authorization':'Bearer '+(token||key),'Accept':'application/json'};
  if(body!==null)headers['Content-Type']='application/json';
  const response=await fetch(url+path,{method,headers,...(body!==null?{body:JSON.stringify(body)}:{})});
  const text=await response.text();
  let data=null;try{data=text?JSON.parse(text):null;}catch(e){data=text;}
  if(!response.ok){
   const message=(data&&typeof data==='object'&&(data.message||data.error_description||data.error))||('Error de servidor '+response.status);
   throw Error(String(message).slice(0,220));
  }
  return data;
 }
 async function refreshSession(){
   let s=session();if(!s)throw Error('Inicia sesión para ingresar al panel de empresa.');
   if(s.expiresAt && Date.now()+60000<s.expiresAt)return s.accessToken;
   if(!s.refreshToken){clean();throw Error('La sesión expiró. Vuelve a iniciar sesión.');}
   try{
    const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refreshToken}});
    s={accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:Date.now()+(Number(data.expires_in)||3600)*1000,userId:data.user?.id||s.userId,email:s.email};
    store(s);return s.accessToken;
   }catch(e){clean();throw Error('Tu sesión expiró. Ingresa de nuevo.');}
 }
 async function signIn(email,password){
  if(!enabled)throw Error('Supabase no configurado.');
  if(typeof email!=='string'||!email.includes('@')||!password)throw Error('Ingresa correo y contraseña.');
  const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  const token=data.access_token,uid=data.user?.id;
  if(!uid||!token)throw Error('El servidor no devolvió una sesión válida.');
  const rows=await request('/rest/v1/vb_demo_admins?select=user_id&user_id=eq.'+encodeURIComponent(uid),{token});
  if(!Array.isArray(rows)||rows.length===0)throw Error('Esta cuenta no tiene autorización para administrar Servicios Villablanca.');
  store({accessToken:token,refreshToken:data.refresh_token,userId:uid,email,expiresAt:Date.now()+(Number(data.expires_in)||3600)*1000});
  return {email};
 }
 async function signOut(){const s=session();clean();if(s?.accessToken)try{await request('/auth/v1/logout',{method:'POST',token:s.accessToken});}catch(e){}}
 async function createOrder(order){
  if(!enabled)throw Error('La conexión entre teléfonos todavía no está activada.');
  if(!order || !Array.isArray(order.lines)||!order.lines.length)throw Error('Faltan servicios.');
  if(!order.clientReference){
    const uuid=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():
      'ref-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
    order.clientReference=uuid;
  }
  return request('/rest/v1/rpc/vb_submit_demo_order',{method:'POST',body:{p_request:order}});
 }
 async function snapshot(){
  const token=await refreshSession();
  const [orders,tasks,workers]=await Promise.all([
   request('/rest/v1/vb_demo_orders?select=*&order=created_at.desc&limit=120',{token}),
   request('/rest/v1/vb_demo_tasks?select=*&limit=250',{token}),
   request('/rest/v1/vb_demo_workers?select=*&order=name.asc',{token})
  ]);
  if(!Array.isArray(orders)||!Array.isArray(tasks)||!Array.isArray(workers))throw Error('Respuesta incompleta de Supabase.');
  return {orders,tasks,workers};
 }
 async function updateTask(taskId,workerId,status){
  const token=await refreshSession();
  return request('/rest/v1/rpc/vb_admin_update_task',{method:'POST',token,body:{p_task_id:taskId,p_worker_id:workerId||null,p_status:status}});
 }
 async function addWorker(name,specialty,commune){
  const token=await refreshSession();
  return request('/rest/v1/rpc/vb_admin_add_worker',{method:'POST',token,body:{p_name:name,p_specialty:specialty,p_commune:commune}});
 }
 global.VILLABLANCA_CLOUD={enabled,signIn,signOut,createOrder,snapshot,updateTask,addWorker,hasSession:()=>Boolean(session()?.refreshToken)};
})(window);
