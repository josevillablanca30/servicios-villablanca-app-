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
const verifiedSofas=[['sofa-l',75000,22500],['sofa-3',50000,15000],['sofa-2',45000,13500],['sofa-1',38080,11424]];
for(const [id,price,deposit] of verifiedSofas){
 const service=catalog.services.find(x=>x.id===id);
 assert.ok(service,'debe existir '+id);
 assert.equal(service.price,price,id+' precio oficial publicado');
 assert.equal(service.status,'publicado',id+' no debe permanecer a cotizar');
 assert.equal(service.conflict,undefined,id+' debe eliminar lista de precios contradictorios');
 const quote=quoted([{id,qty:1,details:{},extras:{}}]);
 assert.equal(quote.known,price,id+' cobro por unidad');
 assert.equal(quote.allKnown,true,id+' pasa al checkout sin cotización');
 assert.equal(Math.round(quote.known*0.3),deposit,id+' abono 30% exacto');
}
assert.equal(quoted([{id:'sofa-3',qty:2,details:{},extras:{}}]).known,100000,'cantidad 2 cobra 2 unidades de sofá 3 cuerpos');

const maintenanceReferences=[
 ['armado-mueble-basico',25000],['armado-mueble-grande',45000],
 ['instalacion-roller',15000],['cambio-chapa',20000],
 ['instalacion-decoracion',15000]
];
for(const [id,minimum] of maintenanceReferences){
 const service=catalog.services.find(s=>s.id===id);
 assert.ok(service,id+' existe en el catálogo');
 assert.equal(service.referencePrice,minimum,id+' precio desde correcto');
 assert.equal(service.price,null,id+' NO debe cobrarse como precio fijo');
 assert.equal(service.pricing,'desde',id+' referencia sujeta a evaluación');
 const quote=quoted([{id,qty:1,details:{},extras:{}}]);
 assert.equal(quote.allKnown,false,id+' debe ir a cotización y no cobrar abono automático');
}


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
/* Los tres extras de Áreas especiales ahora tienen precio por hora, no precio pendiente. */
for(const id of ['mascotas','cortinas','alfombras-m2']){
 const e=catalog.extras.find(x=>x.id===id);
 assert.equal(e.price,9520,id+' debe costar $9.520 por hora');
 assert.equal(e.unit,'hora',id+' se contrata por hora, no por pieza ni m²');
 assert.equal(e.extraHours,1,id+' agrega 1 hora a la visita');
 assert.equal(quoted(order(2,1,4,{[id]:1})).known,47600,id+' suma 1 hora y $9.520');
 assert.equal(window.VillablancaTest.scheduledHours(order(2,1,4,{[id]:1})),5,id+' reserva 5 horas');
 assert.equal(quoted(order(2,1,4,{[id]:1})).allKnown,true,id+' no bloquea el pago demo por cotización');
}
assert.equal(quoted(order(2,1,4,{'mascotas':1,'cortinas':1,'alfombras-m2':1})).known,66640,'4h + 3 extras = 7h y $66.640');
assert.equal(window.VillablancaTest.scheduledHours(order(2,1,4,{'mascotas':1,'cortinas':1,'alfombras-m2':1})),7,'3 extras = +3 horas');
assert.equal(quoted(order(2,1,4,{'mascotas':1,'balde':1,'hyla':1})).known,77590,'precio hora y adicionales fijos contabilizados');

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
assert.match(root.innerHTML,/4 h de aseo \+ 1 h de planchado = 5 h por \$47\.600/,'la explicación se entiende con ejemplo');
assert.doesNotMatch(root.innerHTML,/Las actividades identificadas/,'eliminar jerga ambigua');
assert.doesNotMatch(root.innerHTML,/Valor por confirmar/,'los tres extras ahora tienen precio');
click('incExtra','mascotas');
assert.match(root.innerHTML,/4 h aseo \+ 1 h extra = 5 h/,'barra inferior actualiza la duración');
assert.match(root.innerHTML,/Total \$47\.600/,'barra inferior muestra valor total real');
click('incExtra','cortinas');
assert.match(root.innerHTML,/4 h aseo \+ 2 h extra = 6 h/,'dos actividades suman 2h');
assert.match(root.innerHTML,/Total \$57\.120/,'dos actividades incrementan valor exacto');
click('incExtra','alfombras-m2');
assert.match(root.innerHTML,/4 h aseo \+ 3 h extra = 7 h/,'tres actividades suman 3h');
assert.match(root.innerHTML,/Total \$66\.640/,'tres actividades incrementan valor exacto');
click('decExtra','mascotas');click('decExtra','cortinas');click('decExtra','alfombras-m2');
assert.match(root.innerHTML,/4 h aseo \+ 0 h extra = 4 h/,'reducir extras resta horas y valor');

change('draft:bedrooms','3');
change('draft:bathrooms','2');
assert.match(root.innerHTML,/el mínimo es de 6 horas/);
click('addCart');
assert.match(root.innerHTML,/6 h por visita/);
const after=new Date(Date.now()+3*86400000);
while([0,6].includes(after.getUTCDay()))after.setDate(after.getDate()+1);
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(after);
assert.equal(window.VillablancaTest.isWeekend(day),false,'día hábil permitido');
assert.equal(window.VillablancaTest.isWeekend('2030-10-19'),true,'sábado excluido');
assert.equal(window.VillablancaTest.isWeekend('2030-10-20'),true,'domingo excluido');
change('client:day',day);
assert.match(root.innerHTML,/Mañana · 08:00/);
assert.doesNotMatch(root.innerHTML,/<option[^>]*>Tarde · 14:00<\/option>/,'6h no caben desde 14h');
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
