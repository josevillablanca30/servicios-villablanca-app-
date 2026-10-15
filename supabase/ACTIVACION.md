# Activación de la conexión entre dos celulares — Servicios Villablanca

**Repositorio de código y aplicación: GitHub.** Backend: Supabase (plan gratuito de prueba, sujeto a límites del proveedor). No se usa Lovable ni Floot para la aplicación. Nunca colocar datos reales ni pagos reales en esta demo.

## Preparación: un único proyecto Supabase del propietario

1. Crear el proyecto en https://supabase.com/dashboard con un plan que no implique pagos sin autorización.
2. Conectar el plugin **Supabase** a ChatGPT (puede ejecutar los siguientes pasos cuando esté habilitado), o desde el **SQL Editor** ejecutar `supabase/01_demo_schema.sql`. Se crean tablas con RLS, RPC de registro y cambios de estado, y trabajadoras ficticias.
3. En Supabase > Authentication > Users, crear la cuenta del administrador de Servicios Villablanca. **Nunca proporcionar contraseñas en ChatGPT ni guardarlas en GitHub.**
4. Darle permiso únicamente a esa cuenta ejecutando en SQL Editor (cambia solo el correo dentro del SQL, no compartas contraseña):
```sql
insert into public.vb_demo_admins (user_id)
select id from auth.users where email = 'correo-del-administrador@empresa.cl'
on conflict (user_id) do nothing;
```
5. En el panel Supabase > Connect / Settings > API Keys copiar **Project URL** y **Publishable key** (`sb_publishable_...`). Esta llave es pública por diseño, pero **NO** utilizar secret key, service_role, contraseñas ni JWT privados en código. Editar SOLO `app/src/main/assets/cloud-config.js`:
```js
window.VILLABLANCA_CLOUD_CONFIG = Object.freeze({
  url: 'https://proyecto.supabase.co',
  publishableKey: 'sb_publishable_xxxxxxxxxxxxxx'
});
```
6. El commit en GitHub dispara las pruebas y una APK nueva en **Actions** → `Compilar y probar Servicios Villablanca Android`. Instalar esa misma APK en dos teléfonos Android. **Una APK anterior o una con configuración vacía permanece en modo local.**

## Prueba entre dos teléfonos

En el **teléfono A**, abre la app del cliente, agrega 4 h aseo + 1 h planchado, ingresa **datos ficticios**, selecciona fecha válida y confirma con **«Confirmar pedido de PRUEBA · sin pagar»**. Esta acción llama a la RPC `vb_submit_demo_order` y guarda el pedido en Supabase. No confirma si falla internet.

En el **teléfono B**, abre el mismo APK, pulsa **Panel empresa (demo)**, inicia sesión con el correo y contraseña del administrador creados en Supabase. La app muestra los pedidos (actualización cada 8 segundos), permite asignar trabajadoras ficticias sin superposición conocida, cambia estados, visualiza agenda semanal y exporta CSV de Excel a Descargas.

## Seguridad y límites

- RLS: el cliente anónimo únicamente ejecuta `vb_submit_demo_order`, nunca puede listar pedidos, direcciones, teléfonos, personal ni asignaciones.
- El rol admin se habilita manualmente en `vb_demo_admins`. No existe autoelevar permisos desde la app.
- El proyecto de prueba usa nombres y direcciones ficticios. No hay pagos ni boletas tributarias, ni control real de disponibilidad GPS. Los montos enviados desde el cliente se consideran *estimaciones no verificadas*.
- Las contraseñas se autentican directamente contra Supabase Auth; no se envían a GitHub ni a la cuenta del dueño mediante el chat.
- Los datos de sesión del administrador se conservan en el almacenamiento local WebView de la DEMO. Para uso comercial real, se necesitará endurecimiento de sesiones, políticas de tratamiento de datos, controles antiabuso y revisión de seguridad antes de admitir domicilios reales.
- Se usa HTTPS con `WebViewAssetLoader`, y se evita `allowUniversalAccessFromFileURLs`.
- Almacén local antiguo: si `cloud-config.js` sigue vacío, funciona la demo de un teléfono, **sin sincronización remota**, exactamente como antes.

## Pruebas automáticas y diagnóstico

```sh
node scripts/smoke-client.cjs
node scripts/smoke-admin.cjs
node scripts/smoke-cloud.cjs
```

La prueba cloud usa un **simulador HTTP**, no una conexión real; la prueba de dos móviles exige un proyecto Supabase configurado, un administrador creado, API RPC activada y validación práctica en ambos dispositivos.

**Importante:** GitHub hospeda el código, pero no guarda pedidos en tiempo real. Supabase es la infraestructura compartida del proyecto, no un traslado del desarrollo fuera de GitHub.
