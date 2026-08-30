# Pruebas end-to-end de VALIDGATE

Este directorio contiene el plan funcional, la guía de ejecución y una carpeta independiente por cada corrida de Playwright. La fuente del catálogo es [plan_pruebas_funcionales_validgate.md](plan_pruebas_funcionales_validgate.md); las instrucciones operativas están en [GUIA_PARA_EJECUTAR_E2E_TESTING.md](GUIA_PARA_EJECUTAR_E2E_TESTING.md).

## Alcance vigente

La configuración funcional descubre **47 pruebas con 47 identificadores únicos**. `DEMO-SMOKE-001` se ejecuta mediante `playwright.demo.config.ts` y no forma parte del catálogo `PF-*` ni del PDF funcional.

Los casos se presentan conceptualmente en este orden:

1. inicio de sesión;
2. restricciones transversales de acceso;
3. vínculos;
4. ingresos, salidas y contingencias;
5. retiros con PIN dual;
6. Apoderados Secundarios;
7. aislamiento de trazabilidad.

Cuando un caso conceptual tiene variantes por rol o condición se agrega un sufijo alfabético. Por ejemplo, `PF-ACC-002A`, `PF-ACC-002B` y `PF-ACC-002C` son resultados independientes y no tres repeticiones de `PF-ACC-002`.

## Cobertura automatizada

| Área | Casos |
| --- | --- |
| Inicio de sesión | `PF-AUTH-002A`–`002E`, `PF-AUTH-003` |
| Restricciones | `PF-ACC-002A`–`002C`, `PF-ACC-003` |
| Vínculos | `PF-VIN-001A`–`001C`, `PF-VIN-002A`–`002B`, `PF-VIN-ADM-001`, `002A`–`002D`, `003`, `004` |
| Ingreso y salida | `PF-ING-001A`–`001B`, `PF-ING-003`, `PF-SAL-003A`–`003C`, `PF-SAL-004`, `PF-SOL-002A`–`002B` |
| Retiro primario | `PF-RET-001`, `003`–`006` |
| Apoderado Secundario | `PF-APO-SEC-001`–`005`, `007` |
| Protección de trazabilidad | `PF-TRA-002A`–`002E` |

Los saltos numéricos representan casos pendientes o retirados. No se reutilizan identificadores para conservar la trazabilidad histórica.

## Evidencia requerida

Cada flujo conserva capturas ordenadas del estado inicial, la acción, los mensajes, las validaciones y el resultado final. Además:

- los casos de PIN muestran ambos valores, las dos aprobaciones en verde y la continuación del flujo;
- los casos de vinculación muestran el código válido o inválido cuando corresponde;
- `PF-VIN-ADM-001` muestra los vínculos iniciales tanto para el estudiante con relaciones como para el que no tiene ninguna;
- todo ingreso, salida, rechazo, contingencia o retiro que genere un evento incluye la trazabilidad resultante;
- la evidencia de trazabilidad captura el componente completo **Trazabilidad reciente**, no solamente una tarjeta;
- cada tarjeta visible conserva estudiante, tipo, resultado, método, descripción y fecha/hora disponibles;
- contraseñas y payloads QR permanecen protegidos.

## Protección de datos validada

Los escenarios `PF-TRA-002A` a `PF-TRA-002E` comprueban:

- separación entre familias;
- aislamiento institucional de administrador y portería;
- alcance temporal e histórico propio del Apoderado Secundario;
- aislamiento de docentes entre instituciones;
- igualdad de alcance entre dos docentes de la misma institución, sin introducir docente–curso en el MVP.

Las aserciones verifican tanto la presencia de los eventos permitidos como la ausencia de datos protegidos.

## Salida de una ejecución

```text
reports/
└── YYYYMMDD-HHMM/
    ├── playwright-html/
    ├── playwright-results.json
    ├── playwright-results.xml
    ├── VALIDGATE_resultados_e2e.html
    ├── VALIDGATE_resultados_e2e.pdf
    └── test-results/
```

El PDF contiene el contexto de ejecución, los totales, la matriz ID–RF–OE–rol–resultado y el anexo de evidencias. El HTML de Playwright conserva los adjuntos y, ante un fallo, la captura, el video, la traza y el contexto disponibles.

## Seguridad de los datos E2E

La suite debe ejecutarse exclusivamente contra un proyecto Supabase de testing. El preparador utiliza un namespace, usuarios marcados como E2E y estudiantes con código `E2E-*`; no debe reutilizar ni modificar cuentas ajenas a ese alcance.
