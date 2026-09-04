# Manual de usuario de VALIDGATE

## 1. ¿Qué es VALIDGATE?

VALIDGATE es una aplicación web para gestionar y registrar el ingreso, la salida y el retiro de estudiantes en una institución educativa.

La aplicación permite que cada persona vea solo las opciones que necesita según su función. Además, deja un historial de las operaciones realizadas para facilitar el seguimiento de cada movimiento.

## 2. Tipos de usuario

### Administrador

Administra la configuración de la institución, revisa los movimientos registrados, gestiona las relaciones entre estudiantes y apoderados y puede apoyar la operación de portería.

### Personal de portería

Busca estudiantes, valida sus credenciales y registra ingresos, salidas y retiros.

### Docente

Consulta información de estudiantes, asistencia y movimientos disponibles dentro de su institución.

### Apoderado Primario

Consulta a los estudiantes vinculados a su cuenta, genera credenciales QR, responde solicitudes de salida y puede autorizar a un Apoderado Secundario.

### Apoderado Secundario

Consulta a los estudiantes que tiene autorizados temporalmente e inicia solicitudes de retiro mientras su autorización esté vigente.

### Estudiante

Consulta su estado, sus responsables y sus movimientos. También puede presentar un QR, responder solicitudes de retiro y solicitar una salida por sus propios medios cuando esta opción esté habilitada.

## 3. Ingresar a la aplicación

1. Abra VALIDGATE.
2. Escriba su correo electrónico.
3. Escriba su contraseña.
4. Si desea que el correo quede recordado para el próximo ingreso, active la opción **recordarme**.
5. Seleccione **Login**.

Después de ingresar, verá el panel principal correspondiente a su tipo de usuario.

Si todavía no tiene una cuenta, seleccione **registrarse**, complete sus nombres, apellidos, correo y contraseña, y luego seleccione **Crear cuenta**.

## 4. Navegar por la aplicación

Desde el menú principal se puede acceder, según los permisos de la cuenta, a:

- **Dashboard:** resumen de la información, solicitudes pendientes y movimientos recientes.
- **Vínculos:** estudiantes y responsables relacionados con la cuenta.
- **Vincular estudiante:** incorporación de un estudiante mediante un código entregado por la institución.
- **Portería:** registro de ingresos, salidas y retiros.
- **Autenticaciones:** generación y consulta de credenciales QR y PIN.
- **Config:** datos personales, contraseña y, para administradores, reglas institucionales.

Para salir de la aplicación, abra el menú de usuario y seleccione **Cerrar sesión**.

## 5. Actualizar los datos personales

1. Abra **Config**.
2. En **Datos personales**, actualice nombres, apellidos, RUT o teléfono.
3. Seleccione **Guardar cambios**.

Para cambiar la contraseña:

1. En la misma pantalla, escriba la contraseña actual.
2. Escriba la nueva contraseña.
3. Repita la nueva contraseña.
4. Seleccione la opción para cambiarla.

## 6. Vincular un estudiante

Esta opción está disponible para el Apoderado Primario.

1. Abra **Vincular estudiante**.
2. Escriba el código de vinculación entregado por la institución.
3. Seleccione la opción para vincular.
4. Confirme en el panel que el estudiante aparece asociado a su cuenta.

Si el código ya fue utilizado, es incorrecto o el estudiante ya está vinculado, la aplicación mostrará un aviso y no creará una relación duplicada.

## 7. Consultar vínculos

En **Vínculos** puede revisar:

- el nombre del estudiante;
- la institución a la que pertenece;
- los Apoderados Primarios y Secundarios asociados;
- el estado de cada autorización;
- el período de vigencia de una autorización temporal.

El Apoderado Primario o el administrador puede revocar una autorización temporal cuando corresponda. Una autorización vencida o revocada ya no permite iniciar nuevos retiros.

## 8. Autorizar a un Apoderado Secundario

El Apoderado Primario o el administrador puede autorizar temporalmente a otra persona para retirar a un estudiante.

1. Abra **Vínculos**.
2. En **Vinculación Apoderado Secundario-Estudiante**, seleccione al estudiante.
3. Complete nombres, apellidos, correo y RUT de la persona autorizada.
4. Defina la fecha y hora de inicio y término de la autorización.
5. Confirme que la persona está autorizada para retirar al estudiante durante ese período.
6. Seleccione **Invitar y autorizar**.

La persona recibirá una invitación por correo. Solo podrá ver y retirar al estudiante durante el período indicado.

## 9. Generar y presentar un código QR

El QR sirve para validar un ingreso o una salida en portería.

1. Abra **Autenticaciones**.
2. Ubique al estudiante correspondiente.
3. Seleccione **Generar QR**.
4. Muestre el código en la pantalla del teléfono a la persona de portería.

El QR es temporal y de un solo uso. Genérelo cuando esté próximo a presentarlo y no comparta una captura antigua. Si expira, genere uno nuevo.

## 10. Solicitar un retiro con PIN dual

El retiro con PIN dual confirma por separado la identidad del responsable y la del estudiante.

### Para el responsable

1. Desde el **Dashboard**, seleccione al estudiante.
2. Inicie una solicitud de retiro.
3. Revise los datos y envíe la solicitud.

### Para el estudiante

1. Revise la solicitud que aparece en su **Dashboard**.
2. Compruebe quién solicita el retiro y el motivo, si corresponde.
3. Seleccione **Aceptar** o **Rechazar**.

