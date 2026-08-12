Feature: Plan de pruebas funcionales de VALIDGATE

  Background:
    Given VALIDGATE está disponible en un entorno controlado con datos de prueba
    And cada usuario de prueba posee el rol y las vinculaciones indicadas en el escenario

  Scenario: PF-AUTH-001 Registrar una cuenta con datos válidos
    Given soy una persona sin una sesión iniciada y accedo a la pantalla de registro
    When completo el email y la password con valores válidos
    And selecciono "Crear cuenta"
    Then el sistema muestra "Registro exitoso"
    And puedo volver al login

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

  Scenario: PF-AUTH-003 Rechazar credenciales incorrectas
    Given me encuentro en el login
    When ingreso un email o una password incorrectos
    Then permanezco en el login
    And el sistema muestra un mensaje comprensible sin revelar qué credencial falló

  Scenario: PF-AUTH-004 Cerrar la sesión activa
    Given soy un usuario autenticado
    When selecciono "Cerrar sesión"
    Then el sistema muestra una confirmación de cierre de sesión
    And vuelvo al login
    And no puedo acceder al dashboard sin autenticarme nuevamente

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

  Scenario: PF-ADM-001 Consultar y actualizar la configuración de un estudiante
    Given soy un administrador autenticado
    And accedo al detalle de un estudiante de mi institución
    When actualizo su RUT, teléfono o permiso de salida autónoma con valores válidos
    And selecciono "Guardar configuración"
    Then el sistema muestra una confirmación visible
    And el detalle presenta la información actualizada

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

  Scenario: PF-ADM-003 Gestionar el ciclo de vida administrativo de un estudiante
    Given soy un administrador autenticado
    When registro un estudiante con institución, curso y datos de identificación válidos
    Then el estudiante aparece en la institución y en el curso seleccionado
    When desactivo al estudiante
    Then deja de estar disponible para nuevas operaciones de acceso
    But su historial permanece disponible para trazabilidad

  Scenario: PF-VIN-001 Vincular un estudiante mediante un código válido
    Given soy un apoderado autenticado y accedo a "Vincular estudiante"
    When ingreso un código de vinculación válido
    And selecciono "Vincular estudiante"
    Then el sistema muestra "Vinculación exitosa"
    And el estudiante aparece en "Estudiantes vinculados"

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

  Scenario: PF-VIN-003 Desvincular un estudiante
    Given soy un apoderado autenticado
    And visualizo un estudiante en "Estudiantes vinculados"
    When selecciono "Desvincular"
    Then el sistema muestra "Desvinculación exitosa"
    And el estudiante deja de aparecer entre mis estudiantes vinculados

  Scenario: PF-AUT-001 Configurar el permiso de salida autónoma
    Given soy un administrador autenticado en el detalle de un estudiante
    When activo o desactivo "Permitir salida por voluntad del estudiante"
    And selecciono "Guardar configuración"
    Then el sistema confirma la actualización
    And el detalle muestra si el estudiante "Puede salir solo" o "No puede salir solo"

  Scenario: PF-AUT-002 Registrar y consultar una persona autorizada para retiro
    Given soy un administrador o apoderado autenticado
    When registro una persona autorizada con su identidad y relación con el estudiante
    Then la persona aparece entre las autorizadas para el retiro
    And portería puede consultar la vigencia de su autorización

  Scenario: PF-AUT-003 Revocar el permiso de una persona autorizada
    Given soy un administrador o apoderado autenticado
    And existe una persona autorizada para retirar a un estudiante
    When revoco su autorización
    Then el sistema muestra la autorización como revocada
    And portería no puede utilizarla para confirmar un nuevo retiro

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

  Scenario: PF-ACC-003 Impedir la consulta de un estudiante ajeno
    Given soy un apoderado autenticado
    And el estudiante solicitado no está vinculado a mi cuenta
    When intento abrir directamente su detalle
    Then el sistema no muestra la información del estudiante
    And no permite modificar sus datos

  Scenario: PF-QR-001 Generar una credencial QR temporal
    Given soy un estudiante autenticado con un perfil asociado
    And no tengo una credencial QR vigente
    When accedo a "Autenticaciones"
    And selecciono "Generar QR"
    Then el sistema muestra "Credencial QR generada correctamente"
    And presenta la credencial con su hora de expiración

  Scenario: PF-QR-002 Validar una credencial QR vigente en portería
    Given soy personal de portería autenticado
    And el estudiante presenta una credencial QR vigente y no utilizada
    When ingreso o escaneo la credencial en "Validación QR"
    And selecciono "Validar QR"
    Then el sistema muestra "Credencial QR válida"
    And presenta el estudiante, curso, estado y autorizaciones aplicables

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

  Scenario: PF-QR-004 Aplicar validación manual controlada
    Given soy personal de portería autenticado
    And una persona no puede presentar su mecanismo digital
    When selecciono "Validación manual controlada"
    And indico un motivo y una observación
    Then el sistema informa que la identidad fue validada mediante contingencia manual
    And mantiene visible el método utilizado para la operación

  Scenario: PF-QR-005 Utilizar PIN diferentes y de un solo uso en un retiro
    Given existe una solicitud de retiro aceptada por el estudiante
    When el apoderado y el estudiante consultan su PIN
    Then cada persona visualiza únicamente su propio PIN de cinco dígitos
    And ambos PIN son diferentes y muestran su vigencia
    When portería utiliza ambos PIN para completar el retiro
    Then ninguno de los PIN puede volver a validarse

  Scenario: PF-ING-001 Registrar manualmente el ingreso de un estudiante
    Given soy personal de portería autenticado
    And el estudiante figura "Fuera de la institución"
    When lo selecciono para un evento de "Ingreso"
    And confirmo el registro con el método permitido
    Then el sistema informa que el ingreso fue aprobado
    And el estudiante queda "Dentro de la institución"

  Scenario: PF-ING-002 Registrar el ingreso de varios estudiantes de un curso
    Given soy personal de portería autenticado
    And consulto estudiantes por curso
    When selecciono varios estudiantes que están fuera
    And confirmo el evento de "Ingreso"
    Then el sistema muestra el total de ingresos aprobados y rechazados
    And actualiza visiblemente el estado de cada operación procesada

  Scenario: PF-ING-003 Rechazar un ingreso duplicado
    Given soy personal de portería autenticado
    And el estudiante ya figura "Dentro de la institución"
    When intento registrar otro evento de "Ingreso"
    Then el sistema informa que la operación fue rechazada
    And el estudiante conserva su estado actual
    And el rechazo aparece en "Eventos recientes"

  Scenario: PF-ING-004 Confirmar un ingreso mediante QR
    Given soy personal de portería autenticado
    And valido el QR vigente de un estudiante que está fuera
    When selecciono "Confirmar ingreso"
    Then el sistema muestra "Evento registrado correctamente mediante QR"
    And el estudiante queda dentro del establecimiento

  Scenario: PF-SAL-001 Registrar una salida regular manual
    Given soy personal de portería autenticado
    And el estudiante figura "Dentro de la institución"
    And la política permite el método manual utilizado
    When selecciono el estudiante y registro una "Salida"
    Then el sistema informa que la salida fue aprobada
    And el estudiante queda "Fuera de la institución"

  Scenario: PF-SAL-002 Rechazar una salida sin ingreso activo
    Given soy personal de portería autenticado
    And el estudiante figura "Fuera de la institución"
    When intento registrar una "Salida"
    Then el sistema rechaza la operación con un mensaje comprensible
    And el estudiante conserva su estado
    And el rechazo queda visible en los eventos recientes

  Scenario: PF-SAL-003 Exigir autenticador según la política de salida
    Given soy personal de portería autenticado
    And la política institucional exige QR o PIN de forma excluyente para la salida
    When intento registrar una salida manual sin presentar el autenticador
    Then el sistema rechaza la salida
    And muestra que falta el autenticador requerido

  Scenario: PF-SAL-004 Confirmar una salida regular mediante QR
    Given soy personal de portería autenticado
    And valido el QR de un estudiante que está dentro y cumple las reglas de salida
    When selecciono "Confirmar salida"
    Then el sistema confirma el evento mediante QR
    And el estudiante queda fuera del establecimiento

  Scenario: PF-RET-001 Notificar el retiro de un estudiante
    Given soy un apoderado autenticado
    And tengo un estudiante vinculado que está "Dentro de la institución"
    And no existe otra solicitud activa para él
    When selecciono "Notificar retiro"
    Then el sistema muestra "Solicitud de retiro enviada al estudiante"
    And la solicitud queda esperando la respuesta del estudiante

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

  Scenario Outline: PF-RET-003 Responder una solicitud de retiro como estudiante
    Given soy el estudiante destinatario de una solicitud de retiro pendiente
    When selecciono "<respuesta>"
    Then el sistema muestra "<resultado>"

    Examples:
      | respuesta | resultado                                                        |
      | Aceptar   | Solicitud aceptada. Los PIN estarán vigentes durante cinco minutos|
      | Rechazar  | Solicitud de retiro rechazada                                    |

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

  Scenario: PF-RET-006 Confirmar el retiro después de validar a ambas personas
    Given soy personal de portería autenticado
    And la solicitud muestra "Ambos validados"
    And el estudiante continúa dentro de la institución
    When selecciono "Confirmar retiro"
    Then el sistema muestra "Retiro confirmado y salida registrada"
    And la solicitud aparece como "Completado"
    And el estudiante queda fuera de la institución

  Scenario: PF-RET-007 Cancelar una solicitud de retiro activa
    Given soy el apoderado que creó una solicitud de retiro no completada
    When selecciono "Cancelar"
    Then el sistema muestra "Solicitud de retiro cancelada"
    And los PIN generados dejan de ser utilizables
    And portería no puede confirmar el retiro con esa solicitud

  Scenario: PF-RET-008 Rechazar excepcionalmente el retiro en portería
    Given soy personal de portería autenticado
    And existe una solicitud lista para validación o con ambas personas validadas
    When selecciono "Rechazar en portería"
    And completo el motivo y la observación obligatorios
    Then el sistema muestra "Solicitud rechazada en portería"
    And el estudiante conserva el estado "Dentro de la institución"
    And la solicitud queda disponible para trazabilidad

  Scenario: PF-REG-001 Aplicar una política institucional a un evento compatible
    Given soy personal de portería autenticado
    And la política vigente permite el método de validación presentado
    When registro un ingreso o salida compatible con el estado del estudiante
    Then el sistema aprueba la operación
    And muestra el método y resultado aplicados

  Scenario: PF-REG-002 Rechazar un evento contrario a una política excluyente
    Given soy personal de portería autenticado
    And la política vigente exige un autenticador de forma excluyente
    When intento registrar un evento sin ese autenticador
    Then el sistema rechaza la operación
    And mantiene el estado anterior del estudiante
    And muestra la regla que impidió la operación

  Scenario: PF-REG-003 Registrar una contingencia sin dispositivo
    Given soy personal de portería autenticado
    And la política admite contingencia para una operación sin dispositivo
    When selecciono "Contingencia sin dispositivo"
    And completo el motivo y la observación requeridos
    Then el sistema procesa la operación según la política vigente
    And muestra la contingencia y su resultado en la trazabilidad

  Scenario: PF-SAU-001 Registrar una salida autónoma
    Given soy un estudiante autenticado
    And estoy dentro de la institución
    And tengo permiso para salir solo y un QR vigente
    When selecciono "Registrar salida"
    Then el sistema muestra "Salida registrada correctamente"
    And mi estado cambia a "Fuera de la institución"

  Scenario: PF-SAU-002 Solicitar autorización cuando no puedo salir solo
    Given soy un estudiante autenticado dentro de la institución
    And no tengo permiso para registrar una salida directa
    When selecciono "Solicitar autorización de salida"
    Then el sistema muestra "Solicitud enviada al apoderado"
    And la acción cambia a "Solicitud en curso"

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

  Scenario: PF-SOL-001 Crear una solicitud de autorización de salida
    Given soy un estudiante autenticado dentro de la institución
    And tengo al menos un apoderado vinculado
    And no existe otra solicitud activa
    When solicito autorización de salida e indico el motivo
    Then la solicitud aparece pendiente de respuesta
    And el apoderado puede verla en "Solicitudes pendientes"

  Scenario Outline: PF-SOL-002 Aprobar o rechazar una solicitud de salida
    Given soy un apoderado autenticado
    And visualizo una solicitud vigente en "Solicitudes pendientes"
    When selecciono "<decision>"
    Then el sistema muestra "<resultado>"

    Examples:
      | decision | resultado                            |
      | Aprobar  | Solicitud aprobada por el apoderado  |
      | Rechazar | Solicitud rechazada por el apoderado |

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

  Scenario: PF-ADM-004 Configurar la política de ingreso y salida
    Given soy un administrador autenticado en "Config"
    When defino si ingreso y salida exigen QR o PIN
    And configuro si el autenticador es excluyente y si se exige observación
    And selecciono "Guardar política de acceso"
    Then el sistema muestra "Política de acceso actualizada"
    And portería aplica la nueva política en las operaciones posteriores

  Scenario: PF-ADM-005 Configurar el retiro con PIN dual
    Given soy un administrador autenticado en "Retiro con PIN dual"
    When ingreso una vigencia entre 1 y 60 minutos
    And un máximo de intentos entre 1 y 10
    And un mensaje no vacío para el estudiante
    And selecciono "Guardar configuración de retiro"
    Then el sistema muestra "Configuración de retiro actualizada"

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

  Scenario: PF-TRA-001 Consultar eventos recientes de la institución
    Given soy personal de portería autenticado
    When accedo a "Eventos recientes"
    Then visualizo los eventos de la institución ordenados desde el más reciente
    And cada evento muestra estudiante, operación, método, resultado y fecha y hora

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

  Scenario: PF-TRA-003 Consultar el registro funcional completo de una operación
    Given soy un usuario autorizado para consultar un evento
    When abro el registro de una operación de ingreso, salida o retiro
    Then visualizo el estudiante, tipo de operación, método y resultado
    And visualizo la fecha, hora y responsable de la operación
    And visualizo el estado, motivo u observación cuando corresponda

  Scenario: PF-TRA-004 Informar que todavía no existen eventos
    Given soy un usuario autenticado sin eventos visibles en mi alcance
    When accedo a la sección de trazabilidad
    Then el sistema muestra que aún no hay eventos registrados para mostrar
    And no presenta información perteneciente a otros usuarios o instituciones
