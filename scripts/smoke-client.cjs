/* Pruebas de humo del cliente HTML; sin paquetes externos ni datos reales. */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
assert.equal(scripts.length,2,'Se esperan catálogo y frontend');
const handlers={};
const root={innerHTML:'',addEventListener(type,fn){handlers[type]=fn;}};
const alerts=[];
const window={scrollTo(){},addEventListener(){}};
const document={getElementById(){return root},querySelector(){return null}};
const ctx={window,document,navigator:{},location:{protocol:'file:',hostname:''},alert:m=>alerts.push(m),Intl,Date,structuredClone,console,URL,encodeURIComponent};
vm.createContext(ctx);
scripts.forEach((script,i)=>{new vm.Script(script,{filename:'inline-'+i+'.js'}).runInContext(ctx)});
const catalog=window.VILLABLANCA_CATALOG;
const {calcQuote}=window.VillablancaTest;
const order=(bedrooms,bathrooms,hours,extras={})=>[{id:'aseo-hogar',qty:1,details:{bedrooms:String(bedrooms),bathrooms:String(bathrooms),hours},extras}];
const quoted=(lines)=>calcQuote(lines,{commune:'San Felipe'});
assert.equal(quoted(order(2,1,4)).known,38080,'4 horas base');
assert.equal(quoted(order(2,1,4,{planchado:1})).known,47600,'4+1 hora planchado mismo precio/h');
const combined=[...order(2,1,4,{planchado:1}),{id:'auto-city',qty:1,details:{},extras:{}}];
assert.equal(quoted(combined).known,72600,'aseo 4h + planchado 1h + auto independiente');
assert.equal(window.VillablancaTest.scheduledHours(combined),5,'lavado de auto NO agrega horas al personal de aseo');
assert.equal(window.VillablancaTest.parallelVehicleCount(combined),1,'el vehículo necesita asignación separada');
assert.equal(window.VillablancaTest.scheduledHours(order(2,1,4,{planchado:2})),6,'dos horas de planchado se suman a la jornada de aseo');
assert.equal(quoted(order(3,2,4)).known,57120,'3 dormitorios y 2 baños exigen 6h');
assert.equal(quoted(order(2,1,4,{balde:1})).known,48070,'balde cuesta 9990');
assert.equal(quoted(order(2,1,4,{planchado:1,balde:1})).known,57590,'horas y kit sumados');
assert.equal(catalog.extras.find(e=>e.id==='balde').contents.length,12,'12 artículos en kit');
for(const x of ['planchado','lavado-ropa','doblado','closet']) {
 assert.equal(catalog.extras.find(e=>e.id===x).price,9520,x+' a 9520');
 assert.equal(catalog.extras.find(e=>e.id===x).extraHours,1,x+' suma hora');
}
const click=(action,id)=>handlers.click({target:{closest(){return {disabled:false,dataset:{action,id}}}}});
const change=(field,value)=>handlers.change({target:{dataset:{field},value,type:'select-one'}});
click('catalog');
click('selectService','aseo-hogar');
assert.match(root.innerHTML,/Ver los 12 productos incluidos/);
assert.match(root.innerHTML,/Aspirado para personas alérgicas/);
change('draft:bedrooms','3');
change('draft:bathrooms','2');
assert.match(root.innerHTML,/el mínimo es de 6 horas/);
click('addCart');
assert.match(root.innerHTML,/6 h por visita/);
const after=Date.now()+3*86400000;
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(after);
change('client:day',day);
assert.match(root.innerHTML,/Mañana · 08:00/);
assert.doesNotMatch(root.innerHTML,/<option[^>]*>Tarde · 13:00<\/option>/,'6h no caben desde 13h');
assert.match(root.innerHTML,/24 horas de anticipación/);
click('catalog');
click('selectService','auto-city');
assert.match(root.innerHTML,/Equipo independiente/,'lavado de auto pide otro trabajador');
click('addCart');
assert.match(root.innerHTML,/personal diferente al del aseo hogar/,'resumen de pedido aclara trabajo en paralelo');
assert.match(root.innerHTML,/No agregan horas a la trabajadora de aseo/,'vehículo no alarga su jornada');
assert.equal(catalog.services.filter(s=>s.category==='piscinas').length,2,'piscinas separadas');
assert.ok(catalog.services.some(s=>s.id==='industrial-cerchas'));
assert.ok(catalog.services.some(s=>s.id==='industrial-lineas'));
assert.equal(alerts.length,0);

/*
 * Regresión de la piscina fantasma: antes TODOS los pedidos se creaban
 * internamente con poolType:'Enterrada' y el resumen lo imprimía.
 * Simular la navegación real de cada tipo de servicio y el doble toque móvil.
 */
function simulateBooking(serviceId) {
 const delegated={}, node={innerHTML:'',addEventListener(type,fn){delegated[type]=fn;}};
 const appWindow={scrollTo(){},addEventListener(){}};
 const appDocument={getElementById(){return node},querySelector(){return null}};
 const sandbox={window:appWindow,document:appDocument,navigator:{},location:{protocol:'file:',hostname:''},alert(){throw Error('Alerta inesperada')},Intl,Date,structuredClone,console,URL,encodeURIComponent};
 vm.createContext(sandbox);
 scripts.forEach((sc,i)=>new vm.Script(sc,{filename:'smoke-scenario-'+i+'.js'}).runInContext(sandbox));
 const push=(action,id)=>delegated.click({target:{closest(){return {disabled:false,dataset:{action,id}}}}});
 push('catalog');
 push('selectService',serviceId);
 assert.match(node.innerHTML,/Hazlo/,serviceId+' muestra configurador');
 push('addCart');
 const first=node.innerHTML;
 push('addCart'); // Doble toque sobre el antiguo botón ya no debe añadir ni fallar
 assert.equal(node.innerHTML,first,serviceId+' ignora doble toque después de agregar');
 push('selectService','piscina-limpieza'); // Evento atrasado fuera de la pantalla de catálogo
 assert.equal(node.innerHTML,first,serviceId+' ignora selección de piscina fuera del catálogo');
 const whatsappText=appWindow.VillablancaTest.requestText();
 const count=(first.match(/class="cart-line"/g)||[]).length;
 assert.equal(count,1,serviceId+' debe crear exactamente una línea');
 return {html:first,whatsappText};
}
for(const id of ['aseo-hogar','aseo-profundo','aseo-recurrente','sofa-l','auto-city','tapiz-auto-2','vidrios-casa','industrial-hidro','jardin-pasto','mante-visita','piscina-limpieza','piscina-mantencion']){
 const {html,whatsappText}=simulateBooking(id);
 const isPool=id.startsWith('piscina-');
 if(isPool) {
   assert.match(whatsappText,/Piscina: Enterrada/,id+' conserva detalles de piscina');
 } else {
   assert.doesNotMatch(whatsappText,/Piscina:/,id+' no incluye piscina en el pedido');
   assert.doesNotMatch(whatsappText,/Tamaño: .*piscina/i,id+' no incluye piscina en detalles');
   assert.doesNotMatch(html,/Piscina: Enterrada/,id+' no muestra piscina en el resumen');
   if(id==='vidrios-casa')assert.match(whatsappText,/Lugar: Casa/,id+' conserva sus datos propios de vidrios');
   else assert.doesNotMatch(whatsappText,/Lugar: Casa|Acceso: Primer piso/,id+' no mezcla detalles de vidrios');
 }
}

console.log('OK: 12 categorías/servicios probados, sin piscina fantasma, doble toque protegido; horas, tarifas y agenda.');
