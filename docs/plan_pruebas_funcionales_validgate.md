# Plan de pruebas funcionales de VALIDGATE

## 1. Objetivo del plan de pruebas

Verificar desde la interfaz que VALIDGATE cumple sus requerimientos funcionales y objetivos específicos en los flujos de autenticación, vinculación, ingreso, salida, retiro, autorización, administración y trazabilidad. El plan sirve como base para futuras pruebas end-to-end con Playwright; no representa resultados ejecutados ni comportamientos aprobados.

## 2. Alcance

El alcance comprende los 14 requerimientos funcionales RF01–RF14 del archivo vigente de requerimientos, las capacidades observables del repositorio local y los cuatro objetivos específicos del documento de tesis actualizado. Incluye flujos exitosos, validaciones, alternativas, restricciones por rol y manejo de errores. No incluye selectores, consultas directas a la base de datos, pruebas de rendimiento, seguridad ofensiva ni código Playwright.

Cuando un comportamiento está documentado pero no cuenta con interfaz completa, el escenario se conserva para trazabilidad y se marca como pendiente de implementación. El código y el vocabulario visible de la interfaz prevalecen para definir lo que hoy puede automatizarse.

## 3. Roles considerados

| Rol | Alcance funcional observado |
| --- | --- |
| Administrador | Configuración institucional, estudiantes, políticas y operaciones de portería. |
| Portería | Validación de identidad, ingresos, salidas, retiros y eventos recientes. |
| Docente | Dashboard, cursos, asistencia y detalle autorizado; sin operaciones de portería. |
| Apoderado | Estudiantes vinculados, solicitudes, retiros, credenciales y trazabilidad relacionada. |
| Estudiante | Estado personal, QR, salida autónoma, solicitudes y respuesta a retiros. |

## 4. Criterios de entrada

- Entorno controlado disponible y compilación de la aplicación satisfactoria.
- Migraciones aplicadas en el orden previsto y datos de prueba aislados por institución.
- Cuentas activas para los cinco roles y relaciones estudiante-apoderado preparadas.
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

#### PF-AUTH-002 — Iniciar sesión y acceder al panel correspondiente al rol

- Requerimiento relacionado: RF01
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Todos los roles
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-AUTH-002 Iniciar sesión y acceder al panel correspondiente al rol
    Given tengo una cuenta activa con rol "<rol>"
    When ingreso mi email y password correctos en el login
    Then el sistema muestra una confirmación de inicio de sesión
    And accedo al dashboard correspondiente al rol "<rol>"

    Examples:
      | rol         |
      | ADMIN       |
      | PORTERIA    |
      | DOCENTE     |
      | APODERADO   |
      | ESTUDIANTE  |

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

#### PF-ACC-002 — Restringir una pantalla no autorizada

- Requerimiento relacionado: RF05
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Todos los roles
- Tipo de prueba: Restricción de permisos
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-ACC-002 Restringir una pantalla no autorizada
    Given estoy autenticado con rol "<rol>"
    When intento acceder directamente a "<pantalla>"
    Then el sistema me dirige a una pantalla permitida
    And no muestra las operaciones restringidas

    Examples:
      | rol        | pantalla  |
      | APODERADO  | Portería  |
      | ESTUDIANTE | Portería  |
      | DOCENTE    | Autenticaciones |

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

#### PF-VIN-001 — Vincular un estudiante mediante un código válido

- Requerimiento relacionado: RF03
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Apoderado
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-VIN-001 Vincular un estudiante mediante un código válido
    Given soy un apoderado autenticado y accedo a "Vincular estudiante"
    When ingreso un código de vinculación válido
    And selecciono "Vincular estudiante"
    Then el sistema muestra "Vinculación exitosa"
    And el estudiante aparece en "Estudiantes vinculados"

