# VALIDGATE

## Sistema de control de ingreso y salida estudiantil

VALIDGATE es una aplicación web orientada a mejorar el control de ingreso, salida y retiro de estudiantes en instituciones educativas.

El proyecto busca reducir la dependencia de procedimientos manuales, facilitar la validación de las personas involucradas y mantener un registro trazable de los eventos ocurridos dentro del proceso.

> Proyecto desarrollado como parte del proceso de titulación de Ingeniería en Computación e Informática.

---

## El problema

En diferentes instituciones educativas, el ingreso y la salida de estudiantes todavía pueden depender de procedimientos como:

- reconocimiento visual por parte del personal;
- confirmaciones verbales;
- registros manuales;
- información distribuida entre distintas personas;
- validaciones realizadas bajo presión durante horarios de alta demanda.

Estas condiciones pueden provocar desorden, demoras, errores de identificación y dificultades para reconstruir posteriormente lo ocurrido.

VALIDGATE propone centralizar este proceso y conservar evidencia de cada ingreso, salida, retiro, autorización o rechazo.

---

## La propuesta

La solución permite administrar la información necesaria para controlar los eventos de acceso de los estudiantes.

El sistema considera la participación de estudiantes, apoderados, personas autorizadas, personal de portería y administradores institucionales.

Cada evento puede registrar información como:

- estudiante involucrado;
- fecha y hora;
- tipo de evento;
- persona responsable;
- método de validación utilizado;
- resultado de la operación;
- política institucional aplicada;
- observaciones y motivos de rechazo.

De esta manera, la institución puede consultar el historial del proceso y contar con información disponible ante revisiones, incidentes o consultas de los apoderados.

---

## ¿Cómo funciona actualmente?

VALIDGATE adapta sus funciones según el rol de la persona que inicia sesión. Cada usuario accede únicamente a la información y las acciones relacionadas con sus responsabilidades.

### Personal de portería

El personal de portería puede:

1. Iniciar sesión y acceder al módulo de control.
2. Identificar al estudiante mediante búsqueda o credencial QR.
3. Seleccionar si se registrará un ingreso o una salida.
4. Indicar el método utilizado para realizar la validación.
5. Registrar el resultado y agregar observaciones cuando corresponda.
6. Confirmar la operación.

El evento queda almacenado con su fecha, hora, estudiante, responsable, método de validación y resultado.

Cuando el evento es aprobado, el sistema actualiza el estado del estudiante como dentro o fuera de la institución. Cuando la operación es rechazada, el intento queda registrado, pero no modifica su estado.

### Apoderados

Los apoderados pueden:

1. Iniciar sesión y vincular estudiantes mediante un código.
2. Consultar los estudiantes asociados a su cuenta.
3. Revisar su estado actual, horario e historial de eventos.
4. Consultar las instituciones a las que pertenece cada estudiante.
5. Gestionar solicitudes y autorizaciones de salida disponibles.
6. Acceder a las credenciales habilitadas para sus estudiantes.

Un mismo apoderado puede mantener estudiantes vinculados a más de una institución.

### Estudiantes

Los estudiantes pueden:

1. Iniciar sesión y acceder a su información personal.
2. Consultar si se encuentran dentro o fuera de la institución.
3. Revisar su horario y los bloques de asistencia.
4. Consultar sus apoderados o responsables asociados.
5. Generar su credencial QR.
6. Solicitar una salida autónoma cuando tengan el permiso correspondiente.

El estudiante puede solicitar una salida, pero no autorizarla directamente.

### Administradores

Los administradores pueden configurar las políticas utilizadas por la institución para controlar los ingresos y salidas.

Entre estas configuraciones se encuentra la posibilidad de definir si mecanismos como QR o PIN serán obligatorios, flexibles o estarán disponibles como métodos alternativos.

### Registro y trazabilidad

Toda operación relevante genera un registro consultable posteriormente.

Esto permite conocer:

- qué estudiante estuvo involucrado;
- qué acción se realizó;
- cuándo ocurrió;
- quién la registró;
- qué método de validación se utilizó;
- si la operación fue aprobada o rechazada;
- qué observaciones fueron ingresadas.

---

## Funcionalidades principales

### Autenticación y acceso por rol

Cada usuario accede a las funciones relacionadas con sus responsabilidades dentro del sistema.

Los roles considerados son:

- **Administrador**
- **Portería**
- **Apoderado**
- **Estudiante**

