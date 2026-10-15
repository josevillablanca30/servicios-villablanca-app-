# Servicios Villablanca — App cliente Android · demo comercial

Repositorio principal de la aplicación **Servicios Villablanca**. App Android nativa contenedora del catálogo y flujo de contratación web local incluidos en `app/src/main/assets/index.html`. GitHub es la fuente única de este desarrollo; no depende de Lovable.

## Estado real de la demostración

- El cliente configura servicios, cantidades, extras, datos de contacto y una fecha preferida; revisa valores y llega al checkout demostrativo.
- En el checkout existen **crédito, débito y transferencia** a modo de demostración. **No se cobra**, no se ingresan tarjetas y no se emiten boletas.
- Cotizaciones sin tarifa confirmada se solicitan por WhatsApp, que requiere intervención del cliente para enviar.
- **NUEVO (15/oct/2026):** el checkout incluye **«Confirmar pedido de PRUEBA · sin pagar»**. Crea una orden DEMO y un conjunto de tareas por servicio; desde **«Panel empresa (demo)»** puede verse, asignarse una trabajadora por tarea, cambiar estados, revisar agenda semanal y exportar CSV compatible con Excel. Se incluye comprobante de pedido **NO válido como boleta**.
- **LÍMITE ACTUAL:** la base del demo es `localStorage`, es decir **solo guarda y comparte datos entre las vistas del MISMO teléfono o navegador**. Dos teléfonos distintos no sincronizan pedidos; todavía hay que conectar backend y base de datos. No simular como real una conexión remota.
- Se incluyen 4 trabajadoras ficticias para probar asignaciones. El panel tiene un botón para añadir más trabajadoras a la demo. La vista empresa no tiene login: **no utilizar para pedidos reales ni datos personales reales**.

## Actualización del catálogo — 14 de octubre de 2026

Cambios implementados a partir de `ASEO HOGAR_APP.docx` y la fotografía del contenido del balde:

- Aseo hogar **$9.520 por hora, IVA incluido**, mínimo 4 h; con **3 o más dormitorios y 2 o más baños el mínimo es 6 h**.
- Planchado, lavado de ropa, doblado/organización y orden profundo de clósets: **$9.520 por hora adicional**, que incrementa el tiempo bloqueado del servicio (p. ej. 4 h de aseo + 1 h de planchado = 5 h / $47.600).
- Limpieza detallada: refrigerador $9.520/h; interior de horno $9.520/h; vidrios interiores $3.000/sector; aspirado con Hyla $20.000; desengrase de campana $12.000.
- Áreas especiales: terraza/balcón $9.520/h; pelo de mascotas, cortinas por pieza y alfombras por m² visibles con **precio pendiente de confirmación**.
- Implementos: **balde con productos $9.990** (Cif, cloro gel, desengrasante, espuma antisarro Harpic, Poet, lustra muebles, limpiavidrios, esponja, trapero, 2 paños, Nova y bolsa de basura) y **aspiradora industrial $7.500**.
- Aseo profesional a domicilio (inmuebles deshabitados), aseo regular programado para planes mensuales y dos servicios industriales nuevos sujetos a cotización.
- Piscinas conserva su categoría y flujo independientes del aseo hogar.
- Agenda: entrada a las **08:00 o 13:00**, con **al menos 24 h de anticipación** y sin permitir que las horas conocidas de aseo/extras excedan las **18:00**. Disponibilidad final a confirmar con la empresa.
- Tapices ya tienen tarifa por unidad cuando estaba confirmada. Los sofás de 1, 2 y 3 cuerpos tienen precios contradictorios en materiales previos y **no se inventó un valor definitivo**.

**Aclaración de precios:** los artículos sin tarifa confirmada mantienen cotización/evaluación; esto impide que el sistema presente un subtotal parcial como total de compra.

## Compilar y probar

GitHub Actions: [Compilar y probar Servicios Villablanca Android](https://github.com/josevillablanca30/servicios-villablanca-app-/actions/workflows/android-apk.yml).

Cada actualización relevante de `app/**` en `main` ejecuta la prueba de reglas en Node.js y genera un APK debug con Gradle/SDK Android oficial. En la ejecución más reciente, descargar el artefacto `Villablanca-APK-Instalable` y extraer `app-debug.apk`. El emulador se ejecuta únicamente si se lanza manualmente la acción con `test_emulator=true`. **Una compilación verde no implica pruebas en todos los dispositivos.**

Prueba de reglas sin dependencias extra: `node scripts/smoke-client.cjs`.

## Antes de vender como sistema en producción

Crear base de datos y roles de seguridad, registrar órdenes desde el cliente, desarrollar vista de empresa/agenda de trabajadoras, exportación Excel, comprobante de pedido, notificaciones internas; integrar pasarela de pago real y boleta electrónica mediante proveedores autorizados. No insertar claves ni contraseñas en este repositorio público.

## Demostración guiada de cliente y empresa (sin servidor)
1. En la app Android, selecciona Aseo hogar, elige 4 horas + 1 hora de planchado y, si quieres, agrega lavado de auto como otro servicio.
2. Ingresa datos **ficticios** de cliente y una fecha válida, al menos 24 h anticipada. Llega hasta el checkout.
3. Pulsa **Confirmar pedido de PRUEBA · sin pagar**. La app registra la orden solo en el dispositivo y muestra su código VB.
4. Pulsa **Ver pedido en panel de empresa** (también disponible al pie de la app como **Panel empresa (demo)**). Verás las tareas independientes, total y estado 'No cobrado'.
5. Asigna Aseo hogar a una trabajadora y vehículo a otra, actualiza estados, abre **Agenda semanal** y **Personal**.
6. Pulsa **Exportar para Excel**, que genera un CSV UTF-8 separado por punto y coma. En la APK Android 10+ se guarda en Descargas; desde navegador se descarga por el mecanismo web. También puedes generar un comprobante de texto claramente identificado como NO válido para el SII.
7. **Esta prueba no funciona aún entre dos teléfonos**. GitHub es el repositorio de código, no un servidor que almacene pedidos. Para la siguiente iteración necesitaremos desplegar el backend de demo en algún hosting seguro, gratuito si es posible, y configurar credenciales y acceso de administrador.

**Pruebas automáticas:** `node scripts/smoke-client.cjs && node scripts/smoke-admin.cjs`. [Workflow CI/APK](https://github.com/josevillablanca30/servicios-villablanca-app-/actions/workflows/android-apk.yml).