```

#### PF-VIN-002 — Informar códigos inválidos o vínculos duplicados

- Requerimiento relacionado: RF03
- Objetivo específico relacionado: OE2, OE4
- Rol principal: Apoderado
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-VIN-002 Informar códigos inválidos o vínculos duplicados
    Given soy un apoderado autenticado en "Vincular estudiante"
    When ingreso "<condicion>"
    And selecciono "Vincular estudiante"
    Then el sistema muestra "<mensaje>"
    And no crea un nuevo vínculo

    Examples:
      | condicion                         | mensaje                                               |
      | un código inexistente             | Código de vinculación no válido                       |
      | el código de un estudiante vinculado| Este estudiante ya está vinculado a tu cuenta       |

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

### 6.3 Ingreso y salida

#### PF-ING-001 — Registrar manualmente el ingreso de un estudiante

- Requerimiento relacionado: RF07
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-ING-001 Registrar manualmente el ingreso de un estudiante
    Given soy personal de portería autenticado
    And el estudiante figura "Fuera de la institución"
    When lo selecciono para un evento de "Ingreso"
    And confirmo el registro con el método permitido
    Then el sistema informa que el ingreso fue aprobado
    And el estudiante queda "Dentro de la institución"

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

#### PF-SAL-003 — Exigir autenticador según la política de salida

- Requerimiento relacionado: RF08
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Validación
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-SAL-003 Exigir autenticador según la política de salida
    Given soy personal de portería autenticado
    And la política institucional exige QR o PIN de forma excluyente para la salida
    When intento registrar una salida manual sin presentar el autenticador
    Then el sistema rechaza la salida
    And muestra que falta el autenticador requerido

```

#### PF-SAL-004 — Confirmar una salida regular mediante QR

- Requerimiento relacionado: RF08
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-SAL-004 Confirmar una salida regular mediante QR
    Given soy personal de portería autenticado
    And valido el QR de un estudiante que está dentro y cumple las reglas de salida
    When selecciono "Confirmar salida"
    Then el sistema confirma el evento mediante QR
    And el estudiante queda fuera del establecimiento

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

#### PF-RET-004 — Validar los PIN en cualquier orden

- Requerimiento relacionado: RF09
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Portería
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-RET-004 Validar los PIN en cualquier orden
    Given soy personal de portería autenticado
    And existe un retiro pendiente de validación con ambos PIN vigentes
    When valido primero el PIN del "<primer_actor>"
    Then el sistema marca a esa persona como validada
    And mantiene a la otra persona pendiente
    When valido el PIN de la otra persona
    Then el sistema muestra "Ambos validados"
    And habilita "Confirmar retiro"

    Examples:
      | primer_actor |
      | Apoderado    |
      | Estudiante   |

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
    And la solicitud muestra "Ambos validados"
    And el estudiante continúa dentro de la institución
    When selecciono "Confirmar retiro"
    Then el sistema muestra "Retiro confirmado y salida registrada"
    And la solicitud aparece como "Completado"
    And el estudiante queda fuera de la institución

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

#### PF-AUT-002 — Registrar y consultar una persona autorizada para retiro

- Requerimiento relacionado: RF04
- Objetivo específico relacionado: OE1, OE2, OE4
- Rol principal: Administrador
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Pendiente de implementación

```gherkin
Scenario: PF-AUT-002 Registrar y consultar una persona autorizada para retiro
    Given soy un administrador o apoderado autenticado
    When registro una persona autorizada con su identidad y relación con el estudiante
    Then la persona aparece entre las autorizadas para el retiro
    And portería puede consultar la vigencia de su autorización

```

#### PF-AUT-003 — Revocar el permiso de una persona autorizada

- Requerimiento relacionado: RF04
- Objetivo específico relacionado: OE2, OE3, OE4
- Rol principal: Administrador
- Tipo de prueba: Restricción de permisos
- Prioridad: Alta
- Estado de implementación observado: Pendiente de implementación

```gherkin
Scenario: PF-AUT-003 Revocar el permiso de una persona autorizada
    Given soy un administrador o apoderado autenticado
    And existe una persona autorizada para retirar a un estudiante
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
    When portería utiliza ambos PIN para completar el retiro
    Then ninguno de los PIN puede volver a validarse

```