### Gestión de estudiantes y responsables

VALIDGATE permite mantener relaciones entre:

- estudiantes;
- apoderados;
- personas autorizadas para retiro;
- cursos;
- instituciones educativas.

### Control de ingreso y salida

El personal de portería puede registrar ingresos, salidas y retiros, verificando previamente las condiciones asociadas al estudiante.

### Credenciales QR

Los estudiantes pueden disponer de credenciales QR temporales para apoyar su identificación.

Estas credenciales:

- no exponen datos personales directamente;
- tienen una vigencia limitada;
- pueden ser revocadas;
- pueden restringirse a un solo uso.

### Autorizaciones y retiros

Los apoderados pueden gestionar solicitudes y autorizaciones asociadas al retiro de sus estudiantes.

El sistema también contempla situaciones como:

- retiro anticipado;
- retiro por una persona autorizada;
- salida autónoma del estudiante;
- rechazo por falta de autorización;
- rechazo por inconsistencias en el estado del estudiante.

### Horarios y asistencia

Los usuarios autorizados pueden consultar:

- horarios del estudiante;
- estado dentro o fuera de la institución;
- bloques de asistencia;
- historial de ingresos y salidas.

### Trazabilidad

Las operaciones relevantes quedan registradas para conocer:

- qué ocurrió;
- cuándo ocurrió;
- quién realizó la acción;
- cómo se validó;
- cuál fue el resultado;
- por qué una operación fue rechazada.

---

## Usuarios del sistema

### Administrador

Puede gestionar la configuración institucional, estudiantes, cursos, usuarios, permisos y mecanismos de validación.

### Portería

Puede buscar estudiantes, consultar autorizaciones y registrar ingresos, salidas o retiros.

### Apoderado

Puede vincular estudiantes, revisar su información, consultar eventos y gestionar autorizaciones.

### Estudiante

Puede consultar su estado, horario, credencial e información relacionada con sus responsables autorizados.

El estudiante no autoriza directamente su propio retiro. La aprobación depende de las reglas institucionales, las autorizaciones registradas y la validación realizada por el personal correspondiente.

---

## Alcance del prototipo

La versión actual se concentra en demostrar el flujo principal del sistema:

- autenticación de usuarios;
- acceso diferenciado por rol;
- vinculación entre estudiantes y apoderados;
- consulta del estado del estudiante;
- registro de ingresos y salidas;
- generación y validación de credenciales QR;
- solicitudes de autorización;
- control de salidas;
- registro de eventos aceptados y rechazados;
- consulta de trazabilidad.

El reconocimiento facial se considera una posible evolución futura y no forma parte obligatoria del prototipo actual.

---

## Estado del proyecto

VALIDGATE se encuentra en desarrollo como un producto mínimo viable.

Las funcionalidades se incorporan progresivamente, priorizando:

1. seguridad del flujo;
2. trazabilidad de las operaciones;
3. facilidad de uso para portería;
4. separación de permisos por rol;
5. protección de la información;
6. validación mediante pruebas controladas.

---

## Tecnologías utilizadas

El proyecto utiliza tecnologías web y servicios en la nube que permiten construir una solución escalable y accesible desde distintos dispositivos.

Entre las principales tecnologías se encuentran:

- Next.js
- React
- TypeScript
- Supabase
- PostgreSQL
- Vercel

Los detalles de instalación y configuración se encuentran en:

- [`docs/CONFIGURACION_LOCAL.md`](docs/CONFIGURACION_LOCAL.md)

---

## Evolución prevista

Entre las capacidades consideradas para etapas posteriores se encuentran:

- validación mediante PIN temporal;
- notificaciones a apoderados;
- paneles institucionales con métricas;
- gestión ampliada de autorizaciones;
- autenticación reforzada para roles críticos;
- integración con dispositivos o controles físicos;
- evaluación jurídica y técnica de mecanismos biométricos.

---

## Propósito académico

VALIDGATE forma parte de un proyecto de título enfocado en el análisis, diseño y desarrollo de una solución informática para apoyar el control seguro de ingreso y salida estudiantil.

El proyecto busca demostrar cómo una herramienta digital puede aportar mayor orden, trazabilidad y capacidad de supervisión a un proceso institucional cotidiano y sensible.

---

## Autor

**Matías Ignacio Reyes Bettancourt**  
Ingeniería en Computación e Informática  
Universidad Andrés Bello  
Santiago, Chile — 2026