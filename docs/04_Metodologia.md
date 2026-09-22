## Elección del Stack Tecnológico
Para desarrollar ChangAr mediante la metodología de Vibe Coding (desarrollo asistido por IA) y con enfoque de Producto Mínimo Viable (MVP) multiplataforma, la combinación de stack elegida maximiza la velocidad de entrega, reduce el código repetitivo y minimiza los costos operativos iniciales.


+---------------------------------------------------+
|    Frontend (Mobile / Web)                        |
|    React Native + Expo (TypeScript)               |
+-------------------------+-------------------------+
                          |
                          | API REST / Realtime / Auth
                          v
+---------------------------------------------------+
|    Backend como Servicio (BaaS)                   |
|    Supabase (PostgreSQL + Auth + Storage)         |
+---------------------------------------------------+

## Frontend: React Native + Expo (TypeScript)
#### Por qué se eligió: 
Permite escribir un único código fuente para generar aplicaciones móviles nativas (iOS y Android) y desplegar una versión Web responsiva simultáneamente.Fit con Vibe Coding: Expo abstrae la configuración nativa compleja (Gradle, Xcode), permitiendo que la IA genere interfaces funcionales usando componentes limpios (como NativeWind para React Native). Los asistentes de IA generan código React Native altamente preciso debido al volumen de proyectos existentes en la red.


## Backend & Base de Datos: Supabase (PostgreSQL)
#### Por qué se eligió: 
Ofrece un backend completo de manera inmediata:
##### Base de Datos Relacional (PostgreSQL): 
Imprescindible para vincular adecuadamente entidades complejas (Clientes --> Solicitudes --> Propuestas --> Contrataciones --> Calificaciones).
##### Autenticación Integrada: 
Gestiona el registro por teléfono o correo y el manejo de roles de usuario desde el primer minuto.Storage Integrado: Solución inmediata para la carga de imágenes (fotos de reparaciones y portafolios de trabajadores).

##### Fit con Vibe Coding: 
Al no requerir la creación desde cero de una API REST extensa (Node.js/Express), el tiempo de desarrollo asistido por IA se reduce a escribir las consultas y la UI.
##### Costo/Beneficio: 
Su capa gratuita es más que suficiente para validar las hipótesis del MVP con cientos de usuarios activos sin costo de infraestructura.


## Diagrama de Arquitectura del Sistema
Este esquema muestra cómo interactúan los componentes sin capas innecesarias de complejidad:

+-------------------------------------------------------------------------+
|                                CLIENTES                                 |
|                                                                         |
|    [ App Móvil iOS / Android ]          [ Aplicación Web / Admin ]      |
|              \                                     /                    |
+---------------+-----------------------------------+---------------------+
                |                                   |
                |  HTTPS / WebSocket                |
                v                                   v
+-------------------------------------------------------------------------+
|                           SUPABASE PLATFORM                             |
|                                                                         |
|   +-----------------------+   +-----------------------+   +-----------+ |
|   |  Supabase Auth        |   |  PostgreSQL Database  |   |  Storage  | |
|   |                       |   |                       |   |           | |
|   |  - Login / Roles      |   |  - Usuarios           |   |  - Fotos  | |
|   |  - JWT Tokens         |   |  - Solicitudes        |   |    de     | |
|   |                       |   |  - Propuestas         |   |   Trabajos| |
|   +-----------------------+   |  - Valoraciones       |   +-----------+ |
|                               |  - RLS / Permisos     |                 |
|                               +-----------------------+                 |
+-------------------------------------------------------------------------+

## Componentes y Conexiones:
#### Cliente / Aplicación (Expo): Renderiza la interfaz de usuario. Consume datos y se comunica directamente con la SDK de Supabase mediante llamadas HTTPS/REST seguras por tokens JWT.

#### Supabase Auth: Valida el tipo de usuario (Cliente, Trabajador o Administrador) mediante políticas de acceso.

#### PostgreSQL Database: Almacena la estructura relacional. Las vistas de bases de datos alimentan directamente los paneles de estadísticas del Administrador.

#### Supabase Storage: Almacena las imágenes comprimidas adjuntas a las publicaciones y perfiles.




# Diagramas de Flujo
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