Cuando el estudiante acepta, la aplicación genera dos PIN independientes: uno para el responsable y otro para el estudiante. Cada persona debe mostrar su propio PIN en portería.

Los PIN tienen una vigencia limitada. Deben presentarse antes de su vencimiento y no deben compartirse con otras personas.

El retiro se completa cuando portería valida ambas identidades. La segunda validación finaliza automáticamente el proceso.

## 11. Registrar un ingreso o una salida en portería

1. Abra **Portería**.
2. Busque al estudiante por nombre o apellido, o búsquelo dentro de su curso.
3. Seleccione el estudiante o los estudiantes correspondientes.
4. Seleccione el tipo de evento: **Ingreso** o **Salida**.
5. Si es una salida, indique si es regular, un retiro autorizado, una salida por voluntad del estudiante o una salida excepcional.
6. Seleccione el método de validación solicitado: manual, QR o PIN.
7. Seleccione el resultado: **Aprobado** o **Rechazado**.
8. Agregue una descripción cuando sea necesario.
9. Revise el resumen y seleccione **Registrar evento**.

La aplicación verifica el estado del estudiante y las autorizaciones disponibles antes de permitir el registro. Por ejemplo, no permite registrar una salida si no existe un ingreso activo o si falta una autorización requerida.

## 12. Procesar un retiro desde la cola de portería

En el módulo **Portería**, la cola de retiros muestra las solicitudes activas.

1. Ubique al estudiante en la cola.
2. Compruebe el nombre del responsable que realiza el retiro.
3. Valide el PIN del responsable.
4. Valide el PIN del estudiante.
5. Confirme que los nombres y las identidades coincidan.

Cuando ambas validaciones son correctas, el retiro queda registrado y el estudiante pasa a estado **Fuera de la institución**.

Si existe una inconsistencia, seleccione **Rechazar en portería**, indique el motivo y agregue una observación.

## 13. Registrar una contingencia

Si no es posible utilizar un QR o PIN, portería puede registrar una validación manual cuando las reglas de la institución lo permitan.

1. Seleccione el método **Manual**.
2. Indique el motivo de la contingencia, por ejemplo, falta de dispositivo, batería agotada, falla del dispositivo o PIN no disponible.
3. Escriba una observación clara.
4. Revise el resto de la información y registre el evento.

La observación es importante porque permite explicar por qué se utilizó un método alternativo.

## 14. Solicitar una salida autónoma

Cuando el estudiante tiene habilitada la salida autónoma:

1. El estudiante inicia una solicitud desde su **Dashboard**.
2. Escribe un motivo, si corresponde, y envía la solicitud.
3. El Apoderado Primario revisa la solicitud y la aprueba o rechaza.
4. Si se aprueba, el estudiante presenta en portería la credencial solicitada para validar la salida.

La solicitud tiene un tiempo limitado. Si expira, será necesario iniciar una nueva solicitud.

## 15. Revisar el estado y la asistencia

Desde el **Dashboard** o desde el detalle del estudiante se puede revisar, según el tipo de usuario:

- si el estudiante está dentro o fuera de la institución;
- sus responsables vinculados;
- el horario del día;
- la asistencia por bloque;
- los movimientos recientes;
- el estado de solicitudes de retiro.

Los estados de asistencia pueden indicar presencia, ausencia, atraso o salida.

## 16. Configuración para administradores

El administrador puede configurar las reglas que utilizará portería:

- si el ingreso requiere QR o PIN;
- si la salida requiere QR o PIN;
- si se permite registrar manualmente cuando no hay una credencial;
- si una salida manual exige una observación;
- cuánto tiempo permanecen vigentes los PIN del retiro dual;
- cuántos intentos tiene cada persona para ingresar su PIN;
- el mensaje que recibe el estudiante cuando se solicita un retiro.

Después de modificar una regla, seleccione **Guardar**. Las nuevas condiciones se aplican a las operaciones posteriores.

## 17. Historial y avisos importantes

El panel muestra los movimientos recientes y el estado de las solicitudes. Un evento rechazado también puede aparecer en el historial, pero no cambia el estado del estudiante.

Tenga presente lo siguiente:

- revise siempre el nombre del estudiante antes de confirmar;
- genere el QR justo antes de usarlo;
- cada persona debe presentar su propio PIN;
- no comparta QR ni PIN;
- respete las fechas de las autorizaciones temporales;
- registre una observación cuando utilice una contingencia o rechace una operación;
- si una solicitud o credencial vence, inicie el proceso nuevamente.

## 18. Solución de problemas frecuentes

**No puedo ver un estudiante.** Verifique que su cuenta esté vinculada al estudiante y que la autorización temporal no haya vencido.

**El QR no funciona.** Compruebe que no haya expirado y genere uno nuevo desde **Autenticaciones**.

**No aparecen los PIN.** El estudiante debe aceptar primero la solicitud de retiro. Una vez aceptada, cada persona verá su PIN vigente.

**El retiro fue rechazado.** Revise que los nombres coincidan, que los PIN sean los correctos y que no estén vencidos o bloqueados por demasiados intentos.

**No puedo registrar una salida manual.** La institución puede exigir QR o PIN. Si está permitido usar una contingencia, seleccione el motivo y escriba la observación solicitada.

**No puedo iniciar sesión.** Revise el correo y la contraseña. Si el problema continúa, solicite apoyo al administrador de la institución.
