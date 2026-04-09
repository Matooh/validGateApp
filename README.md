# ValidGateApp MVP

ValidGateApp es un MVP academico orientado al control de ingreso y salida estudiantil en instituciones educativas.

El proyecto busca digitalizar procesos de porteria y trazabilidad, permitiendo registrar eventos de ingreso o salida, vincular estudiantes a cuentas de apoderados y consultar informacion operativa desde una interfaz web responsive.

## Objetivo del MVP

Demostrar una solucion funcional para:

- registrar estudiantes, cursos e instituciones
- vincular estudiantes a cuentas de apoderados mediante codigo
- registrar eventos de ingreso y salida desde un modulo de porteria
- consultar trazabilidad reciente
- visualizar estudiantes vinculados y su informacion basica
- soportar escenarios con apoderados asociados a una o mas instituciones

## Stack tecnico

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Vercel

## Modulos principales

### 1. Autenticacion y sesion
- login y logout
- usuarios con perfil
- roles base del MVP:
  - PORTERIA
  - APODERADO

### 2. Dashboard
- saludo y resumen del usuario autenticado
- visualizacion del rol
- visualizacion de institucion o instituciones asociadas
- listado de estudiantes vinculados
- trazabilidad reciente
- visualizacion de descripciones de eventos

### 3. Vinculacion de estudiantes
- vinculacion por codigo
- validacion de codigo invalido
- deteccion de estudiante ya vinculado
- soporte para estudiantes de distintas instituciones
- mensajes visuales de exito, informacion y error

### 4. Porteria
- registro manual de eventos
- tipos de evento:
  - INGRESO
  - SALIDA
- tipo de salida inteligente:
  - no aplica para ingresos
  - obligatorio en salidas
- campos de validacion:
  - metodo de validacion
  - resultado
  - descripcion del evento
- eventos recientes con trazabilidad operativa

### 5. Busqueda de estudiantes en porteria
- modo "Buscar por estudiante"
- modo "Buscar por curso"
- filtro por nombre y apellido
- sugerencias de coincidencias en la busqueda
- seleccion individual de estudiante
- seleccion multiple por curso mediante checkboxes
- resumen de seleccion antes de registrar

### 6. Validaciones UX del formulario de porteria
- campos obligatorios vacios al ingresar
- bloqueo de submit accidental con Enter
- warnings visibles cuando faltan campos requeridos
- advertencias para:
  - estudiante faltante
  - curso faltante
  - evento faltante
  - metodo de validacion faltante
  - resultado faltante
  - tipo de salida faltante
  - falta de seleccion de alumnos por curso

### 7. Multi institucion para apoderados
- un apoderado puede tener estudiantes vinculados en una o mas instituciones
- el dashboard ya no depende solo de una institucion fija
- cada estudiante puede mostrar su institucion asociada

### 8. Informacion academica y operativa
- estudiantes con curso asociado
- visualizacion de estado:
  - en institucion
  - fuera
- soporte base para horarios y asistencia
- detalle del estudiante con vinculos asociados

## Features implementadas

### Gestion de usuarios
- [x] Login
- [x] Logout
- [x] Header con nombre del usuario
- [x] Roles basicos para porteria y apoderado

### Dashboard
- [x] Resumen de usuario autenticado
- [x] Institucion por nombre
- [x] Soporte multi institucion para apoderado
- [x] Estudiantes vinculados
- [x] Trazabilidad reciente
- [x] Visualizacion de descripcion del evento

### Vinculacion
- [x] Vincular estudiante por codigo
- [x] Manejo de codigo invalido
- [x] Manejo de duplicados
- [x] Vinculacion segura via funcion SQL

### Porteria
- [x] Registrar ingreso
- [x] Registrar salida
- [x] Tipo de salida condicional
- [x] Metodo de validacion
- [x] Resultado
- [x] Descripcion del evento
- [x] Registro individual
- [x] Registro multiple por curso

### Busqueda
- [x] Buscar por estudiante
- [x] Buscar por curso
- [x] Filtro por nombre
- [x] Sugerencias de coincidencia
- [x] Seleccion por checkbox en curso

### Validaciones
- [x] Campos requeridos vacios al cargar
- [x] Warning visual en amarillo
- [x] Bloqueo de submit accidental con Enter
- [x] Validacion previa a registrar

## Modelo funcional resumido

### Flujo de apoderado
1. inicia sesion
2. vincula estudiantes con codigo
3. visualiza estudiantes vinculados
4. revisa trazabilidad y eventos asociados

### Flujo de porteria
1. inicia sesion
2. accede al modulo de porteria
3. busca estudiantes por nombre o curso
4. selecciona uno o varios estudiantes
5. registra ingreso o salida
6. agrega metodo, resultado y descripcion
7. consulta eventos recientes

## Base de datos

El proyecto usa una base relacional en PostgreSQL/Supabase, con entidades como:

- institutions
- profiles
- courses
- students
- guardian_students
- access_events
- schedule_blocks
- attendance_blocks

Ademas, se incorporaron funciones y reglas para:

- vinculacion segura por codigo
- control de acceso por rol
- trazabilidad operativa
- politicas RLS

## Estado actual del MVP

El sistema ya permite demostrar un flujo funcional de tesis con:

- autenticacion
- vinculacion de estudiantes
- gestion de apoderados
- registro operativo en porteria
- trazabilidad
- multi institucion para apoderados
- validaciones basicas de UX

## Proximos pasos sugeridos

- filtros avanzados por institucion
- mejor manejo visual de sugerencias/autocomplete
- validaciones server-side mas estrictas en porteria
- dashboard mas analitico
- carga masiva de estudiantes y apoderados
- notificaciones
- mecanismos de validacion adicionales como QR o PIN mas completos

## Enfoque academico

Este MVP esta pensado como base para una tesis o proyecto de titulo enfocado en mejorar el control y la trazabilidad del ingreso y salida estudiantil mediante una solucion digital web, con foco en seguridad, gestion y visibilidad operacional.
