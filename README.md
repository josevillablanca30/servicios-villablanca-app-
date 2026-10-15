# Servicios Villablanca — App cliente Android · demo comercial

Repositorio principal de la aplicación **Servicios Villablanca**. App Android nativa contenedora del catálogo y flujo de contratación web local incluidos en `app/src/main/assets/index.html`. GitHub es la fuente única de este desarrollo; no depende de Lovable.

## Estado real de la demostración

- El cliente configura servicios, cantidades, extras, datos de contacto y una fecha preferida; revisa valores y llega al checkout demostrativo.
- En el checkout existen **crédito, débito y transferencia** a modo de demostración. **No se cobra**, no se ingresan tarjetas y no se emiten boletas.
- Cotizaciones sin tarifa confirmada se solicitan por WhatsApp, que requiere intervención del cliente para enviar.
- **Aún no existe backend compartido ni un panel operativo que reciba estos pedidos automáticamente.** Ese es el siguiente módulo, separado del catálogo cliente.

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
