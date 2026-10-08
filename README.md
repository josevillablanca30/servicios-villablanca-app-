# Servicios Villablanca — Aplicación Android de prueba

Código fuente para demostración en Android. El catálogo, las cantidades, los extras, la dirección, la agenda de cotización y el recorrido hasta el pago son funcionales. El último paso de pago está **bloqueado deliberadamente** hasta vincular la pasarela del negocio (Mercado Pago o Transbank). No procesa ni almacena tarjetas.

## Descargar e instalar la prueba
Abre la pestaña **Actions** → *Compilar y probar Servicios Villablanca Android* → última ejecución con estado verde → **Artifacts** → descarga `Villablanca-Android-Probado`. Dentro estará `app-debug.apk`. Si Android detecta un conflicto de firma, desinstala el APK defectuoso anterior y luego instala este.

Este proyecto compila con Gradle 8.9, Android Gradle Plugin 8.7.3, JDK 17 y Android SDK 35. El workflow valida el APK y lo instala e inicia en un emulador antes de publicar el artefacto. Un estado verde confirma la compilación y prueba automatizada, no una prueba en todos los modelos de teléfono.

**No utilices el APK experimental anterior:** la versión previa no contenía correctamente el ícono y se cerraba al abrir. El ícono de este repositorio utiliza la silueta original de Villablanca incluida en la demo.

El archivo web autocontenido se encuentra en `app/src/main/assets/index.html`; para modificar servicios o extras, edita ese archivo. Las solicitudes de cotización no son reservas confirmadas. No hay integración bancaria real ni pagos en esta versión.
