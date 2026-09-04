# Plan de pruebas funcionales de VALIDGATE

## 1. Objetivo del plan de pruebas

Verificar desde la interfaz que VALIDGATE cumple sus requerimientos funcionales y objetivos específicos en los flujos de autenticación, vinculación, ingreso, salida, retiro, autorización, administración y trazabilidad. El plan define los escenarios funcionales y su relación con la suite end-to-end de Playwright. El estado "Automatizado" indica que existe una prueba ejecutable; los resultados aprobados o fallidos pertenecen al reporte de cada corrida y no se infieren desde este documento.

## 2. Alcance

El alcance comprende los 14 requerimientos funcionales RF01–RF14 del archivo vigente de requerimientos, las capacidades observables del repositorio local y los cuatro objetivos específicos del documento de tesis actualizado. Incluye flujos exitosos, validaciones, alternativas, restricciones por rol y manejo de errores. No incluye selectores, consultas directas a la base de datos, pruebas de rendimiento, seguridad ofensiva ni código Playwright.

Cuando un comportamiento está documentado pero no cuenta con interfaz completa, el escenario se conserva para trazabilidad y se marca como pendiente de implementación. El código y el vocabulario visible de la interfaz prevalecen para definir lo que hoy puede automatizarse.

## 3. Roles considerados

| Rol | Alcance funcional observado |
| --- | --- |
| Administrador | Configuración institucional, estudiantes, políticas y operaciones de portería. |
| Portería | Validación de identidad, ingresos, salidas, retiros y eventos recientes. |
| Docente | Dashboard, cursos, asistencia y detalle autorizado; sin operaciones de portería. |
| Apoderado Primario | Estudiantes vinculados, solicitudes, retiros, credenciales y trazabilidad relacionada. |
| Estudiante | Estado personal, QR, salida autónoma, solicitudes y respuesta a retiros. |
| Apoderado Secundario | Estudiantes asignados temporalmente, solicitud de retiro y presentación de PIN; sin acceso a estudiantes no autorizados. |

## 4. Criterios de entrada

- Entorno controlado disponible y compilación de la aplicación satisfactoria.
- Migraciones aplicadas en el orden previsto y datos de prueba aislados por institución.
- Cuentas activas para los seis roles visibles y relaciones estudiante-Apoderado Primario/Secundario preparadas.
- Migraciones `001` a `027` aplicadas; la `027` corrige la confirmación final del retiro con PIN dual.
- Estudiantes de prueba con estados dentro/fuera, cursos, permisos y credenciales conocidos.
- Políticas institucionales y configuraciones de retiro definidas para cada conjunto de pruebas.
- Reloj del entorno controlado para comprobar expiración de QR, PIN y autorizaciones.

## 5. Criterios de salida

- Todos los escenarios críticos ejecutados y con evidencia visible.
- Cero defectos críticos abiertos en autenticación, permisos, ingreso, salida o retiro.
- Resultados aprobados, rechazados y excepcionales trazables desde la interfaz.
- Diferencias entre documentación e implementación registradas y clasificadas.
- Cobertura del 100 % de RF01–RF14 y relación de OE1–OE4 con al menos un escenario.

## 6. Escenarios funcionales en Gherkin

Condición común para la futura automatización: VALIDGATE se encuentra disponible en un entorno controlado, con datos de prueba y usuarios que poseen el rol y las vinculaciones indicadas en cada escenario.

Regla común de evidencia: todo caso que genere un ingreso, salida, rechazo, contingencia o retiro debe mostrar el componente completo **Trazabilidad reciente** con sus tarjetas y datos visibles. Los casos con PIN deben mostrar ambos valores, las dos aprobaciones en verde y la continuación del flujo. Los códigos de vinculación válidos o erróneos deben quedar visibles cuando sean parte de la validación.

### 6.1 Autenticación y control de acceso

#### PF-AUTH-001 — Registrar una cuenta con datos válidos

- Requerimiento relacionado: RF01
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Usuario
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-AUTH-001 Registrar una cuenta con datos válidos
    Given soy una persona sin una sesión iniciada y accedo a la pantalla de registro
    When completo el email y la password con valores válidos
    And selecciono "Crear cuenta"
    Then el sistema muestra "Registro exitoso"
    And puedo volver al login

```

#### PF-AUTH-002A–002E — Iniciar sesión y acceder al panel correspondiente al rol

- Requerimiento relacionado: RF01
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Todos los roles
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: <id> Iniciar sesión y acceder al panel correspondiente al rol
    Given tengo una cuenta activa con rol "<rol>"
    When ingreso mi email y password correctos en el login
    Then el sistema muestra una confirmación de inicio de sesión
    And accedo al dashboard correspondiente al rol "<rol>"

    Examples:
      | id           | rol                 |
      | PF-AUTH-002A | ADMIN               |
      | PF-AUTH-002B | PORTERIA            |
      | PF-AUTH-002C | DOCENTE             |
      | PF-AUTH-002D | Apoderado Primario  |
      | PF-AUTH-002E | ESTUDIANTE          |

```

#### PF-AUTH-003 — Rechazar credenciales incorrectas

- Requerimiento relacionado: RF01
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Usuario
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-AUTH-003 Rechazar credenciales incorrectas
    Given me encuentro en el login
    When ingreso un email o una password incorrectos
    Then permanezco en el login
    And el sistema muestra un mensaje comprensible sin revelar qué credencial falló

```

#### PF-AUTH-004 — Cerrar la sesión activa

- Requerimiento relacionado: RF01
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Usuario
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-AUTH-004 Cerrar la sesión activa
    Given soy un usuario autenticado
    When selecciono "Cerrar sesión"
    Then el sistema muestra una confirmación de cierre de sesión
    And vuelvo al login
    And no puedo acceder al dashboard sin autenticarme nuevamente

```

#### PF-AUTH-005 — Validar la actualización de datos del perfil

- Requerimiento relacionado: RF01
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Usuario
- Tipo de prueba: Validación
- Prioridad: Media
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-AUTH-005 Validar la actualización de datos del perfil
    Given soy un usuario autenticado y accedo a "Config"
    When actualizo mi perfil con "<dato>"
    And selecciono "Guardar cambios"
    Then el sistema muestra "<resultado>"

    Examples:
      | dato                         | resultado                                      |
      | RUT y teléfono válidos       | Actualizacion éxitosa                          |
      | RUT inválido                 | El RUT ingresado no es válido                  |
      | teléfono con formato inválido| El teléfono debe usar formato +56979999999     |

```

#### PF-ACC-001 — Mostrar navegación y dashboard según el rol

- Requerimiento relacionado: RF05
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Todos los roles
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-ACC-001 Mostrar navegación y dashboard según el rol
    Given inicio sesión con rol "<rol>"
    When visualizo la navegación principal
    Then veo "<opcion_visible>"
    And no veo "<opcion_restringida>"

    Examples:
      | rol        | opcion_visible       | opcion_restringida     |
      | ADMIN      | Portería             | una opción fuera de alcance |
      | PORTERIA   | Portería             | Vincular estudiante    |
      | DOCENTE    | Dashboard            | Portería               |
      | APODERADO  | Vincular estudiante  | Portería               |
      | ESTUDIANTE | Autenticaciones      | Vincular estudiante    |

```

#### PF-ACC-002A–002C — Restringir una pantalla no autorizada

- Requerimiento relacionado: RF05
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Todos los roles
- Tipo de prueba: Restricción de permisos
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: <id> Restringir una pantalla no autorizada
    Given estoy autenticado con rol "<rol>"
    When intento acceder directamente a "<pantalla>"
    Then el sistema me dirige a una pantalla permitida
    And no muestra las operaciones restringidas

    Examples:
      | id          | rol                 | pantalla  |
      | PF-ACC-002A | Apoderado Primario  | Portería  |
      | PF-ACC-002B | ESTUDIANTE          | Portería  |
      | PF-ACC-002C | DOCENTE             | Portería  |

```

#### PF-ACC-003 — Impedir la consulta de un estudiante ajeno

- Requerimiento relacionado: RF05
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Apoderado
- Tipo de prueba: Restricción de permisos
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-ACC-003 Impedir la consulta de un estudiante ajeno
    Given soy un apoderado autenticado
    And el estudiante solicitado no está vinculado a mi cuenta
    When intento abrir directamente su detalle
    Then el sistema no muestra la información del estudiante
    And no permite modificar sus datos

```

