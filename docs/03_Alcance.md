# Alcance

## Qué incluye el MVP

ChangAr cubre el ciclo de conexión entre un cliente que necesita un servicio y un
trabajador independiente que lo ofrece:

- Registro, inicio de sesión y perfiles según el rol (cliente, trabajador, administrador).
- Publicación de solicitudes de servicio con fotos y zona.
- Postulación de trabajadores mediante propuestas con descripción y presupuesto.
- Consulta y comparación de propuestas, y aceptación de una de ellas.
- Contratación del servicio, con doble confirmación de finalización y cancelación.
- Valoraciones mutuas y construcción de reputación.
- Panel de administración: métricas, moderación de oficios, gestión de usuarios y reportes.
- Notificaciones dentro de la plataforma.

## Qué queda fuera del alcance

| Tema | Qué **no** hace ChangAr | Qué **sí** hace en su lugar |
|---|---|---|
| **Pagos y facturación** | No procesa pagos, cobros, comisiones, reembolsos ni emite facturas | Registra el presupuesto de la propuesta como referencia. El acuerdo económico y el pago se realizan por fuera de la plataforma |
| **Mensajería** | No hay chat, mensajes privados ni comunicación en tiempo real | La comunicación se limita a la solicitud, la propuesta y los estados de la contratación. Los datos de contacto se comparten únicamente para coordinar el servicio acordado |
| **Notificaciones push y email** | No envía notificaciones al celular ni correos automáticos | Las novedades se consultan en el centro de notificaciones dentro de la aplicación |
| **Mapas y geolocalización** | No utiliza mapas, GPS ni coordenadas | La ubicación se expresa como texto libre (zona, no dirección exacta) |
| **Aplicación nativa** | No hay app para iOS/Android ni publicación en tiendas | Es una aplicación web responsive, accesible desde el navegador mediante una URL |
| **Reservas y agenda** | No gestiona fechas, horarios, calendarios ni disponibilidad | El cliente y el trabajador coordinan el día y la hora por fuera de la plataforma |
| **Verificación de identidad** | No valida documentos, matrículas, títulos ni antecedentes | El perfil muestra oficios, experiencia y portfolio declarados por el trabajador |
| **Garantías y arbitraje** | No garantiza la calidad del trabajo, no media disputas ni ofrece seguros | El administrador modera contenido y reportes, pero no arbitra el servicio ni reembolsa dinero |
| **Pago en garantía (escrow)** | No retiene ni libera dinero | El pago es directo entre las partes, por fuera de la plataforma |
| **Archivos que no sean imágenes** | No acepta PDFs, documentos ni videos | Solo se admiten fotos en formato JPG, PNG o WEBP |
| **Integraciones** | No expone una API pública ni se integra con otros sistemas | La plataforma funciona de forma autónoma |

## Fuera de alcance vs. pendiente

Es importante no confundir dos conceptos:

- **Fuera de alcance:** no se va a desarrollar en este MVP (lo detallado en la tabla anterior).
- **Pendiente:** forma parte del alcance, pero todavía no está implementado. Por ejemplo,
  las contrataciones, las valoraciones o las notificaciones internas, que integran el
  roadmap del proyecto.

## Criterio para decidir el borde

Una funcionalidad **entra** en el alcance si es necesaria para conectar al cliente con el
trabajador y construir confianza: perfiles, solicitudes, propuestas, contrataciones,
reputación y moderación.

Una funcionalidad **queda afuera** si requiere infraestructura que excede el MVP de seis
semanas: pagos, mensajería en tiempo real, geolocalización, agenda o validación de
identidad.
