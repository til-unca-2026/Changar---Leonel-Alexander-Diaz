# Introduccion
ChangAr se organiza en una arquitectura web cliente-servidor apoyada en un backend como servicio. El frontend, desarrollado con React, Vite y Javascript, presenta las interfaces para clientes, trabajadores y administradores. Desde la interfaz, el SDK de Supabase permite interactuar con los servicios de autenticación, base de datos y almacenamiento.

PostgreSQL conserva la información relacional de la plataforma, mientras que las políticas RLS controlan el acceso a los registros. Supabase Storage administra las fotografías asociadas a solicitudes, portfolios y valoraciones. Finalmente, Supabase Realtime permite actualizar determinadas interfaces cuando se producen cambios relevantes en los datos.

Esta arquitectura reduce la infraestructura que debe desarrollar y mantener una sola persona, lo que resulta adecuado para el plazo de seis semanas. Al mismo tiempo, conserva la separación de responsabilidades entre presentación, datos, autenticación, autorización y archivos.



## Elección del Stack Tecnológico
Frontend: React.js + Vite.
Lenguaje: Javascript.
Backend y base de datos: Supabase + PostgreSQL.
Autenticación: Supabase Auth.
Autorización: roles y políticas RLS.
Archivos: Supabase Storage para fotos de perfiles y trabajos.
Actualizaciones en tiempo real: Supabase Realtime, con alcance limitado al MVP.
Despliegue: alojamiento web con nivel gratuito y verificación de límites.




## Diagrama de Arquitectura del Sistema
[diagrama](/diagramas%20de%20flujo/diagrama%20general%20v2.png)



# ESTRUCTURA DE LAS TABLAS

# Identidad, perfiles y roles
## Tablas               
### perfiles                
id, nombre, apellido, email, rol, activo, created_at    
- Información común del usuario y su rol.
### perfiles_trabajador     
id, descripcion, experiencia, ubicacion                 
- Datos profesionales específicos.
### oficios                 
id, nombre, descripcion, activo                         
- Catálogo de categorías profesionales.
### trabajador_oficios      
trabajador_id, oficio_id                                
- Relación entre trabajadores y los oficios.

# Relaciones y reglas:
- Cada perfil se vincula a una identidad de Supabase Auth mediante el mismo UUID.
- Cada usuario tiene un único rol en el MVP: cliente, trabajador o admin.
- Un trabajador puede ofrecer varios oficios y un oficio puede estar asociado a muchos trabajadores.
- El perfil de trabajador almacena los datos profesionales; las fotografías del portfolio se guardan en una tabla y en Storage, no como listas de imágenes dentro del perfil.
- El rol administrador no se asigna desde el formulario de registro público. Su asignación se realiza mediante un procedimiento administrativo confiable.

La separación entre perfiles y perfiles_trabajador permite agregar en el futuro un rol dual sin tener que duplicar la identidad de la persona. Para el MVP, las políticas y la interfaz seguirán respetando un único rol por usuario

# Solicitudes, propuestas y contrataciones

## Tablas
### solicitudes    
id, cliente_id, oficio_id, titulo, descripcion, ubicacion, presupuesto_max, estado, created_at
- Representa una necesidad de servicio.
### solicitud_fotos
id, solicitud_id, storage_path
- Referencias a fotos que contextualizan el trabajo solicitado.
### propuestas
id, solicitud_id, trabajador_id, descripcion, presupuesto, estado, created_at
- Oferta que un trabajador presenta para una solicitud.
### contrataciones
id, propuesta_id, cliente_id, trabajador_id, estado, cancelado_por, motivo_cancelacion, created_at, updated_at
- Registra el servicio acordado y su evolución.

# Valoraciones y fotografías
## Tablas
### valoraciones
id, contratacion_id, autor_id, destinatario_id, puntuacion, comentario, created_at
- Registra la valoración de un participante sobre el otro.
### valoracion_fotos
id, valoracion_id, storage_path
- Relaciona las evidencias fotográficas con la valoración.
### portfolio_fotos
id, trabajador_id, storage_path, descripcion, created_at
- Registra las imágenes que se muestran en el portfolio del trabajador.

# Administración
## Tabla
### notificaciones
id, usuario_id, tipo, referencia_id, leida, created_at
- Conserva las novedades que debe consultar cada usuario.






# DIAGRAMAS DE FLUJO
## Flujo 1: Registro, Selección de Rol y Configuración de Perfil

flowchart TD
    A([Inicio: Registro]) --> B[Ingresar Datos: Nombre y Teléfono]
    B --> C{Seleccionar Rol}
    
    C -->|Cliente| D[Crear Perfil de Cliente]
    D --> E([Pantalla Inicio / Publicar Solicitud])
    
    C -->|Trabajador| F[Crear Perfil de Trabajador]
    F --> G[Cargar Oficios, Experiencia y Fotos de Trabajos]
    G --> H([Pantalla Explorar Solicitudes])


## Flujo 2: Publicación, Postulación y Selección de Trabajo

flowchart TD
    subgraph Cliente
        A1([Crear Solicitud]) --> A2[Seleccionar Categoría, Detalle, Presupuesto Máx. y Foto]
        A2 --> A3[Publicar Solicitud]
        A3 --> A4[Recibir Propuestas de Trabajadores]
        A4 --> A5{Evaluar Propuestas y Perfiles}
        A5 --> A6[Aceptar Propuesta Seleccionada]
    end

    subgraph Trabajador
        B1([Explorar Solicitudes]) --> B2[Seleccionar Solicitud de Interés]
        B2 --> B3[Redactar Mensaje y Enviar Presupuesto Estimado]
        B3 --> B4[Aguardar Selección del Cliente]
    end

    A3 -. Aparece en feed .-> B1
    B3 -. Notifica / Envía propuesta .-> A4
    A6 --> C([Trabajo Contratado en Curso])


## lujo 3: Finalización y Reputación Mutua

flowchart TD
    A([Trabajo Finalizado]) --> B[Notificar Fin del Servicio]
    
    B --> C1[Cliente Califica: Estrellas + Reseña]
    B --> C2[Trabajador Califica: Estrellas + Reseña]
    
    C1 --> D[Enviar Calificaciones]
    C2 --> D
    
    D --> E[Actualizar Promedio de Estrellas y Perfiles]
    E --> F([Fin del Proceso])


## Flujo 4: Panel del Administrador

flowchart TD
    A([Login Admin]) --> B[Dashboard Principal]
    
    B --> C{Seleccionar Acción}
    
    C -->|Métricas| D[Visualizar Estadísticas: Registros, Solicitudes, Contrataciones]
    C -->|Gestionar Usuarios| E[Listar Usuarios / Bloquear o Desbloquear]
    C -->|Reportes| F[Revisar Denuncias / Moderar Contenido o Reseñas]