### 6.2 Gestión de estudiantes y apoderados

#### PF-VIN-001A–001C — Vincular un estudiante y consultar sus vínculos

- Requerimiento relacionado: RF03
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Apoderado
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-VIN-001A Vincular un estudiante mediante un código válido
    Given soy un apoderado autenticado en su dashboard
    And visualizo los estudiantes actualmente vinculados
    When accedo al panel "Vincular estudiante"
    And ingreso un código de vinculación válido
    And el código ingresado queda visible en la evidencia
    And selecciono "Vincular estudiante"
    Then el sistema muestra "Vinculación exitosa"
    And el estudiante aparece en "Estudiantes vinculados"

Scenario: PF-VIN-001B Consultar vínculos como Apoderado Primario
    Given soy un Apoderado Primario autenticado
    When accedo a "Vínculos"
    Then visualizo únicamente mis estudiantes vinculados

Scenario: PF-VIN-001C Consultar vínculos como estudiante
    Given soy un estudiante autenticado
    When accedo a "Vínculos"
    Then visualizo únicamente mis apoderados vinculados

```

#### PF-VIN-002A–002B — Informar códigos inválidos o vínculos duplicados

- Requerimiento relacionado: RF03
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Apoderado
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: <id> Informar códigos inválidos o vínculos duplicados
    Given soy un apoderado autenticado en "Vincular estudiante"
    When ingreso "<condicion>"
    And el código ingresado queda visible en la evidencia
    And selecciono "Vincular estudiante"
    Then el sistema muestra "<mensaje>"
    And no crea un nuevo vínculo

    Examples:
      | id          | condicion                              | mensaje                                         |
      | PF-VIN-002A | un código inexistente                  | Código de vinculación no válido                 |
      | PF-VIN-002B | el código de un estudiante vinculado   | Este estudiante ya está vinculado a tu cuenta  |

```

#### PF-VIN-003 — Desvincular un estudiante

- Requerimiento relacionado: RF03
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Apoderado
- Tipo de prueba: Flujo alternativo
- Prioridad: Media
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-VIN-003 Desvincular un estudiante
    Given soy un apoderado autenticado
    And visualizo un estudiante en "Estudiantes vinculados"
    When selecciono "Desvincular"
    Then el sistema muestra "Desvinculación exitosa"
    And el estudiante deja de aparecer entre mis estudiantes vinculados

```

#### PF-VIN-ADM-001 — Permitir al administrador gestionar vínculos

- Requerimiento relacionado: RF03
- Objetivo específico relacionado: OE1, OE2, OE4
- Rol principal: Administrador
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-VIN-ADM-001 Permitir al administrador gestionar vínculos
    Given soy un administrador autenticado y visualizo mi dashboard
    When abro la gestión de vínculos de un estudiante que ya tiene relaciones
    Then visualizo primero todos sus vínculos existentes
    When agrego otro Apoderado Primario
    Then visualizo el conjunto actualizado
    When abro un segundo estudiante sin relaciones
    Then visualizo explícitamente que no tiene vínculos
    When agrego su primer Apoderado Primario
    Then visualizo el nuevo vínculo en el mismo estudiante
```

#### PF-VIN-ADM-002A–002D — Restringir la gestión administrativa

- Requerimiento relacionado: RF05
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Portería, Docente, Apoderado Primario y Estudiante
- Tipo de prueba: Restricción de permisos
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: <id> Restringir la gestión administrativa para un rol no autorizado
    Given estoy autenticado con rol "<rol>"
    When intento acceder directamente a la administración de vínculos
    Then el sistema me dirige a una pantalla permitida
    And no muestra datos ni acciones administrativas

    Examples:
      | id                 | rol                 |
      | PF-VIN-ADM-002A    | PORTERIA            |
      | PF-VIN-ADM-002B    | DOCENTE             |
      | PF-VIN-ADM-002C    | Apoderado Primario  |
      | PF-VIN-ADM-002D    | ESTUDIANTE          |
```

#### PF-VIN-ADM-003–004 — Proteger y consolidar la administración de vínculos

- Requerimiento relacionado: RF03, RF05
- Objetivo específico relacionado: OE1, OE2, OE4
- Rol principal: Administrador
- Tipo de prueba: Restricción y flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-VIN-ADM-003 Impedir que el administrador se vincule mediante código
    Given soy un administrador autenticado
    When intento abrir la vinculación personal mediante código
    Then el sistema restringe el acceso

Scenario: PF-VIN-ADM-004 Consolidar, buscar y administrar vínculos individuales
    Given soy un administrador autenticado en mi dashboard
    When accedo a la administración consolidada y busco un estudiante
    Then visualizo el estudiante y todas sus personas vinculadas
    And cada vínculo presenta sus datos y acciones individuales
```

### 6.3 Ingreso y salida

#### PF-ING-001A–001B — Registrar y validar el formulario de ingreso manual

- Requerimiento relacionado: RF07
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-ING-001A Registrar manualmente el ingreso de un estudiante
    Given soy personal de portería autenticado
    And el estudiante figura "Fuera de la institución"
    When lo selecciono para un evento de "Ingreso"
    And confirmo el registro con el método permitido
    Then el sistema informa que el ingreso fue aprobado
    And el estudiante queda "Dentro de la institución"

Scenario: PF-ING-001B Explicar la política y validar la observación obligatoria
    Given soy personal de portería y preparo un ingreso manual por contingencia
    When completo la contingencia, el motivo y el resultado
    Then el resumen y la política aplicada se muestran en viñetas
    When intento continuar sin la observación obligatoria
    Then el campo se destaca y el sistema explica qué información falta

```

#### PF-ING-002 — Registrar el ingreso de varios estudiantes de un curso

- Requerimiento relacionado: RF07
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo alternativo
- Prioridad: Media
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-ING-002 Registrar el ingreso de varios estudiantes de un curso
    Given soy personal de portería autenticado
    And consulto estudiantes por curso
    When selecciono varios estudiantes que están fuera
    And confirmo el evento de "Ingreso"
    Then el sistema muestra el total de ingresos aprobados y rechazados
    And actualiza visiblemente el estado de cada operación procesada

```

#### PF-ING-003 — Rechazar un ingreso duplicado

- Requerimiento relacionado: RF07
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-ING-003 Rechazar un ingreso duplicado
    Given soy personal de portería autenticado
    And el estudiante ya figura "Dentro de la institución"
    When intento registrar otro evento de "Ingreso"
    Then el sistema informa que la operación fue rechazada
    And el estudiante conserva su estado actual
    And el rechazo aparece en "Eventos recientes"

```

#### PF-ING-004 — Confirmar un ingreso mediante QR

- Requerimiento relacionado: RF07
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-ING-004 Confirmar un ingreso mediante QR
    Given soy personal de portería autenticado
    And valido el QR vigente de un estudiante que está fuera
    When selecciono "Confirmar ingreso"
    Then el sistema muestra "Evento registrado correctamente mediante QR"
    And el estudiante queda dentro del establecimiento

```

#### PF-SAL-001 — Registrar una salida regular manual

- Requerimiento relacionado: RF08
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-SAL-001 Registrar una salida regular manual
    Given soy personal de portería autenticado
    And el estudiante figura "Dentro de la institución"
    And la política permite el método manual utilizado
    When selecciono el estudiante y registro una "Salida"
    Then el sistema informa que la salida fue aprobada
    And el estudiante queda "Fuera de la institución"

```

#### PF-SAL-002 — Rechazar una salida sin ingreso activo

- Requerimiento relacionado: RF08
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-SAL-002 Rechazar una salida sin ingreso activo
    Given soy personal de portería autenticado
    And el estudiante figura "Fuera de la institución"
    When intento registrar una "Salida"
    Then el sistema rechaza la operación con un mensaje comprensible
    And el estudiante conserva su estado
    And el rechazo queda visible en los eventos recientes

```

#### PF-SAL-003A–003C — Aplicar la política y contingencias de salida

- Requerimiento relacionado: RF08
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-SAL-003A Exigir autenticador según la política de salida
    Given soy personal de portería autenticado
    And la política institucional exige QR o PIN de forma excluyente para la salida
    And existe un estudiante que puede salir solo y otro que no puede salir solo
    When selecciono al estudiante que puede salir solo
    Then la política muestra que su salida autónoma normal exige QR
    When selecciono al estudiante que no puede salir solo
    Then la política muestra que su QR individual no autoriza la salida
    And exige de forma excluyente el PIN dual del estudiante y su responsable
    When intento registrar manualmente su salida
    Then el sistema bloquea la operación y el estudiante permanece dentro