#### PF-SAU-001 — Registrar una salida autónoma

- Requerimiento relacionado: RF11
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Estudiante
- Tipo de prueba: Flujo exitoso
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario: PF-SAU-001 Registrar una salida autónoma
    Given soy un estudiante autenticado
    And estoy dentro de la institución
    And tengo permiso para salir solo y un QR vigente
    When selecciono "Registrar salida"
    Then el sistema muestra "Salida registrada correctamente"
    And mi estado cambia a "Fuera de la institución"

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

#### PF-SOL-002 — Aprobar o rechazar una solicitud de salida

- Requerimiento relacionado: RF12
- Objetivo específico relacionado: OE3, OE4
- Rol principal: Apoderado
- Tipo de prueba: Flujo alternativo
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-SOL-002 Aprobar o rechazar una solicitud de salida
    Given soy un apoderado autenticado
    And visualizo una solicitud vigente en "Solicitudes pendientes"
    When selecciono "<decision>"
    Then el sistema muestra "<resultado>"

    Examples:
      | decision | resultado                            |
      | Aprobar  | Solicitud aprobada por el apoderado  |
      | Rechazar | Solicitud rechazada por el apoderado |

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

#### PF-TRA-002 — Limitar la trazabilidad según rol y vinculación

- Requerimiento relacionado: RF14
- Objetivo específico relacionado: OE2, OE3, OE4
- Rol principal: Todos los roles
- Tipo de prueba: Restricción de permisos
- Prioridad: Alta
- Estado de implementación observado: Implementado

