# VALIDGATE — Sistema actual

Fecha de referencia: 2026-08-28

## Propósito y alcance

VALIDGATE es un MVP web para controlar el ingreso, la salida y el retiro de estudiantes. El sistema autentica usuarios, aplica reglas institucionales, mantiene el estado dentro/fuera del estudiante y conserva trazabilidad de operaciones aprobadas, rechazadas y excepcionales.

La interfaz usa los nombres funcionales **Apoderado Primario** y **Apoderado Secundario**. Para mantener compatibilidad con el modelo existente, los identificadores técnicos continúan siendo `APODERADO` y `RETIRADOR_AUTORIZADO`; este cambio de vocabulario no modifica enums, migraciones ni políticas RLS.

## Roles y alcance de datos

| Rol visible | Identificador técnico | Alcance actual |
| --- | --- | --- |
| Administrador | `ADMIN` | Configura y consulta su institución, gestiona vínculos y puede operar portería. No accede a otra institución. |
| Portería | `PORTERIA` | Registra ingresos, salidas y retiros, valida QR/PIN y consulta trazabilidad de su institución. |
| Docente | `DOCENTE` | Consulta el alcance institucional disponible para docentes. En el MVP no existe asignación profesor–curso: dos docentes de la misma institución ven el mismo conjunto. |
| Apoderado Primario | `APODERADO` | Consulta únicamente estudiantes vinculados, gestiona vinculaciones permitidas, responde solicitudes y autoriza Apoderados Secundarios. |
| Apoderado Secundario | `RETIRADOR_AUTORIZADO` | Consulta estudiantes autorizados mientras el vínculo temporal está vigente e inicia retiros para ellos. Tras revocación o vencimiento pierde acceso a eventos ajenos, pero conserva su propio retiro histórico. |
| Estudiante | `ESTUDIANTE` | Consulta sus datos, vínculos y trazabilidad; genera QR, responde retiros y solicita salida según sus permisos. |

La protección se aplica en navegación, Server Actions y políticas RLS. Ocultar una opción visual no sustituye la validación del servidor o de la base de datos.

## Módulos principales

| Ruta | Función |
| --- | --- |
| `/` | Inicio de sesión con mensajes genéricos. |
| `/register` | Registro de una cuenta base. |
| `/dashboard` | Panel por rol, solicitudes y trazabilidad reciente. |
| `/guard` | Operación de portería, validación y cola de retiros. |
| `/authentications` | Credenciales QR y PIN disponibles para el usuario. |
| `/links` | Consulta y administración de vínculos permitidos. |
| `/students/link` | Vinculación de un estudiante mediante código. |
| `/admin/relationships` | Administración institucional consolidada de vínculos. |
| `/students/[id]` | Detalle, estado, responsables, horario y asistencia. |
| `/settings` | Perfil y políticas institucionales según rol. |

## Vinculación

Un Apoderado Primario puede ingresar un código de vinculación desde su dashboard y continuar en el panel de vinculación. La interfaz muestra el código utilizado, informa el resultado y presenta el vínculo creado. Los códigos inválidos y los vínculos duplicados se rechazan sin ampliar el acceso del usuario.

La administración institucional permite partir desde dos estados visibles:

1. estudiante con vínculos existentes: se muestran primero las personas vinculadas y luego puede agregarse otra;
2. estudiante sin vínculos: se muestra explícitamente la ausencia y luego puede agregarse el primero.

La vista consolidada permite buscar estudiantes y administrar cada relación individualmente.

## Apoderados Secundarios

El Apoderado Primario registra o reutiliza una cuenta mediante nombre, correo, RUT y período de vigencia. El RUT se normaliza y valida con las reglas chilenas disponibles en `src/lib/chile/rut.ts`. La autorización puede revocarse antes de su vencimiento.

El acceso depende simultáneamente de la identidad, el estudiante asignado y la vigencia. Una autorización revocada o vencida no habilita nuevos retiros ni la trazabilidad general del estudiante.

## Ingreso, salida y contingencia

Portería registra eventos en `access_events`. Cada registro conserva, según corresponda, estudiante, institución, tipo y subtipo, método de validación, resultado, responsable, fecha, observaciones, política aplicada y motivo de contingencia o rechazo.