Scenario: PF-SAL-003B Permitir una salida excepcional documentada
    Given el estudiante está dentro y no tiene permiso para salir solo
    And soy personal de portería autenticado
    When selecciono la salida "Excepcional"
    And registro la observación obligatoria
    Then el sistema permite la salida sin QR ni PIN dual
    And registra el resultado aprobado en la trazabilidad como "Excepcional"

Scenario: PF-SAL-003C Solicitar aprobación del Apoderado Primario para salida por contingencia
    Given el estudiante puede salir solo pero no dispone del autenticador exigido
    When portería documenta la contingencia y solicita autorización
    Then el Apoderado Primario puede aprobarla
    And la salida aprobada queda visible en la trazabilidad reciente

```

#### PF-SAL-004 — Confirmar una salida regular mediante QR

- Requerimiento relacionado: RF08
- Objetivo específico relacionado: OE3, OE4
- Roles participantes: Estudiante y Portería
- Tipo de prueba: Flujo exitoso de extremo a extremo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-SAL-004 Confirmar una salida regular mediante QR
    Given el estudiante figura "Dentro de la institución"
    And cumple las reglas institucionales para una salida regular
    When el estudiante autenticado accede a "Autenticaciones"
    And selecciona "Generar QR"
    Then el sistema muestra una credencial QR vigente asociada al estudiante
    When el estudiante presenta la credencial QR en portería
    And el personal de portería ingresa o escanea la credencial en "Validación QR"
    And selecciona "Validar QR"
    Then el sistema identifica al estudiante
    And muestra que se encuentra "Dentro de la institución"
    And habilita la acción "Confirmar salida"
    When el personal de portería selecciona "Confirmar salida"
    Then el sistema muestra "Evento registrado correctamente mediante QR"
    And registra una salida con método de validación "QR"
    And el estudiante queda "Fuera de la institución"
    And el evento queda visible en "Eventos recientes"

```

### 6.4 Retiro de estudiantes

#### PF-RET-001 — Notificar el retiro de un estudiante

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Apoderado
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-RET-001 Notificar el retiro de un estudiante
    Given soy un apoderado autenticado
    And tengo un estudiante vinculado que está "Dentro de la institución"
    And no existe otra solicitud activa para él
    When selecciono "Notificar retiro"
    Then el sistema muestra "Solicitud de retiro enviada al estudiante"
    And la solicitud queda esperando la respuesta del estudiante

```

#### PF-RET-002 — Rechazar la creación de un retiro no permitido

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Apoderado
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-RET-002 Rechazar la creación de un retiro no permitido
    Given soy un apoderado autenticado
    When intento notificar el retiro bajo la condición "<condicion>"
    Then el sistema muestra "<mensaje>"
    And no crea otra solicitud activa

    Examples:
      | condicion                                      | mensaje                                                        |
      | el estudiante está fuera                       | El estudiante debe encontrarse dentro de la institución        |
      | mi vínculo no está autorizado                  | El vínculo no está autorizado para realizar este retiro        |
      | ya existe una solicitud activa                 | Ya existe una solicitud de retiro activa para este estudiante  |

```

#### PF-RET-003 — Responder una solicitud de retiro como estudiante

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Estudiante
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-RET-003 Responder una solicitud de retiro como estudiante
    Given soy el estudiante destinatario de una solicitud de retiro pendiente
    When selecciono "<respuesta>"
    Then el sistema muestra "<resultado>"

    Examples:
      | respuesta | resultado                                                        |
      | Aceptar   | Solicitud aceptada. Los PIN estarán vigentes durante cinco minutos|
      | Rechazar  | Solicitud de retiro rechazada                                    |

```

#### PF-RET-004 — Completar un retiro como Apoderado Primario usando PIN dual

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-RET-004 Completar un retiro como Apoderado Primario usando PIN dual
    Given soy personal de portería autenticado
    And existe un retiro iniciado por el Apoderado Primario con ambos PIN vigentes
    And la evidencia muestra el PIN del apoderado y el PIN del estudiante
    When valido el PIN del Apoderado Primario
    And valido el PIN del estudiante
    Then la segunda validación completa automáticamente el retiro
    And ambas aprobaciones permanecen visibles en verde
    And la salida generada aparece en la trazabilidad reciente

```

#### PF-RET-005 — Rechazar PIN inválidos, vencidos o bloqueados

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-RET-005 Rechazar PIN inválidos, vencidos o bloqueados
    Given soy personal de portería autenticado
    And existe una solicitud pendiente de validación
    When intento validar un PIN "<condicion>"
    Then el sistema muestra "<mensaje>"
    And no habilita la confirmación del retiro

    Examples:
      | condicion                         | mensaje                                                        |
      | incorrecto                        | El PIN ingresado no es válido                                  |
      | que agotó el máximo de intentos   | Solicitud bloqueada por alcanzar el máximo de intentos         |
      | vencido                           | Los PIN expiraron. Debe generarse una nueva solicitud          |

Scenario: PF-RET-005 Consultar el PIN DUAL vigente y continuar el retiro
    Given existe un retiro aceptado con ambos PIN vigentes
    Then la evidencia muestra el PIN del apoderado y el PIN del estudiante
    When portería valida ambos PIN
    Then ambas aprobaciones permanecen visibles en verde
    And la salida generada aparece en la trazabilidad reciente

```

#### PF-RET-006 — Confirmar el retiro después de validar a ambas personas

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-RET-006 Confirmar el retiro después de validar a ambas personas
    Given soy personal de portería autenticado
    And la evidencia muestra el PIN del apoderado y el PIN del estudiante
    And el estudiante continúa dentro de la institución
    When valido el PIN del estudiante
    And valido el PIN del Apoderado Primario
    Then la segunda validación completa automáticamente el retiro
    And ambas aprobaciones permanecen visibles en verde
    And la solicitud aparece como "Completado"
    And el estudiante queda fuera de la institución
    And la salida generada aparece en la trazabilidad reciente

```

#### PF-RET-007 — Cancelar una solicitud de retiro activa

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Apoderado
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-RET-007 Cancelar una solicitud de retiro activa
    Given soy el apoderado que creó una solicitud de retiro no completada
    When selecciono "Cancelar"
    Then el sistema muestra "Solicitud de retiro cancelada"
    And los PIN generados dejan de ser utilizables
    And portería no puede confirmar el retiro con esa solicitud

```

#### PF-RET-008 — Rechazar excepcionalmente el retiro en portería

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-RET-008 Rechazar excepcionalmente el retiro en portería
    Given soy personal de portería autenticado
    And existe una solicitud lista para validación o con ambas personas validadas
    When selecciono "Rechazar en portería"
    And completo el motivo y la observación obligatorios
    Then el sistema muestra "Solicitud rechazada en portería"
    And el estudiante conserva el estado "Dentro de la institución"
    And la solicitud queda disponible para trazabilidad

```

#### PF-APO-SEC-001 — Registrar un Apoderado Secundario nuevo con correo y RUT

- Requerimiento relacionado: RF04
- Objetivo específico relacionado: OE2, OE3, OE4
- Rol principal: Apoderado Primario
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado y automatizado

```gherkin
Scenario: PF-APO-SEC-001 Registrar un Apoderado Secundario nuevo con correo y RUT
    Given soy un Apoderado Primario autenticado y el Apoderado Secundario aún no está vinculado
    When completo estudiante, nombre, correo, RUT y vigencia
    And selecciono "Invitar y autorizar"
    Then el sistema confirma el registro y la autorización
    And muestra el vínculo con estado "Vigente"
    And la cuenta activada del Apoderado Secundario muestra solamente al estudiante asignado
```

#### PF-APO-SEC-002 — Autorizar un Apoderado Secundario registrado previamente

- Requerimiento relacionado: RF04
- Objetivo específico relacionado: OE2, OE3, OE4
- Rol principal: Apoderado Primario
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado y automatizado

