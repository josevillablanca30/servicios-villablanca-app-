/* Servicios Villablanca - operaciones DEMO. Sin servidor, sin cobros, sin datos reales. */
(function(global){
'use strict';
const ORDERS_KEY='sv_demo_orders_2026_v1', WORKERS_KEY='sv_demo_workers_2026_v1';
const STATUSES=['Recibido','Confirmado','Asignado','En camino','En servicio','Finalizado','Cancelado'];
const DEFAULT_WORKERS=[
 {id:'w1',name:'Camila Torres',specialty:'Aseo hogar y planchado',commune:'San Felipe',enabled:true},
 {id:'w2',name:'Valentina Soto',specialty:'Aseo hogar y tapices',commune:'Santa María',enabled:true},
 {id:'w3',name:'Fernanda Morales',specialty:'Vidrios y limpieza detallada',commune:'Los Andes',enabled:true},
 {id:'w4',name:'Javiera Muñoz',specialty:'Vehículos y tapices',commune:'San Felipe',enabled:true}
];
const mem={};
let tab='pedidos', selected='all', weekShift=0, notice='';
function read(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):structuredClone(fallback);}catch(e){return mem[key]?structuredClone(mem[key]):structuredClone(fallback);}}
function save(key,value){mem[key]=structuredClone(value);try{localStorage.setItem(key,JSON.stringify(value));}catch(e){notice='Almacenamiento limitado: estos cambios podrían perderse al cerrar la aplicación.';}}
const orders=()=>read(ORDERS_KEY,[]);
const workers=()=>read(WORKERS_KEY,DEFAULT_WORKERS);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n)||0);
const pad=n=>String(n).padStart(2,'0');
const isoDay=d=>{const x=new Date(d);return x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate());};
const dmy=s=>{if(!s)return 'Por definir';const [y,m,d]=s.split('-');return d+'/'+m+'/'+y;};
const hrs=n=>n===null||n===undefined?'Por estimar':n+' h';
const startHour=s=>String(s||'').startsWith('Tarde')?13:8;
const statusClass=s=>({'Recibido':'incoming','Confirmado':'confirmed','Asignado':'assigned','En camino':'transit','En servicio':'working','Finalizado':'done','Cancelado':'cancelled'}[s]||'incoming');
function splitTasks(lines){
 return (lines||[]).map((line,i)=>({
   id:'t'+(i+1),serviceId:line.id||'',name:line.name||'Servicio',
   category:line.category||'',extras:Array.isArray(line.extras)?line.extras:[],
   count:Math.max(1,Number(line.qty)||1),durationHours:Number.isFinite(line.durationHours)?line.durationHours:null,
   staffId:null,status:'Recibido',startHour:null,notes:line.note||''
 }));
}
function createOrder(order){
 if(!order||!Array.isArray(order.lines)||!order.lines.length)throw new Error('No hay servicios para registrar.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(order.date||'')))throw new Error('Fecha de servicio inválida.');
 const all=orders(), id='VB-'+new Date().toISOString().replace(/\D/g,'').slice(2,14)+'-'+Math.floor(Math.random()*900+100);
 const next={
 id,createdAt:new Date().toISOString(),demo:true,source:'cliente-este-dispositivo',
 customer:String(order.customer||'Cliente de prueba').slice(0,90),
 phone:String(order.phone||'').slice(0,30),commune:String(order.commune||'').slice(0,90),
 address:String(order.address||'').slice(0,180),date:String(order.date),slot:String(order.slot||'Mañana · 08:00'),
 notes:String(order.notes||'').slice(0,500),total:Number(order.total)||0,paymentMethod:String(order.paymentMethod||'demo'),
 paymentStatus:'No cobrado · simulación',tasks:splitTasks(order.lines),history:[{at:new Date().toISOString(),event:'Pedido de demostración recibido'}]
 };
 all.unshift(next);save(ORDERS_KEY,all);notice='Pedido '+id+' recibido en este dispositivo. No se envió a otro celular.';return next;
}
function amendOrder(id,fn){const all=orders(),o=all.find(x=>x.id===id);if(!o)return false;fn(o);save(ORDERS_KEY,all);return true;}
function displayDays(){
 const t=new Date();t.setHours(12,0,0,0);const dow=(t.getDay()+6)%7;t.setDate(t.getDate()-dow+weekShift*7);
 return Array.from({length:7},(_,i)=>{const d=new Date(t);d.setDate(t.getDate()+i);return isoDay(d);});
}
function byDayAndWorker(order,task,workerId){
 if(!task.durationHours||!workerId)return false;
 const base=task.startHour??startHour(order.slot),end=base+task.durationHours;
 return orders().some(other=>other.date===order.date&&other.id!==order.id&&other.tasks.some(x=>x.staffId===workerId&&x.durationHours&&x.status!=='Cancelado'&&
 (base<(x.startHour??startHour(other.slot))+x.durationHours)&&((x.startHour??startHour(other.slot))<end)))||
 order.tasks.some(x=>x.id!==task.id&&x.staffId===workerId&&x.durationHours&&x.status!=='Cancelado'&&base<(x.startHour??startHour(order.slot))+x.durationHours&&(x.startHour??startHour(order.slot))<end);
}
function assign(orderId,taskId,workerId){
 const o=orders().find(x=>x.id===orderId),t=o?.tasks.find(x=>x.id===taskId);
 if(!o||!t)return {ok:false,message:'No existe esta tarea.'};
 if(workerId&&byDayAndWorker(o,t,workerId))return {ok:false,message:'Esa trabajadora ya tiene otro servicio superpuesto. Revisa su agenda.'};
 const w=workers().find(x=>x.id===workerId&&x.enabled);
 if(workerId&&!w)return {ok:false,message:'La trabajadora no está disponible.'};
 amendOrder(orderId,x=>{const task=x.tasks.find(y=>y.id===taskId);task.staffId=workerId||null;task.startHour=startHour(x.slot);task.status=workerId?'Asignado':'Recibido';x.history.push({at:new Date().toISOString(),event:workerId?'Asignado '+task.name+' a '+w.name:'Asignación retirada de '+task.name});});
 notice=workerId?'Trabajadora asignada. Revisa la agenda semanal.':'Asignación retirada.';return {ok:true};
}
function setStatus(orderId,taskId,status){
 if(!STATUSES.includes(status))return {ok:false,message:'Estado desconocido'};
 const o=orders().find(x=>x.id===orderId),task=o?.tasks.find(x=>x.id===taskId);
 if(!task)return {ok:false,message:'No existe ese servicio'};
 if(['En camino','En servicio','Finalizado'].includes(status)&&!task.staffId)return {ok:false,message:'Asigna una trabajadora antes de iniciar o finalizar el servicio.'};
 amendOrder(orderId,x=>{const t=x.tasks.find(y=>y.id===taskId);t.status=status;x.history.push({at:new Date().toISOString(),event:t.name+' → '+status});});
 notice='Estado actualizado: '+status;return {ok:true};
}
function addWorker(name,specialty,commune){
 name=String(name||'').trim();if(name.length<3||name.length>70)return {ok:false,message:'Ingresa nombre y apellido (3–70 caracteres).'};
 const all=workers();all.push({id:'w'+Date.now(),name,specialty:String(specialty||'Aseo hogar').slice(0,100),commune:String(commune||'San Felipe').slice(0,80),enabled:true});save(WORKERS_KEY,all);notice='Trabajadora añadida a la demostración.';return {ok:true};
}
function reset(){save(ORDERS_KEY,[]);save(WORKERS_KEY,DEFAULT_WORKERS);notice='Se eliminaron solo los datos de demostración de este dispositivo.';tab='pedidos';selected='all';}
const statusChip=(s)=>'<span class="adm-badge adm-'+statusClass(s)+'">'+esc(s)+'</span>';
const taskDuration=task=>task.durationHours==null?'Duración por coordinar':hrs(task.durationHours);
function summary(){
 const all=orders(), tasks=all.flatMap(o=>o.tasks.map(t=>({...t,order:o})));
 const pending=tasks.filter(t=>t.status==='Recibido').length,assigned=tasks.filter(t=>t.staffId).length;
 const today=isoDay(new Date());const projected=all.filter(o=>o.date>=today).reduce((a,x)=>a+Number(x.total||0),0);
 return '<div class="adm-stats">'+[
   ['Solicitudes',all.length],['Por asignar',pending],['Servicios asignados',assigned],['Total estimado',money(projected)]
 ].map(([k,v])=>'<div class="adm-stat"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('')+'</div>';
}
function orderCard(o){
 return '<article class="adm-order"><div class="adm-order-top"><b>'+esc(o.id)+'</b><small>'+dmy(o.date)+' · '+esc(o.slot)+'</small></div>'+
 '<div class="adm-customer">'+esc(o.customer)+'</div><p>'+esc(o.address)+', '+esc(o.commune)+'</p>'+
 '<div class="adm-tasks">'+o.tasks.map(t=>{
 const w=workers().find(x=>x.id===t.staffId);
 return '<div class="adm-task"><div class="adm-task-head"><b>'+esc(t.name)+' ×'+t.count+'</b>'+statusChip(t.status)+'</div><small>'+esc(taskDuration(t))+(w?' · '+esc(w.name):' · Personal por asignar')+'</small>'+
 (t.extras.length?'<small>Extras: '+t.extras.map(x=>esc(x.name)+' ×'+Number(x.qty||1)).join(', ')+'</small>':'')+
 '<div class="adm-task-controls"><label>Trabajadora<select data-demo-assign="'+esc(o.id)+'|'+esc(t.id)+'"><option value="">Sin asignar</option>'+
 workers().filter(x=>x.enabled).map(x=>'<option value="'+esc(x.id)+'" '+(x.id===t.staffId?'selected':'')+'>'+esc(x.name)+' · '+esc(x.commune)+'</option>').join('')+'</select></label>'+
 '<label>Estado<select data-demo-status="'+esc(o.id)+'|'+esc(t.id)+'">'+STATUSES.map(x=>'<option '+(x===t.status?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label></div></div>';
 }).join('')+'</div><div class="adm-order-foot"><span>'+money(o.total)+' · '+esc(o.paymentStatus)+'</span><button data-action="demoReceipt" data-id="'+esc(o.id)+'">Comprobante de pedido</button></div></article>';
}
function ordersView(){
 const all=orders().filter(o=>selected==='all'||o.tasks.some(t=>t.status===selected));
 return '<div class="adm-section-head"><div><h2>Pedidos recibidos</h2><p>Una solicitud puede generar varias tareas para trabajadoras diferentes.</p></div><label class="adm-filter">Mostrar <select data-demo-filter><option value="all">Todos</option>'+STATUSES.map(x=>'<option '+(selected===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label></div>'+
 (all.length?'<div class="adm-order-grid">'+all.map(orderCard).join('')+'</div>':'<div class="adm-empty"><b>No hay pedidos todavía.</b><p>En la app del cliente termina un pedido y pulsa «Confirmar pedido de prueba». Al volver aquí aparecerá si usas la misma instalación.</p></div>');
}
function weekView(){
 const days=displayDays(),all=orders();
 const tasks=all.flatMap(o=>o.tasks.filter(t=>t.staffId&&t.status!=='Cancelado').map(t=>({...t,order:o,worker:workers().find(w=>w.id===t.staffId)})));
 return '<div class="adm-section-head"><div><h2>Agenda semanal</h2><p>Asignaciones por trabajadora y horario, de 08:00 a 18:00.</p></div><div class="adm-week-nav"><button data-action="demoWeekPrev">← Semana</button><button data-action="demoWeekToday">Hoy</button><button data-action="demoWeekNext">Semana →</button></div></div>'+
 '<div class="adm-week">'+days.map(date=>'<section class="adm-day"><h3>'+new Date(date+'T12:00:00').toLocaleDateString('es-CL',{weekday:'short',day:'numeric',month:'short'})+'</h3>'+
 (tasks.filter(t=>t.order.date===date).length?tasks.filter(t=>t.order.date===date).map(t=>'<div class="adm-block"><b>'+esc(t.worker?.name||'Sin asignar')+'</b><small>'+esc(t.order.slot)+' · '+esc(taskDuration(t))+'</small><span>'+esc(t.name)+'</span><small>'+esc(t.order.commune)+'</small>'+statusChip(t.status)+'</div>').join(''):'<p class="adm-no-events">Sin servicios</p>')+'</section>').join('')+'</div>';
}
function workersView(){
 return '<div class="adm-section-head"><div><h2>Equipo de trabajo</h2><p>Personal de ejemplo. En producción se requerirán cuentas y permisos.</p></div></div><div class="adm-workers">'+workers().map(w=>'<article class="adm-worker"><div class="adm-avatar">'+esc(w.name.split(/\s+/).map(s=>s[0]).slice(0,2).join(''))+'</div><div><b>'+esc(w.name)+'</b><small>'+esc(w.specialty)+'</small><small>Base: '+esc(w.commune)+'</small></div></article>').join('')+'</div>'+
 '<div class="adm-form"><h3>Agregar trabajadora a esta prueba</h3><div class="adm-form-grid"><label>Nombre completo<input data-demo-worker-name placeholder="Ej. Andrea Pérez" maxlength="70"></label><label>Especialidad<input data-demo-worker-specialty placeholder="Ej. Aseo hogar" maxlength="100"></label><label>Comuna base<input data-demo-worker-commune value="San Felipe" maxlength="80"></label></div><button data-action="demoAddWorker">Añadir trabajadora</button></div>';
}
function logisticsView(){
 const all=orders(),pending=all.flatMap(o=>o.tasks.filter(t=>!t.staffId&&t.status!=='Cancelado').map(t=>({...t,order:o})));
 return '<div class="adm-section-head"><div><h2>Organización de rutas</h2><p>Recomendaciones orientativas por comuna; sin GPS ni tiempos de traslado inventados.</p></div></div>'+
 (pending.length?pending.map(t=>{
 const list=workers().filter(w=>w.enabled).sort((a,b)=>Number(b.commune===t.order.commune)-Number(a.commune===t.order.commune));
 return '<article class="adm-logistic"><div><b>'+esc(t.name)+' · '+esc(t.order.commune)+'</b><p>'+esc(t.order.customer)+' · '+dmy(t.order.date)+' · '+esc(t.order.slot)+'</p><small>Duración '+esc(taskDuration(t))+' · Falta asignación</small></div><div><strong>Personal a considerar</strong><p>'+list.slice(0,3).map(w=>esc(w.name)+(w.commune===t.order.commune?' (misma comuna)':' ('+esc(w.commune)+')')).join(' · ')+'</p><small>Verifica disponibilidad real y tiempos de traslado antes de asignar.</small></div></article>';
 }).join(''):'<div class="adm-empty">No hay servicios por asignar.</div>');
}
function view(){
 const all=orders();
 return '<main class="adm-shell"><div class="adm-banner">DEMOSTRACIÓN · DATOS GUARDADOS SOLO EN ESTE DISPOSITIVO · SIN COBROS NI BOLETAS</div>'+
 '<div class="adm-wrap"><div class="adm-heading"><div><span class="adm-overline">SERVICIOS VILLABLANCA</span><h1>Centro de <em>operaciones.</em></h1><p>Así verá la empresa sus pedidos y cómo organiza a su equipo.</p></div><div class="adm-actions"><button data-action="demoGoClient">← Ver app cliente</button><button data-action="demoExport">Exportar para Excel</button></div></div>'+summary()+
 '<nav class="adm-tabs" aria-label="Gestión de pedidos">'+[['pedidos','Pedidos'],['agenda','Agenda semanal'],['personal','Personal'],['logistica','Logística']].map(([k,v])=>'<button data-action="demoTab" data-id="'+k+'" class="'+(tab===k?'active':'')+'">'+v+'</button>').join('')+'</nav>'+
 (notice?'<div class="adm-notice">'+esc(notice)+'</div>':'')+
 (tab==='pedidos'?ordersView():tab==='agenda'?weekView():tab==='personal'?workersView():logisticsView())+
 '<div class="adm-bottom"><p>Los pedidos de esta prueba no están sincronizados entre teléfonos. Las asignaciones aquí no envían mensajes a trabajadoras.</p><button data-action="demoReset">Restablecer datos de demostración</button></div></div></main>';
}
function receipt(id){
 const o=orders().find(x=>x.id===id);if(!o)return '';
 return 'SERVICIOS VILLABLANCA · COMPROBANTE DEMOSTRATIVO\nNO VÁLIDO COMO BOLETA ELECTRÓNICA\n\n'+o.id+'\nFecha: '+o.date+' · '+o.slot+'\nCliente: '+o.customer+'\nDirección: '+o.address+', '+o.commune+'\n\n'+o.tasks.map(t=>t.name+' ×'+t.count+' · '+taskDuration(t)+' · Trabajadora: '+(workers().find(x=>x.id===t.staffId)?.name||'Por asignar')+' · '+t.status).join('\n')+'\n\nTotal ESTIMADO: '+money(o.total)+'\nPago: NO REALIZADO (DEMO)\n';
}
function download(name,data,mime){
 try{
 const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);return true;
 }catch(e){notice='La descarga no está habilitada en este navegador. Intenta abrir desde Chrome o computador.';return false;}
}
function exportCsv(){
 const delim=';';
 const cell=x=>'"'+String(x==null?'':x).replace(/"/g,'""')+'"';
 const head=['Pedido','Fecha','Bloque','Cliente','Teléfono','Dirección','Comuna','Servicio','Cantidad','Extras','Duración horas','Trabajadora','Especialidad','Estado','Monto estimado CLP','Pago'];
 const data=[head,...orders().flatMap(o=>o.tasks.map(t=>[o.id,o.date,o.slot,o.customer,o.phone,o.address,o.commune,t.name,t.count,t.extras.map(e=>e.name+' x'+e.qty).join(' | '),t.durationHours??'Por estimar',workers().find(w=>w.id===t.staffId)?.name||'Por asignar',t.category,t.status,o.total,'Pago demo no realizado']))].map(row=>row.map(cell).join(delim)).join('\r\n');
 return download('Villablanca-agenda-'+isoDay(new Date())+'.csv','\ufeff'+data,'text/csv;charset=utf-8');
}
function handle(action,id,target){
 if(action==='demoGoClient')return {navigate:'home'};
 if(action==='demoTab'){tab=id||'pedidos';notice='';return {handled:true};}
 if(action==='demoWeekPrev'){weekShift--;return {handled:true};}
 if(action==='demoWeekNext'){weekShift++;return {handled:true};}
 if(action==='demoWeekToday'){weekShift=0;return {handled:true};}
 if(action==='demoExport'){exportCsv();return {handled:true};}
 if(action==='demoReset'){if(confirm('¿Eliminar todos los pedidos y trabajadoras de prueba de este dispositivo?'))reset();return {handled:true};}
 if(action==='demoReceipt'){const txt=receipt(id);if(txt)download('Pedido-'+id+'.txt',txt,'text/plain;charset=utf-8');return {handled:true};}
 if(action==='demoAddWorker'){
 const name=document.querySelector('[data-demo-worker-name]')?.value,sp=document.querySelector('[data-demo-worker-specialty]')?.value,co=document.querySelector('[data-demo-worker-commune]')?.value;
 const result=addWorker(name,sp,co);if(!result.ok)notice=result.message;return {handled:true};
 }
 return {handled:false};
}
function handleSelect(target){
 if(target.hasAttribute('data-demo-filter')){selected=target.value;return {handled:true};}
 if(target.hasAttribute('data-demo-assign')){const [o,t]=target.dataset.demoAssign.split('|');const r=assign(o,t,target.value);if(!r.ok)notice=r.message;return {handled:true};}
 if(target.hasAttribute('data-demo-status')){const [o,t]=target.dataset.demoStatus.split('|');const r=setStatus(o,t,target.value);if(!r.ok)notice=r.message;return {handled:true};}
 return {handled:false};
}
global.VILLABLANCA_DEMO={createOrder,view,handle,handleSelect,orders,workers,receipt,exportCsv,reset,assign,setStatus};
})(window);
