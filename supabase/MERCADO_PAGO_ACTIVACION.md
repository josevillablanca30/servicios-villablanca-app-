# Servicios Villablanca — Activación Mercado Pago (21 octubre 2026)

El código fuente **permanece en GitHub** y el backend/seguridad en el proyecto Supabase `lnhptqaqtzilyaigyehq`. La función `villablanca-payments` ya está desplegada en modo **sin credenciales**: devuelve HTTP 503, sin generar cobro hasta la configuración del propietario.

## Preparar Mercado Pago Checkout Pro

1. Ingresar a [Mercado Pago Developers Chile](https://www.mercadopago.cl/developers/es), abrir **Tus integraciones**, crear/seleccionar una aplicación y habilitar **Checkout Pro** a nombre del titular que recibirá los pagos.
2. Empezar con las **credenciales de PRUEBA**. Dentro de [Supabase — Edge Function Secrets](https://supabase.com/dashboard/project/lnhptqaqtzilyaigyehq/settings/functions), guardar `MP_ACCESS_TOKEN` con el Access Token **TEST** de esa cuenta. **No escribir ni subir tokens a GitHub, la app, WhatsApp ni este chat.**
3. En Mercado Pago > Webhooks activar evento **Pagos** y configurar la URL EXACTA:
   `https://lnhptqaqtzilyaigyehq.functions.supabase.co/villablanca-payments/webhook`
4. Desde configuración de Webhooks obtener la clave secreta de firma y agregarla como secreto `MP_WEBHOOK_SECRET` en Supabase (también en pruebas). Así se validará el origen del webhook antes de comprobar el pago en la API de Mercado Pago.
5. La función genera un enlace de Checkout Pro **para el 30%** de un total **recalculado en servidor**. Los precios fijos autorizados están en el código de la función. Las variantes de sofá 1/2/3 cuerpos carecen de precio definitivo y están **bloqueadas** para cobros hasta recibir el valor final.
6. Se usa **`sandbox_init_point` con tokens TEST** e **`init_point` con token de producción**. La app Android abre Mercado Pago con HTTPS en navegador externo. Las pantallas de retorno **no prueban** que pagaron: solo el webhook firmado y la consulta a Mercado Pago pueden cambiar el estado a **Abono aprobado**.
7. **Tras probar extremo a extremo** pagos aprobados, pendientes y rechazados en sandbox (y revisar las comisiones aplicables), se puede reemplazar el token de prueba por el token productivo en **Supabase Secrets**, nunca en el repositorio. Antes de activar cobros comerciales es necesaria una revisión de seguridad y tarifas.

**Cálculo de abono:** `Math.round(totalCLP * 0.30)`. El saldo es `totalCLP - abono`. Por ejemplo, para $57.590 el abono es $17.277 y el saldo $40.313.

## Correo con ficha de la persona asignada

El sistema guarda el correo del cliente en la tabla privada, y cuando se asignan **todas** las tareas del pedido, genera una fila en `vb_demo_email_outbox`. El panel invoca la función de envío cuando asigna a una persona.

Para mandar correos efectivamente, registrar un remitente empresarial verificado con un proveedor como **Resend** y configurar en Supabase Edge Function Secrets:

- `RESEND_API_KEY`: clave **privada** del proveedor.
- `VILLABLANCA_EMAIL_FROM`: dirección remitente verificada, por ejemplo `Administración <reservas@dominio-verificado.cl>`.

Sin estos secretos, **no se envía ningún correo**: la asignación sí se guarda y queda indicado que el aviso está pendiente. La plantilla incluye el texto aprobado **«Tu servicio fue agendado exitosamente»**, la fecha, la ficha de nombre/especialidad (no RUT), agradecimiento y firma del Equipo de Administración.

## Seguridad / agenda / límites

- **Sábados y domingos** no están disponibles para nuevas solicitudes; se valida tanto en el celular como en Supabase. Se mantienen **solo los horarios originales ya filtrados por la app**, sin incorporar los cuatro bloques alternativos descritos en el Word.
- Hay 17 nombres del personal importados **solo a la base privada**; no guardamos los RUT en GitHub o la APK. Siguen visibles 4 perfiles de prueba anteriores para mantener las asignaciones de los pedidos ya existentes; validar especialidades y comunas reales antes del uso comercial.
- Hay precios publicados por unidad para varios tapices, pero **el Word adjunto no especifica cuánto cuestan los sofás de 1, 2 o 3 cuerpos** y existen referencias contradictorias: 1 cuerpo ($30.000 / $38.080), 2 cuerpos ($35.000 / $45.000), 3 cuerpos ($45.000 / $50.000). No decidir unilateralmente. Se mantienen sin cobro.
- Actualmente la confirmación tras un pedido nuevo dice **«Tu solicitud fue recibida exitosamente»**; **no** promete asignación ni reserva pagada. Al confirmarse toda la asignación, la plantilla de correo usa el texto definitivo.
- Si el checkout dice «Mercado Pago aún no conectado», no se realizó ningún cargo. Sigue disponible la prueba **«sin pagar»**.
- El proveedor Mercado Pago tiene sus propias condiciones y eventuales comisiones. No se presume que el servicio sea gratuito o que las transferencias/Fintoc estén habilitadas.

Referencias oficiales:
- https://www.mercadopago.cl/developers/es/docs/checkout-pro-preferences/create-payment-preference
- https://www.mercadopago.cl/developers/es/docs/checkout-pro-preferences/configure-back-urls
- https://www.mercadopago.cl/developers/es/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks?scope=prod

## Validación pendiente

1. Activar secret TEST y webhook firmado en Mercado Pago, probar un pago aprobado de prueba y verificar que Supabase guarda **Abono aprobado**.
2. Activar remitente Resend para verificar ficha a correo cliente, sin exponer RUT.
3. Confirmar precios de sofás y firma remitente.
4. Validar flujo real en dos celulares antes de habilitar cobros de clientes verdaderos.
