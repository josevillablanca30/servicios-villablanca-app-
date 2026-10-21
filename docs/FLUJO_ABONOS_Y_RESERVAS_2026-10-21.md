# Flujo comercial aprobado — reservas y abonos (21-10-2026)

## Contrato funcional (fuente de verdad para completar)

1. Cliente elige servicios, extras, día y horario preferido; ve antes de confirmar: total, **abono 30%** redondeado a peso, **saldo 70%** y aviso de disponibilidad pendiente.
2. Métodos alternativos para el **30%**: (a) Mercado Pago Checkout Pro con confirmación únicamente por webhook firmado y consulta del servidor; (b) transferencia bancaria directa con datos bancarios aprobados por la empresa, carga de comprobante y validación **manual** del ingreso efectivo.
3. Transferencia: crear pedido con estado `pendiente_verificacion`; asociar archivo privado a pedido único (máximo tamaño y tipo permitidos; antivirus/inspección según disponibilidad), registrar hora y método, nunca publicar comprobantes ni datos sensibles. No considerar el archivo ni un clic como pago confirmado.
4. Administrador autenticado: ver pedidos pendientes, previsualizar o descargar comprobante mediante URL firmada de corta duración, contrastar abono con la cuenta bancaria real, marcar `abono_verificado` o `rechazado`, con fecha, usuario y auditoría; prohibir al cliente/autenticación anónima modificar el estado. Prohibir dos verificaciones contradictorias o pago duplicado.
5. Solo después de pago verificado y disponibilidad confirmada, asignar a todos los trabajadores requeridos y marcar `agendado`. Si la fecha solicitada no está disponible, coordinar una alternativa; definir devolución de abono/cancelación comercial antes de cobrar en producción.
6. Confirmación **sin costo de mensajería**: administrador pulsa botón que abre WhatsApp con texto previamente preparado; debe enviarlo manualmente. Correo automático opcional solo cuando el proveedor y remitente estén realmente activos. No marcar notificación como enviada sin confirmación.
7. El encargado cobra el **70% en terreno**, después de realizado el servicio, por fuera de la app. Panel registra `saldo_pendiente` / `saldo_cobrado` con usuario, fecha y método; la app **no inicia cobro online del saldo**.
8. Exportación CSV: código pedido, fecha, servicios, total, abono esperado, abono efectivamente verificado, saldo pendiente/registrado, método, personal y estados, sin exponer documentos de identidad ni enlaces permanentes de archivos.
9. Cuentas, tokens, datos bancarios aprobados, secretos de WhatsApp/correo, recibos y comprobantes nunca se suben al GitHub público.
10. La ruta de demo no es dinero real, y no debe confundirse con la comercial. Mantenerla disponible mientras no esté validada toda la cadena de seguridad.

## Estado real

- Implementado en GitHub el texto explicativo del abono y cobro presencial, cambio del botón al valor del 30%, bloqueo explícito de transferencia todavía no operativa y desglose 30/70 en panel.
- **Pendiente:** migration privada Supabase (bucket Storage con RLS, estados, RPC de verificación, auditoría), carga y acceso privado a comprobantes, integración del panel, plantilla WhatsApp, registro de saldo cobrado, pruebas móviles y E2E.
- **Pendiente:** credenciales Mercado Pago de prueba en Supabase Secrets y validación de webhooks; no activar transferencias ni cobros reales antes de QA.
- No almacenar datos bancarios ni aceptar transferencias de clientes hasta disponer de una cuenta bancaria aprobada por el propietario y del flujo seguro de comprobantes.
