-- =============================================================================
-- ChangAr · Tipos de notificación para subáreas de oficios
-- Se aplica aparte para que los valores estén commiteados antes de usarlos.
-- =============================================================================

alter type public.tipo_notificacion add value if not exists 'subarea_pendiente';
alter type public.tipo_notificacion add value if not exists 'subarea_aprobada';
alter type public.tipo_notificacion add value if not exists 'subarea_rechazada';