```gherkin
Scenario: PF-APO-SEC-002 Autorizar un Apoderado Secundario registrado previamente
    Given existe una cuenta de Apoderado Secundario sin estudiantes asignados
    When el Apoderado Primario la identifica mediante correo y RUT
    And autoriza el retiro de un estudiante durante un período vigente
    Then el sistema reutiliza la cuenta existente
    And muestra el nuevo vínculo como "Vigente"
    And el Apoderado Secundario puede ver al estudiante asignado
```

#### PF-APO-SEC-003 — Completar un retiro como Apoderado Secundario usando PIN dual

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE2, OE3, OE4
- Roles participantes: Apoderado Secundario, Estudiante y Portería
- Tipo de prueba: Flujo exitoso de extremo a extremo
- Prioridad: Alta
- Estado de implementación observado: Implementado y automatizado

```gherkin
Scenario: PF-APO-SEC-003 Completar un retiro como Apoderado Secundario usando PIN dual
    Given el Apoderado Secundario posee una autorización vigente para el estudiante
    When solicita el retiro
    Then el estudiante recibe el mensaje configurado
    When el estudiante acepta la solicitud
    Then estudiante y Apoderado Secundario reciben PIN diferentes
    And la evidencia muestra ambos PIN
    When portería valida ambos PIN
    Then la segunda validación completa el retiro efectivo sin aprobación adicional
    And ambas aprobaciones permanecen visibles en verde
    And el sistema registra una sola salida de tipo "RETIRO_AUTORIZADO"
    And la solicitud queda "Completado"
    And la salida generada aparece en la trazabilidad reciente
```

#### PF-APO-SEC-004 — Rechazar una solicitud con autorización secundaria no vigente

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE2, OE3, OE4
- Rol principal: Apoderado Secundario
- Tipo de prueba: Restricción de permisos
- Prioridad: Alta
- Estado de implementación observado: Implementado y automatizado

```gherkin
Scenario: PF-APO-SEC-004 Rechazar una solicitud con autorización secundaria no vigente
    Given el Apoderado Secundario mantiene abierta una vista que mostraba una autorización vigente
    And la autorización fue revocada antes de iniciar el retiro
    When selecciona "Notificar retiro"
    Then el sistema muestra un toast indicando que el vínculo no está autorizado
    And no crea una solicitud de retiro
    And al actualizar la vista el estudiante deja de estar disponible
```

#### PF-APO-SEC-005 — Revocar la autorización del apoderado secundario evita el retiro

- Requerimiento relacionado: RF04
- Objetivo específico relacionado: OE2, OE3, OE4
- Rol principal: Apoderado Primario
- Tipo de prueba: Revocación y restricción de acceso
- Prioridad: Alta
- Estado de implementación observado: Implementado y automatizado

```gherkin
Scenario: PF-APO-SEC-005 Revocar la autorización del apoderado secundario evita el retiro
    Given el Apoderado Secundario tiene una autorización vigente y puede iniciar un retiro
    When el Apoderado Primario revoca la autorización antes de iniciar el retiro
    Then la autorización deja de aparecer entre los vínculos activos
    And el Apoderado Secundario deja de ver estudiantes vinculados
    And no puede iniciar un retiro ni se crea una solicitud
```

#### PF-APO-SEC-007 — Impedir retirar un estudiante distinto del autorizado

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE2, OE3, OE4
- Rol principal: Apoderado Secundario
- Tipo de prueba: Restricción de alcance
- Prioridad: Alta
- Estado de implementación observado: Implementado y automatizado

```gherkin
Scenario: PF-APO-SEC-007 Impedir retirar un estudiante distinto del autorizado
    Given el Apoderado Secundario posee autorización vigente para un único estudiante
    Then la interfaz muestra solamente al estudiante autorizado
    When intenta solicitar mediante el servidor el retiro de otro estudiante
    Then la solicitud es rechazada como "PICKUP_NOT_AUTHORIZED"
    And no aparece un retiro adicional en la interfaz
```

### 6.5 Autorizaciones

#### PF-AUT-001 — Configurar el permiso de salida autónoma

- Requerimiento relacionado: RF04
- Objetivo específico relacionado: OE1, OE2, OE4
- Rol principal: Administrador
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-AUT-001 Configurar el permiso de salida autónoma
    Given soy un administrador autenticado en el detalle de un estudiante
    When activo o desactivo "Permitir salida por voluntad del estudiante"
    And selecciono "Guardar configuración"
    Then el sistema confirma la actualización
    And el detalle muestra si el estudiante "Puede salir solo" o "No puede salir solo"

```

#### PF-AUT-002 — Registrar y consultar un Apoderado Secundario

- Requerimiento relacionado: RF04
- Objetivo específico relacionado: OE1, OE2, OE4
- Rol principal: Administrador
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Pendiente de implementación

```gherkin
Scenario: PF-AUT-002 Registrar y consultar un Apoderado Secundario
    Given soy un administrador o apoderado autenticado
    When registro un Apoderado Secundario con su identidad y relación con el estudiante
    Then la persona aparece entre las autorizadas para el retiro
    And portería puede consultar la vigencia de su autorización

```

#### PF-AUT-003 — Revocar el permiso de un Apoderado Secundario

- Requerimiento relacionado: RF04
- Objetivo específico relacionado: OE2, OE3, OE4
- Rol principal: Administrador
- Tipo de prueba: Restricción de permisos
- Prioridad: Alta
- Estado de implementación observado: Pendiente de implementación

```gherkin
Scenario: PF-AUT-003 Revocar el permiso de un Apoderado Secundario
    Given soy un administrador o apoderado autenticado
    And existe un Apoderado Secundario autorizado para retirar a un estudiante
    When revoco su autorización
    Then el sistema muestra la autorización como revocada
    And portería no puede utilizarla para confirmar un nuevo retiro

```

#### PF-QR-001 — Generar una credencial QR temporal

- Requerimiento relacionado: RF06
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Estudiante
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-QR-001 Generar una credencial QR temporal
    Given soy un estudiante autenticado con un perfil asociado
    And no tengo una credencial QR vigente
    When accedo a "Autenticaciones"
    And selecciono "Generar QR"
    Then el sistema muestra "Credencial QR generada correctamente"
    And presenta la credencial con su hora de expiración

```

#### PF-QR-002 — Validar una credencial QR vigente en portería

- Requerimiento relacionado: RF06
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-QR-002 Validar una credencial QR vigente en portería
    Given soy personal de portería autenticado
    And el estudiante presenta una credencial QR vigente y no utilizada
    When ingreso o escaneo la credencial en "Validación QR"
    And selecciono "Validar QR"
    Then el sistema muestra "Credencial QR válida"
    And presenta el estudiante, curso, estado y autorizaciones aplicables

```

#### PF-QR-003 — Rechazar una credencial QR no utilizable

- Requerimiento relacionado: RF06
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-QR-003 Rechazar una credencial QR no utilizable
    Given soy personal de portería autenticado en "Validación QR"
    When valido una credencial "<condicion>"
    Then el sistema muestra "<mensaje>"
    And no habilita la confirmación de un evento incompatible

    Examples:
      | condicion          | mensaje                                                        |
      | con formato inválido| El código escaneado no corresponde a una credencial ValidGate |
      | expirada           | La credencial QR expiro. Solicita una nueva credencial         |
      | ya utilizada       | Esta credencial QR ya fue utilizada                            |
      | revocada           | Esta credencial QR fue revocada                                |

```

#### PF-QR-004 — Aplicar validación manual controlada

- Requerimiento relacionado: RF06
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-QR-004 Aplicar validación manual controlada
    Given soy personal de portería autenticado
    And una persona no puede presentar su mecanismo digital
    When selecciono "Validación manual controlada"
    And indico un motivo y una observación
    Then el sistema informa que la identidad fue validada mediante contingencia manual
    And mantiene visible el método utilizado para la operación

```

#### PF-QR-005 — Utilizar PIN diferentes y de un solo uso en un retiro

- Requerimiento relacionado: RF06
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-QR-005 Utilizar PIN diferentes y de un solo uso en un retiro
    Given existe una solicitud de retiro aceptada por el estudiante
    When el apoderado y el estudiante consultan su PIN
    Then cada persona visualiza únicamente su propio PIN de cinco dígitos
    And ambos PIN son diferentes y muestran su vigencia
    When portería utiliza ambos PIN para completar automáticamente el retiro
    Then ninguno de los PIN puede volver a validarse

```

#### PF-SAU-002 — Solicitar autorización cuando no puedo salir solo