Un evento aprobado actualiza el estado del estudiante y los bloques de asistencia relacionados. Un rechazo queda trazado, pero no cambia el estado dentro/fuera.

Cuando una salida normal no puede completarse por el mecanismo esperado, portería puede usar el flujo excepcional documentado si la política lo permite. Si el estudiante no puede salir solo, puede solicitarse aprobación al Apoderado Primario y continuar con validación dual.

## Retiro con PIN dual

Los retiros de Apoderado Primario y Secundario validan por separado al responsable y al estudiante:

1. el responsable inicia el retiro;
2. el estudiante acepta o rechaza la solicitud;
3. al aceptar se generan dos PIN distintos;
4. la interfaz de cada actor muestra su PIN y portería ingresa ambos;
5. cada aprobación se muestra en verde;
6. la segunda validación completa automáticamente la salida, muestra una instrucción nominal y genera la trazabilidad.

Los PIN tienen vigencia, límite de intentos y consumo único. La cancelación, el rechazo, el vencimiento o la revocación correspondiente invalidan el flujo activo.

## Credencial QR

La credencial QR es opaca, temporal y de un solo uso. Contiene `validgate-auth:{uuid}` y no expone datos personales. Se valida en el servidor contra estudiante, institución, vigencia, consumo previo y operación solicitada.

## Trazabilidad y protección de datos

La sección **Trazabilidad reciente** debe presentarse completa en las evidencias funcionales: título de la sección, descripción y tarjetas visibles. Cada tarjeta muestra los datos disponibles del evento, incluidos estudiante, tipo de movimiento, resultado, método, descripción y fecha/hora.

El alcance vigente es:

- familias distintas no ven eventos entre sí;
- administrador y portería ven su institución, pero no otra;
- los docentes de una institución comparten el mismo alcance institucional y no ven otra institución;
- el Apoderado Secundario ve únicamente estudiantes autorizados durante la vigencia y conserva solo sus retiros históricos propios al perderla;
- el estudiante ve su información y eventos relacionados.

La suite E2E prueba explícitamente estas reglas mediante `PF-TRA-002A` a `PF-TRA-002E`.

## Migraciones funcionales relevantes

- `001_init.sql` a `016_transactional_authorization_response.sql`: base, RLS, QR, contingencias, estudiantes y solicitudes.
- `017_guardian_pickup_dual_pin.sql` a `021_guardian_pickup_qualified_pin_columns.sql`: retiro con PIN dual, vigencia, intentos y consumo.
- `022_authorized_retirador_role.sql` y `023_links_and_temporary_retiradores.sql`: rol técnico y vínculos temporales del Apoderado Secundario.
- `024_exceptional_exit_and_staff_contingency.sql` y `025_student_exit_requires_dual_pin.sql`: salida excepcional y validación dual.
- `026_retriever_authorization_and_pin_consumption.sql` y `027_fix_confirm_guardian_pickup_request_id.sql`: revocación, consumo y confirmación final.

## Validación E2E

La configuración funcional descubre 47 pruebas con 47 identificadores únicos. Se organizan primero por autenticación y restricciones transversales y luego por vínculos, acceso, retiro y trazabilidad. El smoke `DEMO-SMOKE-001` se ejecuta con una configuración separada y no forma parte del catálogo `PF-*`.

Cada corrida guarda HTML, JSON, JUnit, PDF y adjuntos dentro de `reports/YYYYMMDD-HHMM/`. Los PIN y códigos requeridos por el caso pueden mostrarse en evidencia controlada; contraseñas y payloads QR permanecen protegidos.

## Limitaciones conocidas del MVP

- No existe asignación docente–curso ni distinción entre profesor jefe y ayudante.
- No existe historial integral con filtros avanzados; se muestran eventos recientes según el rol.
- El lector QR depende del payload pegado o escaneado externamente.
- No hay MFA operativo, biometría, push ni SMS.
- El estado visual `NEW` utiliza almacenamiento local y no una tabla persistente de lecturas.
- Algunos CRUD administrativos y validaciones de horario permanecen parciales.