```gherkin
Scenario Outline: PF-TRA-002 Limitar la trazabilidad según rol y vinculación
    Given estoy autenticado con rol "<rol>"
    When consulto los eventos recientes
    Then visualizo "<alcance>"
    And no visualizo eventos fuera de ese alcance

    Examples:
      | rol        | alcance                                      |
      | ADMIN      | eventos de mi institución                    |
      | PORTERIA   | eventos de mi institución                    |
      | APODERADO  | eventos de mis estudiantes vinculados        |
      | ESTUDIANTE | mis propios eventos                          |

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

Las validaciones y errores se prueban junto al flujo al que pertenecen para evitar duplicación. Los escenarios principales son PF-AUTH-003, PF-AUTH-005, PF-ADM-002, PF-VIN-002, PF-ACC-002, PF-ACC-003, PF-QR-003, PF-ING-003, PF-SAL-002, PF-SAL-003, PF-RET-002, PF-RET-005, PF-REG-002, PF-SAU-003, PF-SOL-003 y PF-ADM-006.

## 7. Matriz de trazabilidad

| ID escenario | Nombre del escenario | Requerimiento funcional | Objetivo específico | Rol | Tipo de prueba | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| PF-AUTH-001 | Registrar una cuenta con datos válidos | RF01 | OE2, OE4 | Usuario | Flujo exitoso | Pendiente de automatización |
| PF-AUTH-002 | Iniciar sesión y acceder al panel correspondiente al rol | RF01 | OE2, OE4 | Todos los roles | Flujo exitoso | Pendiente de automatización |
| PF-AUTH-003 | Rechazar credenciales incorrectas | RF01 | OE2, OE4 | Usuario | Validación | Pendiente de automatización |
| PF-AUTH-004 | Cerrar la sesión activa | RF01 | OE2, OE4 | Usuario | Flujo exitoso | Pendiente de automatización |
| PF-AUTH-005 | Validar la actualización de datos del perfil | RF01 | OE2, OE4 | Usuario | Validación | Pendiente de automatización |
| PF-ADM-001 | Consultar y actualizar la configuración de un estudiante | RF02 | OE1, OE2, OE4 | Administrador | Flujo exitoso | Pendiente de automatización |
| PF-ADM-002 | Rechazar datos inválidos al actualizar un estudiante | RF02 | OE2, OE4 | Administrador | Validación | Pendiente de automatización |
| PF-ADM-003 | Gestionar el ciclo de vida administrativo de un estudiante | RF02 | OE1, OE2, OE4 | Administrador | Flujo alternativo | Pendiente de automatización |
| PF-VIN-001 | Vincular un estudiante mediante un código válido | RF03 | OE2, OE4 | Apoderado | Flujo exitoso | Pendiente de automatización |
| PF-VIN-002 | Informar códigos inválidos o vínculos duplicados | RF03 | OE2, OE4 | Apoderado | Validación | Pendiente de automatización |
| PF-VIN-003 | Desvincular un estudiante | RF03 | OE2, OE4 | Apoderado | Flujo alternativo | Pendiente de automatización |
| PF-AUT-001 | Configurar el permiso de salida autónoma | RF04 | OE1, OE2, OE4 | Administrador | Flujo exitoso | Pendiente de automatización |
| PF-AUT-002 | Registrar y consultar una persona autorizada para retiro | RF04 | OE1, OE2, OE4 | Administrador | Flujo exitoso | Pendiente de automatización |
| PF-AUT-003 | Revocar el permiso de una persona autorizada | RF04 | OE2, OE3, OE4 | Administrador | Restricción de permisos | Pendiente de automatización |
| PF-ACC-001 | Mostrar navegación y dashboard según el rol | RF05 | OE2, OE4 | Todos los roles | Flujo exitoso | Pendiente de automatización |
| PF-ACC-002 | Restringir una pantalla no autorizada | RF05 | OE2, OE4 | Todos los roles | Restricción de permisos | Pendiente de automatización |
| PF-ACC-003 | Impedir la consulta de un estudiante ajeno | RF05 | OE2, OE4 | Apoderado | Restricción de permisos | Pendiente de automatización |
| PF-QR-001 | Generar una credencial QR temporal | RF06 | OE3, OE4 | Estudiante | Flujo exitoso | Pendiente de automatización |
| PF-QR-002 | Validar una credencial QR vigente en portería | RF06 | OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-QR-003 | Rechazar una credencial QR no utilizable | RF06 | OE3, OE4 | Portería | Validación | Pendiente de automatización |
| PF-QR-004 | Aplicar validación manual controlada | RF06 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-QR-005 | Utilizar PIN diferentes y de un solo uso en un retiro | RF06 | OE3, OE4 | Portería | Validación | Pendiente de automatización |
| PF-ING-001 | Registrar manualmente el ingreso de un estudiante | RF07 | OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-ING-002 | Registrar el ingreso de varios estudiantes de un curso | RF07 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-ING-003 | Rechazar un ingreso duplicado | RF07 | OE3, OE4 | Portería | Validación | Pendiente de automatización |
| PF-ING-004 | Confirmar un ingreso mediante QR | RF07 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-SAL-001 | Registrar una salida regular manual | RF08 | OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-SAL-002 | Rechazar una salida sin ingreso activo | RF08 | OE3, OE4 | Portería | Validación | Pendiente de automatización |
| PF-SAL-003 | Exigir autenticador según la política de salida | RF08 | OE3, OE4 | Portería | Validación | Pendiente de automatización |
| PF-SAL-004 | Confirmar una salida regular mediante QR | RF08 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-RET-001 | Notificar el retiro de un estudiante | RF09 | OE3, OE4 | Apoderado | Flujo exitoso | Pendiente de automatización |
| PF-RET-002 | Rechazar la creación de un retiro no permitido | RF09 | OE3, OE4 | Apoderado | Validación | Pendiente de automatización |
| PF-RET-003 | Responder una solicitud de retiro como estudiante | RF09 | OE3, OE4 | Estudiante | Flujo alternativo | Pendiente de automatización |
| PF-RET-004 | Validar los PIN en cualquier orden | RF09 | OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-RET-005 | Rechazar PIN inválidos, vencidos o bloqueados | RF09 | OE3, OE4 | Portería | Validación | Pendiente de automatización |
| PF-RET-006 | Confirmar el retiro después de validar a ambas personas | RF09 | OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-RET-007 | Cancelar una solicitud de retiro activa | RF09 | OE3, OE4 | Apoderado | Flujo alternativo | Pendiente de automatización |
| PF-RET-008 | Rechazar excepcionalmente el retiro en portería | RF09 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-REG-001 | Aplicar una política institucional a un evento compatible | RF10 | OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-REG-002 | Rechazar un evento contrario a una política excluyente | RF10 | OE3, OE4 | Portería | Validación | Pendiente de automatización |
| PF-REG-003 | Registrar una contingencia sin dispositivo | RF10 | OE3, OE4 | Portería | Flujo alternativo | Pendiente de automatización |
| PF-SAU-001 | Registrar una salida autónoma | RF11 | OE3, OE4 | Estudiante | Flujo exitoso | Pendiente de automatización |
| PF-SAU-002 | Solicitar autorización cuando no puedo salir solo | RF11 | OE3, OE4 | Estudiante | Flujo alternativo | Pendiente de automatización |
| PF-SAU-003 | Impedir una salida autónoma sin precondiciones | RF11 | OE3, OE4 | Estudiante | Validación | Pendiente de automatización |
| PF-SOL-001 | Crear una solicitud de autorización de salida | RF12 | OE3, OE4 | Estudiante | Flujo exitoso | Pendiente de automatización |
| PF-SOL-002 | Aprobar o rechazar una solicitud de salida | RF12 | OE3, OE4 | Apoderado | Flujo alternativo | Pendiente de automatización |
| PF-SOL-003 | Rechazar una solicitud no válida | RF12 | OE3, OE4 | Estudiante | Validación | Pendiente de automatización |
| PF-SOL-004 | Consultar solicitudes pendientes según el rol | RF12 | OE3, OE4 | Todos los roles | Flujo alternativo | Pendiente de automatización |
| PF-ADM-004 | Configurar la política de ingreso y salida | RF13 | OE3, OE4 | Administrador | Flujo exitoso | Pendiente de automatización |
| PF-ADM-005 | Configurar el retiro con PIN dual | RF13 | OE3, OE4 | Administrador | Flujo exitoso | Pendiente de automatización |
| PF-ADM-006 | Rechazar configuraciones institucionales no permitidas | RF13 | OE2, OE3, OE4 | Administrador | Validación | Pendiente de automatización |
| PF-TRA-001 | Consultar eventos recientes de la institución | RF14 | OE1, OE3, OE4 | Portería | Flujo exitoso | Pendiente de automatización |
| PF-TRA-002 | Limitar la trazabilidad según rol y vinculación | RF14 | OE2, OE3, OE4 | Todos los roles | Restricción de permisos | Pendiente de automatización |
| PF-TRA-003 | Consultar el registro funcional completo de una operación | RF14 | OE1, OE3, OE4 | Usuario autorizado | Flujo exitoso | Pendiente de automatización |
| PF-TRA-004 | Informar que todavía no existen eventos | RF14 | OE3, OE4 | Usuario autorizado | Flujo alternativo | Pendiente de automatización |

## 8. Observaciones y funcionalidades pendientes

1. **RF01:** no se observó recuperación de contraseña. El registro no permite escoger rol y algunos errores provienen directamente del proveedor de autenticación.
2. **RF02:** existe consulta y actualización parcial del estudiante, pero no una interfaz administrativa completa para crear, asignar curso y desactivar. PF-ADM-003 queda pendiente de implementación.
3. **RF03:** la vinculación acepta códigos inválidos y duplicados, pero no se observó vencimiento de códigos de vinculación.
4. **RF04:** el modelo contempla personas autorizadas y existe permiso de salida autónoma, pero no hay interfaz completa para registrar, editar o revocar terceros autorizados. PF-AUT-002 y PF-AUT-003 quedan pendientes.
5. **RF05:** el código define cinco roles, mientras la métrica de OE2 declara acceso diferenciado para cuatro roles. Debe aclararse si Docente forma parte de esa métrica.
6. **RF06:** el QR es temporal y de un solo uso, pero la interfaz actual valida un payload pegado o escaneado externamente; no se observó lector de cámara ni revocación explícita por el usuario.
7. **RF08 y RF10:** se aplican estado, permiso, autenticador, observación y contingencia; no se observó una validación completa de horarios institucionales para la salida regular.
8. **RF09:** el repositorio local contiene el retiro con PIN dual, cancelación, contingencia y rechazo en portería. Al ser una modificación local reciente, requiere migración aplicada y prueba end-to-end antes de declararse operativo.
9. **RF12:** existen solicitudes de salida con aprobación o rechazo y solicitudes de retiro cancelables; no se observó cancelación del flujo de autorización iniciado por el estudiante.
10. **RF13:** se configuran reglas de autenticador y parámetros del PIN dual, pero no horarios, gestión general de roles ni todos los criterios descritos por RF13.
11. **RF14:** se muestran eventos recientes y alcance por rol, pero no existe una vista de historial integral con filtros y responsable visible en cada registro. PF-TRA-003 queda pendiente.
12. No existe aún configuración ni suite ejecutable de Playwright. Todos los escenarios permanecen “Pendiente de automatización”.
13. **Control de interfaz:** el detalle muestra “Configuración del estudiante” a usuarios vinculados que no son administradores, aunque la actualización queda limitada por las políticas de datos. La visibilidad de esa acción debería alinearse con el permiso declarado para evitar un rechazo tardío y genérico.
14. **Control de rutas:** la navegación oculta “Vincular estudiante” a roles sin permiso, pero la ruta de vinculación no realiza por sí sola la misma comprobación de rol. Debe reforzarse antes de aprobar completamente RF05.
15. **Acceso del estudiante:** la consulta del detalle usa la vinculación de apoderado para usuarios que no son personal institucional; conviene verificar y corregir el acceso del estudiante a su propia ficha.

### Resumen de cobertura

- Cantidad total de escenarios: **55**.
- Requerimientos sin cobertura: **ninguno**.
- Objetivos específicos sin cobertura: **ninguno**.

| Rol principal | Escenarios |
| --- | ---: |
| Administrador | 9 |
| Apoderado | 8 |
| Estudiante | 7 |
| Portería | 20 |
| Todos los roles | 5 |
| Usuario | 4 |
| Usuario autorizado | 2 |
| Docente (escenario exclusivo) | 0 |

Los `Scenario Outline` clasificados como “Todos los roles” incluyen al Docente cuando aparece en sus ejemplos; el cero anterior indica que no existe un escenario cuyo rol principal sea exclusivamente Docente.

| Requerimiento | Escenarios |
| --- | ---: |
| RF01 | 5 |
| RF02 | 3 |
| RF03 | 3 |
| RF04 | 3 |
| RF05 | 3 |
| RF06 | 5 |
| RF07 | 4 |
| RF08 | 4 |
| RF09 | 8 |
| RF10 | 3 |
| RF11 | 3 |
| RF12 | 4 |
| RF13 | 3 |
| RF14 | 4 |

### Escenarios recomendados para automatizar primero con Playwright

1. PF-AUTH-002 y PF-AUTH-003: acceso válido e inválido.
2. PF-ACC-002 y PF-ACC-003: restricciones de pantalla y datos.
3. PF-VIN-001 y PF-VIN-002: vinculación válida, inválida y duplicada.
4. PF-ING-001, PF-ING-003, PF-SAL-003 y PF-SAL-004: cambios de estado y políticas críticas.
5. PF-RET-001, PF-RET-003, PF-RET-004, PF-RET-005 y PF-RET-006: retiro con PIN dual completo.
6. PF-SAU-001 y PF-SAU-003: salida autónoma y sus restricciones.
7. PF-TRA-001 y PF-TRA-002: evidencia visible y aislamiento por rol.