- Requerimiento relacionado: RF11
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Estudiante
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-SAU-002 Solicitar autorización cuando no puedo salir solo
    Given soy un estudiante autenticado dentro de la institución
    And no tengo permiso para registrar una salida directa
    When selecciono "Solicitar autorización de salida"
    Then el sistema muestra "Solicitud enviada al apoderado"
    And la acción cambia a "Solicitud en curso"

```

#### PF-SAU-003 — Impedir una salida autónoma sin precondiciones

- Requerimiento relacionado: RF11
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Estudiante
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-SAU-003 Impedir una salida autónoma sin precondiciones
    Given soy un estudiante autenticado
    When intento registrar una salida bajo la condición "<condicion>"
    Then el sistema muestra "<mensaje>"
    And no registra mi salida

    Examples:
      | condicion                   | mensaje                                                       |
      | estoy fuera                 | Solo puedes registrar salida si figuras dentro de la institución |
      | no tengo permiso            | No estás autorizado para registrar salida directa. Solicita autorización de apoderado o responsable |
      | no tengo QR vigente         | Debes generar una credencial QR vigente antes de registrar tu salida |

```

#### PF-SOL-001 — Crear una solicitud de autorización de salida

- Requerimiento relacionado: RF12
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Estudiante
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-SOL-001 Crear una solicitud de autorización de salida
    Given soy un estudiante autenticado dentro de la institución
    And tengo al menos un apoderado vinculado
    And no existe otra solicitud activa
    When solicito autorización de salida e indico el motivo
    Then la solicitud aparece pendiente de respuesta
    And el apoderado puede verla en "Solicitudes pendientes"

```

#### PF-SOL-002A–002B — Aprobar o rechazar una solicitud de salida

- Requerimiento relacionado: RF12
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Apoderado
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-SOL-002A Aprobar el retiro de un estudiante que no puede salir solo
    Given el estudiante no tiene permiso para salir solo
    And el apoderado visualiza la solicitud vigente
    When inicia el retiro con PIN dual
    Then la evidencia muestra el PIN del apoderado y el PIN del estudiante
    When portería valida el PIN del apoderado y el PIN del estudiante
    Then la segunda validación completa el retiro sin aprobación adicional de portería
    And ambas aprobaciones permanecen visibles en verde
    And la salida generada aparece en la trazabilidad reciente

Scenario: PF-SOL-002B Rechazar la salida de un estudiante que no puede salir solo
    Given el apoderado visualiza la solicitud vigente
    When selecciona "Rechazar"
    Then el sistema muestra "Solicitud rechazada por el apoderado"
    And el rechazo aparece en la trazabilidad reciente

```

#### PF-SOL-003 — Rechazar una solicitud no válida

- Requerimiento relacionado: RF12
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Estudiante
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-SOL-003 Rechazar una solicitud no válida
    Given soy un estudiante autenticado
    When intento solicitar autorización bajo la condición "<condicion>"
    Then el sistema muestra "<mensaje>"
    And no crea una nueva solicitud pendiente

    Examples:
      | condicion                    | mensaje                                                        |
      | no tengo apoderado vinculado | No hay apoderados vinculados para recibir la solicitud         |
      | estoy fuera                  | Solo puedes solicitar salida si figuras dentro de la institución |
      | ya existe una solicitud      | La solicitud está pendiente de respuesta                       |

```

#### PF-SOL-004 — Consultar solicitudes pendientes según el rol

- Requerimiento relacionado: RF12
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Todos los roles
- Tipo de prueba: Flujo alternativo
- Prioridad: Media
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-SOL-004 Consultar solicitudes pendientes según el rol
    Given inicio sesión con rol "<rol>"
    When accedo al panel de solicitudes
    Then visualizo "<contenido>"
    And solo veo solicitudes relacionadas con mis estudiantes o institución

    Examples:
      | rol        | contenido                                      |
      | ESTUDIANTE | retiros que debo aceptar o rechazar            |
      | APODERADO  | salidas que debo aprobar o rechazar            |
      | PORTERIA   | retiros que requieren validación presencial    |
      | ADMIN      | retiros de mi institución                      |

```

### 6.6 Operaciones de portería

#### PF-REG-001 — Aplicar una política institucional a un evento compatible

- Requerimiento relacionado: RF10
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-REG-001 Aplicar una política institucional a un evento compatible
    Given soy personal de portería autenticado
    And la política vigente permite el método de validación presentado
    When registro un ingreso o salida compatible con el estado del estudiante
    Then el sistema aprueba la operación
    And muestra el método y resultado aplicados

```

#### PF-REG-002 — Rechazar un evento contrario a una política excluyente

- Requerimiento relacionado: RF10
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-REG-002 Rechazar un evento contrario a una política excluyente
    Given soy personal de portería autenticado
    And la política vigente exige un autenticador de forma excluyente
    When intento registrar un evento sin ese autenticador
    Then el sistema rechaza la operación
    And mantiene el estado anterior del estudiante
    And muestra la regla que impidió la operación

```

#### PF-REG-003 — Registrar una contingencia sin dispositivo

- Requerimiento relacionado: RF10
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-REG-003 Registrar una contingencia sin dispositivo
    Given soy personal de portería autenticado
    And la política admite contingencia para una operación sin dispositivo
    When selecciono "Contingencia sin dispositivo"
    And completo el motivo y la observación requeridos
    Then el sistema procesa la operación según la política vigente
    And muestra la contingencia y su resultado en la trazabilidad

```

### 6.7 Administración

#### PF-ADM-001 — Consultar y actualizar la configuración de un estudiante

- Requerimiento relacionado: RF02
- Objetivo específico relacionado: OE1, OE2, OE4
- Rol principal: Administrador
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado parcialmente

```gherkin
Scenario: PF-ADM-001 Consultar y actualizar la configuración de un estudiante
    Given soy un administrador autenticado
    And accedo al detalle de un estudiante de mi institución
    When actualizo su RUT, teléfono o permiso de salida autónoma con valores válidos
    And selecciono "Guardar configuración"
    Then el sistema muestra una confirmación visible
    And el detalle presenta la información actualizada

```

#### PF-ADM-002 — Rechazar datos inválidos al actualizar un estudiante

- Requerimiento relacionado: RF02
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Administrador
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-ADM-002 Rechazar datos inválidos al actualizar un estudiante
    Given soy un administrador autenticado en "Configuración del estudiante"
    When ingreso "<dato_invalido>"
    And selecciono "Guardar configuración"
    Then el sistema muestra "<mensaje>"
    And conserva la información válida anterior

    Examples:
      | dato_invalido               | mensaje                                      |
      | un RUT inválido             | El RUT ingresado no es válido                |
      | un teléfono fuera de formato| El teléfono debe usar formato +56979999999   |

```

#### PF-ADM-003 — Gestionar el ciclo de vida administrativo de un estudiante

- Requerimiento relacionado: RF02
- Objetivo específico relacionado: OE1, OE2, OE4
- Rol principal: Administrador
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Pendiente de implementación

```gherkin
Scenario: PF-ADM-003 Gestionar el ciclo de vida administrativo de un estudiante
    Given soy un administrador autenticado
    When registro un estudiante con institución, curso y datos de identificación válidos
    Then el estudiante aparece en la institución y en el curso seleccionado
    When desactivo al estudiante
    Then deja de estar disponible para nuevas operaciones de acceso
    But su historial permanece disponible para trazabilidad

```

#### PF-ADM-004 — Configurar la política de ingreso y salida

- Requerimiento relacionado: RF13
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Administrador
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado parcialmente

```gherkin
Scenario: PF-ADM-004 Configurar la política de ingreso y salida
    Given soy un administrador autenticado en "Config"
    When defino si ingreso y salida exigen QR o PIN
    And configuro si el autenticador es excluyente y si se exige observación
    And selecciono "Guardar política de acceso"
    Then el sistema muestra "Política de acceso actualizada"
    And portería aplica la nueva política en las operaciones posteriores

```

#### PF-ADM-005 — Configurar el retiro con PIN dual

- Requerimiento relacionado: RF13
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Administrador
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-ADM-005 Configurar el retiro con PIN dual
    Given soy un administrador autenticado en "Retiro con PIN dual"
    When ingreso una vigencia entre 1 y 60 minutos
    And un máximo de intentos entre 1 y 10
    And un mensaje no vacío para el estudiante
    And selecciono "Guardar configuración de retiro"
    Then el sistema muestra "Configuración de retiro actualizada"

