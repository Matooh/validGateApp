# Guía para ejecutar el plan E2E de VALIDGATE

Esta guía explica cómo preparar el ambiente, ejecutar las 47 pruebas funcionales y diagnosticar sus evidencias. La cobertura y las reglas de identificación se resumen en [README.md](README.md).

> Ejecuta la suite únicamente contra un proyecto Supabase de testing. La preparación crea usuarios y modifica registros marcados con el namespace E2E.

## 1. Requisitos

- Node.js y npm.
- Chromium para Playwright.
- Proyecto Supabase exclusivo para pruebas.
- Clave secreta o `service_role`.
- Migraciones `001` a `027` aplicadas.
- Credenciales ficticias para `ADMIN`, `PORTERIA`, `DOCENTE`, `APODERADO` y `ESTUDIANTE`.

```powershell
npm install
npx playwright install chromium
```

## 2. Configurar `.env.e2e.local`

Copia `.env.e2e.example` y completa como mínimo:

```env
PLAYWRIGHT_BASE_URL=http://localhost:3000
E2E_START_LOCAL_SERVER=true

E2E_SUPABASE_URL=https://PROJECT_REF.supabase.co
E2E_SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
E2E_ALLOW_REMOTE_MUTATIONS=true
E2E_NAMESPACE=validgate-e2e
E2E_EMAIL_MARKER=e2e

E2E_ADMIN_EMAIL=...
E2E_ADMIN_PASSWORD=...
E2E_PORTERIA_EMAIL=...
E2E_PORTERIA_PASSWORD=...
E2E_DOCENTE_EMAIL=...
E2E_DOCENTE_PASSWORD=...
E2E_APODERADO_EMAIL=...
E2E_APODERADO_PASSWORD=...
E2E_ESTUDIANTE_EMAIL=...
E2E_ESTUDIANTE_PASSWORD=...
```

Todos los correos deben contener `E2E_EMAIL_MARKER`. Si existe `.env.local`, su proyecto Supabase debe coincidir con `E2E_SUPABASE_URL`. Los secretos no deben compartirse ni versionarse.

## 3. Verificar y ejecutar

```powershell
# Enumerar sin ejecutar
npm run test:e2e:list

# Suite funcional completa
npm run test:e2e

# Navegador visible o interfaz de depuración
npm run test:e2e:headed
npm run test:e2e:ui

# Abrir el último reporte
npm run test:e2e:report
```

La suite usa Chromium, un trabajador y ejecución secuencial. `globalSetup` valida el ambiente y prepara datos aislados.

El smoke de disponibilidad, protección y login de administrador se ejecuta por separado:

```powershell
npm run test:demo
```

`DEMO-SMOKE-001` no pertenece al catálogo funcional `PF-*` ni al PDF de las 47 pruebas.

### Ejecuciones selectivas

```powershell
npx playwright test e2e/auth-access.spec.ts --project=chromium
npx playwright test e2e/authorized-retriever-pickup.spec.ts --project=chromium
npx playwright test e2e/traceability-visibility.spec.ts --project=chromium
npx playwright test --project=chromium --grep 'PF-APO-SEC-003'
npx playwright test --max-failures=1
```

## 4. Organización de los archivos E2E

| Archivo | Cobertura |
| --- | --- |
| `auth-access.spec.ts` | Login, restricciones y administración de vínculos. |
| `links-visibility.spec.ts` | Consulta de vínculos como Apoderado Primario y estudiante. |
| `guardian-relationships.spec.ts` | Vista consolidada y administración individual de vínculos. |
| `access-events.spec.ts` | Ingresos, salidas, contingencias y solicitudes. |
| `guardian-pickup.spec.ts` | Retiro del Apoderado Primario con PIN dual. |
| `authorized-retriever-pickup.spec.ts` | Apoderado Secundario, vigencia, revocación y PIN dual. |
| `traceability-visibility.spec.ts` | Aislamiento de eventos por familia, institución, autorización y docente. |

## 5. Evidencias generadas

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

La carpeta usa la hora local del inicio de la corrida. No mezcles resultados de ejecuciones diferentes.

Al revisar el PDF comprueba que:

1. cada prueba tenga un ID único y un resultado;
2. los códigos de vinculación requeridos por el caso sean visibles;
3. los flujos con PIN muestren ambos PIN, ambas aprobaciones en verde y el avance posterior;
4. cada ingreso, salida, rechazo, contingencia o retiro incluya la trazabilidad generada;
5. se capture completo el componente **Trazabilidad reciente**, incluidos encabezado, descripción y tarjetas;
6. las tarjetas muestren los datos disponibles del evento y no expongan registros fuera del alcance del rol;
7. contraseñas y payloads QR permanezcan protegidos.

## 6. Diagnosticar un fallo

1. Ubica el primer error en `playwright-results.xml` o `playwright-results.json`.
2. Confirma la última URL y acción completada en `test-results/<caso>/error-context.md`.
3. Revisa la captura, el video y la traza antes de clasificarlo como defecto funcional.
4. Repite solamente el ID afectado con un `E2E_REPORT_RUN_ID` diferente.
5. Conserva tanto la corrida original como la de diagnóstico.

Ejemplo:

```powershell
$env:E2E_REPORT_RUN_ID='diagnostico-pf-vin-001c'
npx playwright test e2e/links-visibility.spec.ts --project=chromium --grep 'PF-VIN-001C'
```

Si una prueba queda en el login con **Ingresando…** y vence esperando `/dashboard`, todavía no alcanzó las aserciones del escenario. Deben revisarse sesión, respuesta del servidor y traza; no debe clasificarse automáticamente como fallo de vínculos o privacidad. Si la repetición aislada pasa, documéntala como posible intermitencia sin alterar el reporte original.

## 7. Errores frecuentes

- Variables incompletas: revisa `.env.e2e.local`.
- Mutaciones deshabilitadas: activa `E2E_ALLOW_REMOTE_MUTATIONS=true` solo tras confirmar el proyecto de testing.
- Clave incorrecta: no utilices la clave pública como `service_role`.
- Correo sin marcador: usa cuentas ficticias que contengan `E2E_EMAIL_MARKER`.
- Aplicación y preparador en proyectos distintos: alinea `.env.local` y `.env.e2e.local`.
- Aplicación inaccesible: revisa `PLAYWRIGHT_BASE_URL`, puerto y `E2E_START_LOCAL_SERVER`.
- Migraciones incompletas: aplica hasta `027_fix_confirm_guardian_pickup_request_id.sql`.
- Visor en una corrida incorrecta: abre directamente `reports/<run-id>/playwright-html`.
