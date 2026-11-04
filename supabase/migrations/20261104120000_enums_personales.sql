-- =============================================================================
-- ChangAr · Enums para solicitudes personales y exploracion de perfiles
-- (migración aparte para poder usar los valores nuevos en la siguiente)
-- =============================================================================

alter type estado_solicitud add value 'rechazada';
alter type tipo_notificacion add value 'solicitud_personal';
alter type tipo_notificacion add value 'solicitud_rechazada';
