/* Panel conectado. La BD es autoridad; nunca copia datos de pedidos a localStorage. */
(function(global){
'use strict';
const api=global.VILLABLANCA_CLOUD;
let state='login',error='',message='',tab='pedidos',weekOffset=0,snap={orders:[],tasks:[],workers:[]},timer=null,refreshing=false,filter='Todos',transfers=[];
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n)||0);
const dates=s=>{const [y,m,d]=String(s||'').split('-');return [d,m,y].join('/')};
const draftAssignments={};
const statuses=['Recibido','Confirmado','Asignado','En camino','En servicio','Finalizado','Cancelado'];
function banner(){return '<div class="adm-banner">PRUEBA CONECTADA · PEDIDOS COMPARTIDOS ENTRE DISPOSITIVOS · PAGOS SIMULADOS</div>';}
function workerName(id){return snap.workers.find(w=>w.id===id)?.name||'Sin asignar';}
function isBusy(){return state==='loading'||refreshing;}
function count(){return snap.orders.length;}
function tasksFor(order){return snap.tasks.filter(t=>t.order_id===order.id);}
function badge(status){return '<span class="adm-badge adm-'+({'Recibido':'incoming','Confirmado':'confirmed','Asignado':'assigned','En camino':'transit','En servicio':'working','Finalizado':'done','Cancelado':'cancelled'}[status]||'incoming')+'">'+escape(status)+'</span>';}
function head(){
return banner()+'<div class="adm-wrap"><div class="adm-heading"><div><span class="adm-overline">SERVICIOS VILLABLANCA · NUBE</span><h1>Centro de <em>operaciones.</em></h1><p>Pedidos de prueba compartidos. Acceso privado para la empresa.</p></div><div class="adm-actions"><button data-action="cloudGoClient">← App cliente</button><button data-action="cloudReload">Actualizar</button><button data-action="cloudExport">Excel CSV</button><button data-action="cloudLogout">Cerrar sesión</button></div></div>';
}
function login(){
 return '<main class="adm-shell">'+banner()+'<div class="adm-wrap"><div class="adm-confirm" style="max-width:530px;margin:45px auto"><span class="adm-overline">SOLO PERSONAL AUTORIZADO</span><h2>Ingreso empresa</h2><p>Correo y contraseña del administrador registrados en Supabase. Los clientes no pueden ver pedidos ni personal.</p><div class="adm-form-grid" style="grid-template-columns:1fr"><label>Correo empresa<input data-cloud-email type="email" placeholder="admin@empresa.cl" autocomplete="username"></label><label>Contraseña<input data-cloud-password type="password" placeholder="Contraseña" autocomplete="current-password"></label></div><div class="adm-actions"><button data-action="cloudLogin" '+(state==='loading'?'disabled':'')+'>Entrar al centro de operaciones</button><button data-action="cloudGoClient">Volver al cliente</button></div>'+(error?'<div class="adm-notice">'+escape(error)+'</div>':'')+'</div></div></main>';
}
function days(){
 const now=new Date();now.setHours(12,0,0,0);now.setDate(now.getDate()-(now.getDay()+6)%7+7*weekOffset);
 return Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(now.getDate()+i);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')});
}
function transferFor(id){return transfers.find(t=>t.order_id===id);}
function orderView(o){
 const tasks=tasksFor(o),tr=transferFor(o.id);
 return '<article class="adm-order"><div class="adm-order-top"><b>'+escape(o.display_code)+'</b><small>'+dates(o.service_date)+' · '+escape(o.slot)+'</small></div>'+
 '<div class="adm-customer">'+escape(o.customer_name)+'</div><p>'+escape(o.address)+', '+escape(o.commune)+'<br>'+escape(o.phone)+'</p>'+
 (o.payment_method==='transfer'?'<div class="support-note"><strong>Transferencia · '+escape(tr?.decision||'Sin comprobante')+'</strong><p>Abono esperado: '+money(Math.round(Number(o.estimated_total||0)*.3))+'</p>'+(tr?'<button data-action="cloudViewTransfer" data-id="'+escape(o.id)+'">Ver / descargar comprobante</button> ':'')+(tr?.decision==='pendiente'?'<button data-action="cloudVerifyTransfer" data-id="'+escape(o.id)+'">Verifiqué ingreso en el banco</button> <button data-action="cloudRejectTransfer" data-id="'+escape(o.id)+'">Rechazar comprobante</button>':'')+(tr?.decision==='verificado'?'<p>Abono verificado. Ahora puedes asignar personal.</p><button data-action="cloudWhatsapp" data-id="'+escape(o.id)+'">Preparar WhatsApp de confirmación</button><button data-action="cloudBalance" data-id="'+escape(o.id)+'">'+(tr.collected?'Saldo registrado como cobrado':'Registrar saldo cobrado por el encargado')+'</button>':'')+'</div>':'')+
 '<div class="adm-tasks">'+tasks.map(t=>'<div class="adm-task"><div class="adm-task-head"><b>'+escape(t.name)+' ×'+t.quantity+'</b>'+badge(t.status)+'</div>'+
 '<small>'+escape(t.duration_hours==null?'Duración por coordinar':t.duration_hours+' h')+' · '+escape(workerName(t.assigned_worker_id))+'</small>'+
 ((Array.isArray(t.extras)&&t.extras.length)?'<small>Extras: '+t.extras.map(e=>escape(e.name)+' ×'+escape(e.qty)).join(' · ')+'</small>':'')+
 '<div class="adm-task-controls"><label>Personal asignado<select data-cloud-worker="'+escape(t.id)+'" '+(o.payment_method==='transfer'&&tr?.decision!=='verificado'?'disabled title="Primero verifica el abono"':'')+'><option value="">Sin asignar</option>'+snap.workers.filter(w=>w.enabled).map(w=>'<option value="'+escape(w.id)+'" '+((draftAssignments[t.id]?.worker??t.assigned_worker_id)===w.id?'selected':'')+'>'+escape(w.name)+' · '+escape(w.commune)+'</option>').join('')+'</select></label>'+
 '<label>Estado<select data-cloud-status="'+escape(t.id)+'">'+statuses.map(x=>'<option '+(x===t.status?'selected':'')+'>'+escape(x)+'</option>').join('')+'</select></label><button type="button" data-action="cloudSaveAssignment" data-id="'+escape(t.id)+'" '+(o.payment_method==='transfer'&&tr?.decision!=='verificado'?'disabled':'')+'>Guardar asignación</button>'+(o.payment_method==='transfer'&&tr?.decision!=='verificado'?'<small>Verifica primero el abono para habilitar la asignación.</small>':'')+'</div></div>').join('')+
 '</div><div class="adm-order-foot"><span>Total: '+money(o.estimated_total)+' · Abono 30%: '+money(Math.round(Number(o.estimated_total||0)*0.3))+' · Saldo 70% a cobrar por un encargado: '+money(Number(o.estimated_total||0)-Math.round(Number(o.estimated_total||0)*0.3))+' · '+escape(o.payment_status)+'</span><button data-action="cloudReceipt" data-id="'+escape(o.id)+'">Comprobante de pedido</button></div><small>El comprobante de pedido no acredita una transferencia. Verifica el ingreso en tu banco antes de confirmar el abono y asignar personal.</small></article>';
}
function ordersView(){
 const visible=snap.orders.filter(o=>filter==='Todos'||tasksFor(o).some(t=>t.status===filter));
 return '<div class="adm-section-head"><div><h2>Pedidos recibidos</h2><p>Los pedidos nuevos aparecen sin refrescar toda la aplicación.</p></div><label class="adm-filter">Mostrar <select data-cloud-filter><option>Todos</option>'+statuses.map(s=>'<option '+(s===filter?'selected':'')+'>'+s+'</option>').join('')+'</select></label></div>'+
 (visible.length?'<div class="adm-order-grid">'+visible.map(orderView).join('')+'</div>':'<div class="adm-empty"><b>No hay pedidos en esta selección.</b><p>Completa un pedido desde el otro teléfono y pulsa «Confirmar pedido de PRUEBA».</p></div>');
}
function workersView(){
 return '<div class="adm-section-head"><div><h2>Trabajadoras</h2><p>Personal ficticio de la demostración. Datos privados para la empresa.</p></div></div><div class="adm-workers">'+snap.workers.map(w=>'<article class="adm-worker"><div class="adm-avatar">'+escape(w.name.split(' ').slice(0,2).map(x=>x[0]).join(''))+'</div><div><b>'+escape(w.name)+'</b><small>'+escape(w.specialty)+'</small><small>Base: '+escape(w.commune)+'</small></div></article>').join('')+'</div>'+
 '<div class="adm-form"><h3>Agregar trabajadora de prueba</h3><div class="adm-form-grid"><label>Nombre<input data-cloud-add-name placeholder="Nombre completo"></label><label>Especialidad<input data-cloud-add-specialty value="Aseo hogar"></label><label>Comuna base<input data-cloud-add-commune value="San Felipe"></label></div><button data-action="cloudAddWorker">Guardar trabajadora</button></div>';
}
function weekView(){
 return '<div class="adm-section-head"><div><h2>Agenda semanal</h2><p>Horario 08:00–18:00. Las asignaciones se guardan en la nube.</p></div><div class="adm-week-nav"><button data-action="cloudPrev">←</button><button data-action="cloudToday">Hoy</button><button data-action="cloudNext">→</button></div></div>'+
 '<div class="adm-week">'+days().map(d=>{
 const list=snap.orders.filter(o=>o.service_date===d).flatMap(o=>tasksFor(o).filter(t=>t.assigned_worker_id&&t.status!=='Cancelado').map(t=>({o,t})));
 return '<section class="adm-day"><h3>'+escape(new Date(d+'T12:00:00').toLocaleDateString('es-CL',{weekday:'short',day:'numeric',month:'short'}))+'</h3>'+
 (list.length?list.map(({o,t})=>'<div class="adm-block"><b>'+escape(workerName(t.assigned_worker_id))+'</b><small>'+escape(o.slot)+' · '+escape(t.duration_hours==null?'Duración pendiente':t.duration_hours+' h')+'</small><span>'+escape(t.name)+'</span><small>'+escape(o.commune)+'</small>'+badge(t.status)+'</div>').join(''):'<p class="adm-no-events">Sin servicios</p>')+'</section>';
 }).join('')+'</div>';
}
function logisticsView(){
 const pending=snap.orders.flatMap(o=>tasksFor(o).filter(t=>!t.assigned_worker_id&&t.status!=='Cancelado').map(t=>({o,t})));
 return '<div class="adm-section-head"><div><h2>Logística por zona</h2><p>Sugerencias orientativas, sin tiempos de viaje o GPS ficticios.</p></div></div>'+
 (pending.length?pending.map(({o,t})=>'<article class="adm-logistic"><div><b>'+escape(t.name)+' · '+escape(o.commune)+'</b><p>'+escape(o.customer_name)+' · '+dates(o.service_date)+' · '+escape(o.slot)+'</p></div><div><b>Personal disponible para considerar</b><p>'+snap.workers.filter(w=>w.enabled).sort((a,b)=>Number(b.commune===o.commune)-Number(a.commune===o.commune)).slice(0,3).map(w=>escape(w.name)+' ('+escape(w.commune)+')').join(' · ')+'</p><small>La encargada verifica traslado y disponibilidad antes de confirmar.</small></div></article>').join(''):'<div class="adm-empty">No hay servicios pendientes de asignar.</div>');
}
function main(){
 return '<main class="adm-shell">'+head()+
 '<div class="adm-stats">'+[['Pedidos',count()],['Servicios',snap.tasks.length],['Por asignar',snap.tasks.filter(t=>!t.assigned_worker_id).length],['Monto estimado',money(snap.orders.reduce((n,o)=>n+Number(o.estimated_total||0),0))]].map(([label,value])=>'<div class="adm-stat"><small>'+escape(label)+'</small><strong>'+escape(value)+'</strong></div>').join('')+'</div>'+
 '<nav class="adm-tabs">'+[['pedidos','Pedidos'],['agenda','Agenda semanal'],['personal','Personal'],['logistica','Logística']].map(([k,label])=>'<button class="'+(tab===k?'active':'')+'" data-action="cloudTab" data-id="'+k+'">'+label+'</button>').join('')+'</nav>'+
 (error?'<div class="adm-notice" role="alert">'+escape(error)+'</div>':'')+(message?'<div class="adm-notice">'+escape(message)+'</div>':'')+
 (tab==='pedidos'?ordersView():tab==='agenda'?weekView():tab==='personal'?workersView():logisticsView())+
 '<div class="adm-bottom"><p>DATOS DE PRUEBA · Ningún pedido está pagado ni constituye boleta. Actualización automática cada 8 segundos mientras el panel está abierto.</p><span>Conectado de forma segura con Supabase</span></div></div></main>';
}
function view(){if(!api?.enabled)return '<main>Falta activar Supabase.</main>';if(state==='login'||state==='loading'&&snap.orders.length===0)return login();if(state==='error'&&snap.orders.length===0)return '<main class="adm-shell"><div class="adm-wrap"><div class="adm-notice">'+escape(error)+'</div><button data-action="cloudReload">Reintentar</button><button data-action="cloudLogout">Salir</button></div></main>';return main();}
function setError(e){error=String(e?.message||e||'No se pudo completar la operación').slice(0,220);message='';}
async function load(render){
 if(refreshing)return;refreshing=true;
 try{snap=await api.snapshot();transfers=await api.transferSummaries();state='ready';error='';}
 catch(e){setError(e);state='error';}
 finally{refreshing=false;if(render)render();}
}
function enter(render){
 if(timer){clearInterval(timer);timer=null;}
 if(api?.hasSession()){state='loading';load(render);}
 else{state='login';error='';render();}
 // La app no necesita una recarga completa para mostrar pedidos del otro celular.
 timer=setInterval(()=>{if(state==='ready'&&!refreshing&&document.querySelector('[data-cloud-live-root]'))load(render);},8000);
}
function leave(){if(timer){clearInterval(timer);timer=null;}}
function file(name,text,mime){
 if(global.VillablancaAndroid?.saveDemoFile&&typeof btoa==='function'){
 const bytes=new TextEncoder().encode(text);let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.slice(i,i+8192));
 global.VillablancaAndroid.saveDemoFile(name,mime,btoa(bin));message='Archivo guardado en Descargas.';return;
 }
 const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function csv(){
 const cols=['Pedido','Fecha','Bloque','Cliente','Teléfono','Dirección','Comuna','Servicio','Horas','Trabajadora','Estado','Total estimado','Pago'];
 const rows=[cols,...snap.orders.flatMap(o=>tasksFor(o).map(t=>[o.display_code,o.service_date,o.slot,o.customer_name,o.phone,o.address,o.commune,t.name,t.duration_hours??'Por coordinar',workerName(t.assigned_worker_id),t.status,o.estimated_total,o.payment_status]))];
 return '\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
}
function receipt(id){
 const o=snap.orders.find(x=>x.id===id);if(!o)return;
 file(o.display_code+'.txt','SERVICIOS VILLABLANCA\nPEDIDO DE PRUEBA, NO VÁLIDO COMO BOLETA\n\n'+o.display_code+'\n'+o.customer_name+'\n'+o.address+', '+o.commune+'\n'+dates(o.service_date)+' '+o.slot+'\n\n'+tasksFor(o).map(t=>t.name+' x'+t.quantity+' · '+workerName(t.assigned_worker_id)+' · '+t.status).join('\n')+'\n\nTOTAL ESTIMADO: '+money(o.estimated_total)+'\nPAGO NO REALIZADO','text/plain;charset=utf-8');
}
function handle(action,id,target,render){
 if(action==='cloudGoClient')return {handled:true,navigate:'home'};
 if(action==='cloudTab'){tab=id;render();return {handled:true};}
 if(action==='cloudPrev'){weekOffset--;render();return {handled:true};}
 if(action==='cloudToday'){weekOffset=0;render();return {handled:true};}
 if(action==='cloudNext'){weekOffset++;render();return {handled:true};}
 if(action==='cloudExport'){try{file('Villablanca-Agenda-Demo.csv',csv(),'text/csv;charset=utf-8');render();}catch(e){setError(e);render();}return {handled:true};}
 if(action==='cloudSaveAssignment'){
   const t=snap.tasks.find(t=>t.id===id);if(!t)return {handled:true};
   const worker=draftAssignments[id]?.worker??t.assigned_worker_id;
   const status=worker?'Asignado':'Recibido';
   (async()=>{try{await api.updateTask(id,worker,status);delete draftAssignments[id];message=worker?'Trabajador asignado correctamente.':'Asignación retirada.';await load(render);}catch(e){setError(e);render();}})();
   return {handled:true};
 }
 if(action==='cloudViewTransfer'){
   (async()=>{try{const r=await api.getTransferReceipt(id);if(!r)throw Error('Sin comprobante');const ext=r.mime==='application/pdf'?'pdf':r.mime==='image/png'?'png':'jpg';if(global.VillablancaAndroid?.saveDemoFile){global.VillablancaAndroid.saveDemoFile('Transferencia-'+id+'.'+ext,r.mime,r.base64);}else{const a=document.createElement('a');a.href='data:'+r.mime+';base64,'+r.base64;a.download='Transferencia-'+id+'.'+ext;document.body.appendChild(a);a.click();a.remove();}message='Comprobante descargado. Comprueba el ingreso desde tu banco antes de verificar.';render();}catch(e){setError(e);render();}})();return {handled:true};
 }
 if(action==='cloudVerifyTransfer'||action==='cloudRejectTransfer'){
   const decision=action==='cloudVerifyTransfer'?'verificado':'rechazado';
   if(!confirm(decision==='verificado'?'¿Ya comprobaste en el banco que el dinero ingresó efectivamente?':'¿Rechazar este comprobante?'))return {handled:true};
   (async()=>{try{await api.verifyTransfer(id,decision);message='Abono: '+decision;await load(render);}catch(e){setError(e);render();}})();return {handled:true};
 }
 if(action==='cloudBalance'){
   if(!confirm('¿El encargado ya recibió el saldo del 70%?'))return {handled:true};
   (async()=>{try{await api.setBalance(id,true);message='Cobro del encargado registrado.';await load(render);}catch(e){setError(e);render();}})();return {handled:true};
 }
 if(action==='cloudWhatsapp'){
   const o=snap.orders.find(x=>x.id===id);if(!o)return {handled:true};
   if(transferFor(id)?.decision!=='verificado'||tasksFor(o).some(t=>!t.assigned_worker_id)){message='Primero verifica el abono y asigna todo el personal.';render();return {handled:true};}
   const workers=[...new Set(tasksFor(o).map(t=>workerName(t.assigned_worker_id)))].join(', ');
   const msg='Hola '+o.customer_name+', somos Servicios Villablanca. Tu abono fue verificado y tu servicio quedó agendado. Pedido: '+o.display_code+'. Fecha: '+dates(o.service_date)+'. Horario: '+o.slot+'. Personal asignado: '+workers+'. Saldo pendiente a cobrar por un encargado: '+money(Number(o.estimated_total||0)-Math.round(Number(o.estimated_total||0)*.3))+'. Gracias por preferirnos.';
   const phone=String(o.phone||'').replace(/\D/g,'');if(!/^(?:56)?9\d{8}$/.test(phone)){setError('Teléfono no válido para WhatsApp.');render();return {handled:true};}
   global.open('https://wa.me/'+(phone.startsWith('56')?phone:'56'+phone)+'?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');
   message='WhatsApp abierto: revisa y pulsa Enviar manualmente.';render();return {handled:true};
 }
 if(action==='cloudReceipt'){try{receipt(id);render();}catch(e){setError(e);render();}return {handled:true};}
 if(action==='cloudReload'){state='loading';load(render);render();return {handled:true};}
 if(action==='cloudLogin'){
 const email=document.querySelector('[data-cloud-email]')?.value,password=document.querySelector('[data-cloud-password]')?.value;
 state='loading';error='';render();
 (async()=>{try{await api.signIn(email,password);message='Acceso autorizado.';await load(render);}catch(e){setError(e);state='login';render();}})();return {handled:true};
 }
 if(action==='cloudLogout'){leave();api.signOut().finally(()=>{state='login';snap={orders:[],tasks:[],workers:[]};render();});return {handled:true};}
 if(action==='cloudAddWorker'){
 const name=document.querySelector('[data-cloud-add-name]')?.value||'';
 const specialty=document.querySelector('[data-cloud-add-specialty]')?.value||'Aseo hogar';
 const commune=document.querySelector('[data-cloud-add-commune]')?.value||'San Felipe';
 (async()=>{try{await api.addWorker(name,specialty,commune);message='Trabajadora incorporada.';await load(render);}catch(e){setError(e);render();}})();return {handled:true};
 }
 return {handled:false};
}
function select(target,render){
 if(target.hasAttribute('data-cloud-filter')){filter=target.value;render();return {handled:true};}
 const taskId=target.dataset.cloudWorker||target.dataset.cloudStatus;
 if(!taskId)return {handled:false};
 const task=snap.tasks.find(x=>x.id===taskId);if(!task)return {handled:false};
 if(target.hasAttribute('data-cloud-worker')){draftAssignments[taskId]={worker:target.value};message='Seleccionado. Pulsa Guardar asignación para confirmar.';return {handled:true};}
 const worker=draftAssignments[taskId]?.worker??task.assigned_worker_id;
 (async()=>{try{await api.updateTask(taskId,worker,target.value);message='Estado actualizado.';await load(render);}catch(e){setError(e);render();}})();
 return {handled:true};
}
global.VILLABLANCA_LIVE={view:()=>'<div data-cloud-live-root>'+view()+'</div>',enter,leave,handle,select,getSnapshot:()=>snap};
})(window);