```

#### PF-ADM-006 — Rechazar configuraciones institucionales no permitidas

- Requerimiento relacionado: RF13
- Objetivo específico relacionado: OE2, OE3, OE4
- Rol principal: Administrador
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-ADM-006 Rechazar configuraciones institucionales no permitidas
    Given estoy en la configuración institucional con rol "<rol>"
    When intento guardar "<condicion>"
    Then el sistema muestra "<mensaje>"
    And no aplica la configuración inválida

    Examples:
      | rol       | condicion                          | mensaje                                             |
      | ADMIN     | vigencia de PIN fuera de 1 a 60    | La vigencia del PIN debe estar entre 1 y 60 minutos|
      | ADMIN     | intentos fuera de 1 a 10           | Los intentos deben estar entre 1 y 10               |
      | APODERADO | una política institucional          | No tienes permisos para modificar esta configuración|

```

### 6.8 Trazabilidad y consulta de eventos

#### PF-TRA-001 — Consultar eventos recientes de la institución

- Requerimiento relacionado: RF14
- Objetivo específico relacionado: OE1, OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado parcialmente

```gherkin
Scenario: PF-TRA-001 Consultar eventos recientes de la institución
    Given soy personal de portería autenticado
    When accedo a "Eventos recientes"
    Then visualizo los eventos de la institución ordenados desde el más reciente
    And cada evento muestra estudiante, operación, método, resultado y fecha y hora

```

#### PF-TRA-002A–002E — Limitar la trazabilidad según rol y vinculación

- Requerimiento relacionado: RF14
- Objetivo específico relacionado: OE2, OE3, OE4
- Rol principal: Todos los roles
- Tipo de prueba: Restricción de permisos
- Prioridad: Alta
- Estado de implementación observado: Implementado y automatizado

```gherkin
Scenario: PF-TRA-002A Aislar la trazabilidad entre familias distintas
    Given el Apoderado A está vinculado al Estudiante 1
    And el Apoderado B está vinculado al Estudiante 2
    And ambos estudiantes tienen eventos identificables
    When cada apoderado y estudiante consulta la trazabilidad reciente
    Then visualiza únicamente los eventos de su familia
    And cada elemento visible incluye estudiante, operación, método, resultado, descripción y fecha

Scenario: PF-TRA-002B Limitar administrador y portería a su institución
    Given existen eventos identificables en la institución propia y en una institución ajena
    When administrador y portería consultan la trazabilidad reciente
    Then visualizan los eventos completos de su institución
    And no visualizan el evento de la institución ajena

Scenario: PF-TRA-002C Limitar al Apoderado Secundario y conservar su historial
    Given el Apoderado Secundario tiene una autorización vigente para un estudiante
    And existe un retiro histórico iniciado por ese Apoderado Secundario
    When consulta la trazabilidad con autorización vigente
    Then visualiza el evento del estudiante autorizado y su retiro histórico
    When la autorización es revocada o queda vencida
    Then deja de visualizar los eventos generales del estudiante
    But conserva su propio retiro histórico con estudiante, tipo, estado, descripción y fecha

Scenario: PF-TRA-002D Aislar al docente de otra institución
    Given existen eventos identificables en dos instituciones
    When un docente consulta la trazabilidad reciente
    Then visualiza todos los eventos completos de su institución
    And no visualiza eventos de la institución ajena

Scenario: PF-TRA-002E Mostrar la misma trazabilidad institucional a dos docentes
    Given dos docentes pertenecen a la misma institución
    When ambos consultan la trazabilidad reciente
    Then ambos visualizan exactamente los mismos elementos y datos
    And ninguno visualiza eventos de otra institución

```

#### PF-TRA-003 — Consultar el registro funcional completo de una operación

- Requerimiento relacionado: RF14
- Objetivo específico relacionado: OE1, OE3, OE4
- Rol principal: Usuario autorizado
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Pendiente de implementación

```gherkin
Scenario: PF-TRA-003 Consultar el registro funcional completo de una operación
    Given soy un usuario autorizado para consultar un evento
    When abro el registro de una operación de ingreso, salida o retiro
    Then visualizo el estudiante, tipo de operación, método y resultado
    And visualizo la fecha, hora y responsable de la operación
    And visualizo el estado, motivo u observación cuando corresponda

```

#### PF-TRA-004 — Informar que todavía no existen eventos

- Requerimiento relacionado: RF14
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Usuario autorizado
- Tipo de prueba: Flujo alternativo
- Prioridad: Media
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-TRA-004 Informar que todavía no existen eventos
    Given soy un usuario autenticado sin eventos visibles en mi alcance
    When accedo a la sección de trazabilidad
    Then el sistema muestra que aún no hay eventos registrados para mostrar
    And no presenta información perteneciente a otros usuarios o instituciones
```

### 6.9 Validaciones y manejo de errores

Las validaciones y errores se prueban junto al flujo al que pertenecen para evitar duplicación. Los escenarios principales son PF-AUTH-003, PF-AUTH-005, PF-ADM-002, PF-VIN-002A/002B, PF-ACC-002A/002B/002C, PF-ACC-003, PF-QR-003, PF-ING-003, PF-SAL-002, PF-SAL-003A/003B/003C, PF-RET-002, PF-RET-005, PF-APO-SEC-004, PF-APO-SEC-005, PF-APO-SEC-007, PF-REG-002, PF-SAU-003, PF-SOL-003 y PF-ADM-006.

## 7. Matriz de trazabilidad

Convención de identificación: cuando un escenario conceptual se ejecuta para varios roles o variantes, cada fila automatizada utiliza un sufijo alfabético (`A`, `B`, `C`...). Así, el identificador base conserva su relación con el plan, pero cada resultado y evidencia del reporte tiene un ID único. Los saltos numéricos corresponden a casos pendientes o retirados y no se renumeran para evitar romper la trazabilidad histórica.

| ID escenario | Nombre del escenario | Requerimiento funcional | Objetivo específico | Rol | Tipo de prueba | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| PF-AUTH-001 | Registrar una cuenta con datos válidos | RF01 | OE2, OE4 | Usuario | Flujo exitoso | Pendiente de automatización |
| PF-AUTH-002A | Iniciar sesión como administrador | RF01 | OE2, OE4 | Administrador | Flujo exitoso | Automatizado |
| PF-AUTH-002B | Iniciar sesión como portería | RF01 | OE2, OE4 | Portería | Flujo exitoso | Automatizado |
| PF-AUTH-002C | Iniciar sesión como docente | RF01 | OE2, OE4 | Docente | Flujo exitoso | Automatizado |
| PF-AUTH-002D | Iniciar sesión como Apoderado Primario | RF01 | OE2, OE4 | Apoderado Primario | Flujo exitoso | Automatizado |
| PF-AUTH-002E | Iniciar sesión como estudiante | RF01 | OE2, OE4 | Estudiante | Flujo exitoso | Automatizado |
| PF-AUTH-003 | Rechazar credenciales incorrectas | RF01 | OE2, OE4 | Usuario | Validación | Automatizado |
| PF-AUTH-004 | Cerrar la sesión activa | RF01 | OE2, OE4 | Usuario | Flujo exitoso | Pendiente de automatización |
| PF-AUTH-005 | Validar la actualización de datos del perfil | RF01 | OE2, OE4 | Usuario | Validación | Pendiente de automatización |
| PF-ACC-001 | Mostrar navegación y dashboard según el rol | RF05 | OE2, OE4 | Todos los roles | Flujo exitoso | Pendiente de automatización |
| PF-ACC-002A | Restringir portería para Apoderado Primario | RF05 | OE2, OE4 | Apoderado Primario | Restricción de permisos | Automatizado |
| PF-ACC-002B | Restringir portería para estudiante | RF05 | OE2, OE4 | Estudiante | Restricción de permisos | Automatizado |
| PF-ACC-002C | Restringir portería para docente | RF05 | OE2, OE4 | Docente | Restricción de permisos | Automatizado |
| PF-ACC-003 | Impedir la consulta de un estudiante ajeno | RF05 | OE2, OE4 | Apoderado Primario | Restricción de permisos | Automatizado |
| PF-ADM-001 | Consultar y actualizar la configuración de un estudiante | RF02 | OE1, OE2, OE4 | Administrador | Flujo exitoso | Pendiente de automatización |
| PF-ADM-002 | Rechazar datos inválidos al actualizar un estudiante | RF02 | OE2, OE4 | Administrador | Validación | Pendiente de automatización |
| PF-ADM-003 | Gestionar el ciclo de vida administrativo de un estudiante | RF02 | OE1, OE2, OE4 | Administrador | Flujo alternativo | Pendiente de automatización |
| PF-VIN-001A | Vincular un estudiante mediante un código válido | RF03 | OE2, OE4 | Apoderado Primario | Flujo exitoso | Automatizado |
| PF-VIN-001B | Consultar vínculos como Apoderado Primario | RF03 | OE2, OE4 | Apoderado Primario | Flujo exitoso | Automatizado |
| PF-VIN-001C | Consultar vínculos como estudiante | RF03 | OE2, OE4 | Estudiante | Flujo exitoso | Automatizado |
| PF-VIN-002A | Rechazar un código de vinculación inválido | RF03 | OE2, OE4 | Apoderado Primario | Validación | Automatizado |
| PF-VIN-002B | Informar un vínculo duplicado | RF03 | OE2, OE4 | Apoderado Primario | Validación | Automatizado |
| PF-VIN-003 | Desvincular un estudiante | RF03 | OE2, OE4 | Apoderado Primario | Flujo alternativo | Pendiente de automatización |
| PF-VIN-ADM-001 | Permitir al administrador gestionar vínculos | RF03 | OE1, OE2, OE4 | Administrador | Flujo exitoso | Automatizado en estudiantes con y sin vínculos previos |
| PF-VIN-ADM-002A | Restringir gestión administrativa para portería | RF05 | OE2, OE4 | Portería | Restricción de permisos | Automatizado |
| PF-VIN-ADM-002B | Restringir gestión administrativa para docente | RF05 | OE2, OE4 | Docente | Restricción de permisos | Automatizado |
| PF-VIN-ADM-002C | Restringir gestión administrativa para Apoderado Primario | RF05 | OE2, OE4 | Apoderado Primario | Restricción de permisos | Automatizado |
| PF-VIN-ADM-002D | Restringir gestión administrativa para estudiante | RF05 | OE2, OE4 | Estudiante | Restricción de permisos | Automatizado |
| PF-VIN-ADM-003 | Impedir que el administrador se vincule mediante código | RF03, RF05 | OE2, OE4 | Administrador | Restricción de permisos | Automatizado |
| PF-VIN-ADM-004 | Consolidar, buscar y administrar vínculos individuales | RF03 | OE1, OE2, OE4 | Administrador | Flujo exitoso | Automatizado |
| PF-AUT-001 | Configurar el permiso de salida autónoma | RF04 | OE1, OE2, OE4 | Administrador | Flujo exitoso | Pendiente de automatización |
| PF-AUT-002 | Registrar y consultar un Apoderado Secundario | RF04 | OE1, OE2, OE4 | Administrador | Flujo exitoso | Cobertura parcial mediante PF-APO-SEC-001/002 |
| PF-AUT-003 | Revocar el permiso de un Apoderado Secundario | RF04 | OE2, OE3, OE4 | Administrador | Restricción de permisos | Cobertura parcial mediante PF-APO-SEC-005 |
| PF-QR-001 | Generar una credencial QR temporal | RF06 | OE3, OE4 | Estudiante | Flujo exitoso | Pendiente de automatización |
| PF-QR-002 | Validar una credencial QR vigente en portería | RF06 | OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-QR-003 | Rechazar una credencial QR no utilizable | RF06 | OE3, OE4 | Portería | Validación | Pendiente de automatización |
| PF-QR-004 | Aplicar validación manual controlada | RF06 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-QR-005 | Utilizar PIN diferentes y de un solo uso en un retiro | RF06 | OE3, OE4 | Portería | Validación | Cubierto mediante PF-APO-SEC-003 |
| PF-ING-001A | Registrar manualmente el ingreso de un estudiante | RF07 | OE3, OE4 | Portería | Flujo exitoso | Automatizado |
| PF-ING-001B | Explicar la política y validar la observación obligatoria | RF07 | OE3, OE4 | Portería | Validación de formulario | Automatizado |
| PF-ING-002 | Registrar el ingreso de varios estudiantes de un curso | RF07 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-ING-003 | Rechazar un ingreso duplicado | RF07 | OE3, OE4 | Portería | Validación | Automatizado |
| PF-ING-004 | Confirmar un ingreso mediante QR | RF07 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-SAL-001 | Registrar una salida regular manual | RF08 | OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-SAL-002 | Rechazar una salida sin ingreso activo | RF08 | OE3, OE4 | Portería | Validación | Pendiente de automatización |
| PF-SAL-003A | Exigir autenticador según la política de salida | RF08 | OE3, OE4 | Portería | Validación | Automatizado |
| PF-SAL-003B | Permitir una salida excepcional documentada | RF08 | OE3, OE4 | Portería | Flujo excepcional | Automatizado |
| PF-SAL-003C | Solicitar aprobación del Apoderado Primario por contingencia | RF08 | OE3, OE4 | Portería y Apoderado Primario | Flujo de contingencia | Automatizado |
| PF-SAL-004 | Confirmar una salida regular mediante QR | RF08 | OE3, OE4 | Estudiante y Portería | Flujo exitoso de extremo a extremo | Automatizado |
| PF-RET-001 | Notificar el retiro de un estudiante | RF09 | OE3, OE4 | Apoderado Primario | Flujo exitoso | Automatizado |
| PF-RET-002 | Rechazar la creación de un retiro no permitido | RF09 | OE3, OE4 | Apoderado Primario | Validación | Pendiente de automatización |
| PF-RET-003 | Responder una solicitud de retiro como estudiante | RF09 | OE3, OE4 | Estudiante | Flujo alternativo | Cobertura parcial: rechazo automatizado |
| PF-RET-004 | Completar un retiro como Apoderado Primario usando PIN dual | RF09 | OE3, OE4 | Portería | Flujo exitoso | Automatizado: apoderado antes que estudiante |
| PF-RET-005 | Rechazar PIN inválidos, vencidos o bloqueados | RF09 | OE3, OE4 | Portería | Validación | Cobertura parcial: consulta de PIN vigente |
| PF-RET-006 | Confirmar el retiro después de validar a ambas personas | RF09 | OE3, OE4 | Portería | Flujo exitoso | Automatizado |
| PF-RET-007 | Cancelar una solicitud de retiro activa | RF09 | OE3, OE4 | Apoderado Primario | Flujo alternativo | Pendiente de automatización |
| PF-RET-008 | Rechazar excepcionalmente el retiro en portería | RF09 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-APO-SEC-001 | Registrar un Apoderado Secundario nuevo con correo y RUT | RF04 | OE2, OE3, OE4 | Apoderado Primario | Flujo exitoso | Automatizado |
| PF-APO-SEC-002 | Autorizar un Apoderado Secundario registrado previamente | RF04 | OE2, OE3, OE4 | Apoderado Primario | Flujo alternativo | Automatizado |
| PF-APO-SEC-003 | Completar un retiro como Apoderado Secundario usando PIN dual | RF09 | OE2, OE3, OE4 | Apoderado Secundario, Estudiante y Portería | Flujo exitoso E2E | Automatizado; requiere migración 027 |
| PF-APO-SEC-004 | Rechazar una solicitud con autorización secundaria no vigente | RF09 | OE2, OE3, OE4 | Apoderado Secundario | Restricción de permisos | Automatizado |
| PF-APO-SEC-005 | Revocar la autorización del apoderado secundario evita el retiro | RF04 | OE2, OE3, OE4 | Apoderado Primario y Apoderado Secundario | Revocación y restricción | Automatizado |
| PF-APO-SEC-007 | Impedir retirar un estudiante distinto del autorizado | RF09 | OE2, OE3, OE4 | Apoderado Secundario | Restricción de alcance | Automatizado |
| PF-REG-001 | Aplicar una política institucional a un evento compatible | RF10 | OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-REG-002 | Rechazar un evento contrario a una política excluyente | RF10 | OE3, OE4 | Portería | Validación | Pendiente de automatización |
| PF-REG-003 | Registrar una contingencia sin dispositivo | RF10 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-SAU-002 | Solicitar autorización cuando no puedo salir solo | RF11 | OE3, OE4 | Estudiante | Flujo alternativo | Pendiente de automatización |
| PF-SAU-003 | Impedir una salida autónoma sin precondiciones | RF11 | OE3, OE4 | Estudiante | Validación | Pendiente de automatización |
| PF-SOL-001 | Crear una solicitud de autorización de salida | RF12 | OE3, OE4 | Estudiante | Flujo exitoso | Pendiente de automatización |
| PF-SOL-002A | Aprobar el retiro de un estudiante que no puede salir solo | RF12 | OE3, OE4 | Apoderado Primario | Flujo exitoso | Automatizado |
| PF-SOL-002B | Rechazar la salida de un estudiante que no puede salir solo | RF12 | OE3, OE4 | Apoderado Primario | Flujo alternativo | Automatizado |
| PF-SOL-003 | Rechazar una solicitud no válida | RF12 | OE3, OE4 | Estudiante | Validación | Pendiente de automatización |
| PF-SOL-004 | Consultar solicitudes pendientes según el rol | RF12 | OE3, OE4 | Todos los roles | Flujo alternativo | Pendiente de automatización |
| PF-ADM-004 | Configurar la política de ingreso y salida | RF13 | OE3, OE4 | Administrador | Flujo exitoso | Pendiente de automatización |
| PF-ADM-005 | Configurar el retiro con PIN dual | RF13 | OE3, OE4 | Administrador | Flujo exitoso | Pendiente de automatización |
| PF-ADM-006 | Rechazar configuraciones institucionales no permitidas | RF13 | OE2, OE3, OE4 | Administrador | Validación | Pendiente de automatización |
| PF-TRA-001 | Consultar eventos recientes de la institución | RF14 | OE1, OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-TRA-002A | Aislar trazabilidad entre familias distintas | RF14 | OE2, OE3, OE4 | Apoderados y Estudiantes | Restricción de permisos | Automatizado |
| PF-TRA-002B | Limitar administrador y portería a su institución | RF14 | OE2, OE3, OE4 | Administrador y Portería | Restricción institucional | Automatizado |
| PF-TRA-002C | Limitar al Apoderado Secundario y conservar su retiro histórico | RF14 | OE2, OE3, OE4 | Apoderado Secundario | Restricción temporal | Automatizado |
| PF-TRA-002D | Aislar al docente de otra institución | RF14 | OE2, OE3, OE4 | Docente | Restricción institucional | Automatizado |
| PF-TRA-002E | Mostrar el mismo alcance a dos docentes | RF14 | OE2, OE3, OE4 | Docentes | Consistencia por rol | Automatizado |
| PF-TRA-003 | Consultar el registro funcional completo de una operación | RF14 | OE1, OE3, OE4 | Usuario autorizado | Flujo exitoso | Pendiente de automatización |
| PF-TRA-004 | Informar que todavía no existen eventos | RF14 | OE3, OE4 | Usuario autorizado | Flujo alternativo | Pendiente de automatización |

## 8. Observaciones y funcionalidades pendientes

1. **RF01:** no se observó recuperación de contraseña. El registro no permite escoger rol y algunos errores provienen directamente del proveedor de autenticación.
2. **RF02:** existe consulta y actualización parcial del estudiante, pero no una interfaz administrativa completa para crear, asignar curso y desactivar. PF-ADM-003 queda pendiente de implementación.
3. **RF03:** la vinculación acepta códigos inválidos y duplicados, pero no se observó vencimiento de códigos de vinculación.
4. **RF04:** existe interfaz para registrar o reutilizar un Apoderado Secundario mediante correo y RUT, asignarle un estudiante con vigencia y revocar anticipadamente la autorización. No existe todavía edición directa del período: el Apoderado Primario debe revocar y crear una nueva autorización.
5. **RF05:** el código define seis roles técnicos, incluido `RETIRADOR_AUTORIZADO`, presentado funcionalmente como Apoderado Secundario, mientras la métrica de OE2 declara acceso diferenciado para cuatro roles. Debe actualizarse o aclararse el universo de esa métrica.
6. **RF06:** el QR es temporal y de un solo uso, pero la interfaz actual valida un payload pegado o escaneado externamente; no se observó lector de cámara ni revocación explícita por el usuario.
7. **RF08 y RF10:** se aplican estado, permiso, autenticador, observación y contingencia; no se observó una validación completa de horarios institucionales para la salida regular.
8. **RF09:** el repositorio contiene retiro con PIN dual, cancelación, rechazo en portería y retiro por Apoderado Secundario temporalmente autorizado. PF-APO-SEC-003 requiere que la migración `027_fix_confirm_guardian_pickup_request_id.sql` esté aplicada para completar la confirmación final.
9. **RF12:** existen solicitudes de salida con aprobación o rechazo y solicitudes de retiro cancelables; no se observó cancelación del flujo de autorización iniciado por el estudiante.
10. **RF13:** se configuran reglas de autenticador y parámetros del PIN dual, pero no horarios, gestión general de roles ni todos los criterios descritos por RF13.
11. **RF14:** se muestran eventos recientes y alcance por rol, pero no existe una vista de historial integral con filtros y responsable visible en cada registro. PF-TRA-003 queda pendiente.
12. Existe una suite funcional Playwright ejecutable con **47 pruebas descubiertas** en Chromium y **47 IDs únicos**. El smoke de demo utiliza una configuración independiente y no forma parte del informe funcional.
13. **Control de interfaz:** el detalle muestra “Configuración del estudiante” a usuarios vinculados que no son administradores, aunque la actualización queda limitada por las políticas de datos. La visibilidad de esa acción debería alinearse con el permiso declarado para evitar un rechazo tardío y genérico.
14. **Control de rutas:** la navegación oculta “Vincular estudiante” a roles sin permiso, pero la ruta de vinculación no realiza por sí sola la misma comprobación de rol. Debe reforzarse antes de aprobar completamente RF05.
15. **Acceso del estudiante:** la consulta del detalle usa la vinculación de apoderado para usuarios que no son personal institucional; conviene verificar y corregir el acceso del estudiante a su propia ficha.

### Resumen de cobertura

- Filas de la matriz funcional principal: **84**, todas con identificador único.
- IDs funcionales automatizados ejecutables: **47**.
- Pruebas descubiertas por la configuración funcional de Playwright: **47**.
- Smoke técnico de demo: **1**, ejecutado separadamente y excluido del informe funcional.
- Requerimientos sin cobertura: **ninguno**.
- Objetivos específicos sin cobertura: **ninguno**.

| Rol principal | Escenarios |
| --- | ---: |
| Administrador | 13 |
| Administrador y Portería | 1 |
| Apoderado Primario | 17 |
| Apoderado Secundario | 3 |
| Apoderado Secundario, Estudiante y Portería | 1 |
| Apoderados y Estudiantes | 1 |
| Docente | 4 |
| Docentes | 1 |
| Estudiante | 10 |
| Estudiante y Portería | 1 |
| Portería | 23 |
| Portería y Apoderado Primario | 1 |
| Todos los roles | 2 |
| Usuario | 4 |
| Usuario autorizado | 2 |

Los escenarios PF-TRA-002D y PF-TRA-002E documentan explícitamente el alcance institucional compartido por los docentes durante el MVP.

| Requerimiento | Escenarios |
| --- | ---: |
| RF01 | 9 |
| RF02 | 3 |
| RF03 | 9 |
| RF04 | 6 |
| RF05 | 10 |
| RF06 | 5 |
| RF07 | 5 |
| RF08 | 6 |
| RF09 | 11 |
| RF10 | 3 |
| RF11 | 2 |
| RF12 | 5 |
| RF13 | 3 |
| RF14 | 8 |

### Próximas brechas recomendadas para automatización

1. Completar PF-RET-003, PF-RET-004 y PF-RET-005 con aceptación/rechazo, orden inverso de PIN y PIN incorrecto, vencido o bloqueado por intentos.
2. Automatizar PF-RET-007 y PF-RET-008: cancelación voluntaria y rechazo excepcional en portería.
3. Automatizar PF-SAU-003 y PF-SOL-001/003/004 para cubrir restricciones y consulta por rol.
4. Automatizar PF-TRA-001 para ampliar la consulta operacional de eventos recientes de portería.
5. Incorporar expiración temporal de autorizaciones y edición/reemplazo de períodos como nuevos escenarios RF04.
