# Guía para ejecutar el plan de pruebas de VALIDGATE

Esta guía explica cómo ejecutar la suite funcional end-to-end (E2E) de VALIDGATE y revisar las evidencias generadas en esta carpeta. Los casos automatizados se encuentran en `e2e/`, usan Playwright y se relacionan con la estrategia de pruebas documentada en la tesis vigente.

> **Importante:** ejecuta las pruebas únicamente contra un proyecto Supabase de testing. La preparación de datos crea usuarios y modifica registros identificados con el namespace E2E.

## 1. Requisitos previos

- Node.js y npm instalados.
- Acceso a un proyecto Supabase exclusivo para pruebas.
- Una clave administrativa `sb_secret_...` o una clave JWT legacy con rol `service_role`.
- Credenciales ficticias para los roles `ADMIN`, `PORTERIA`, `DOCENTE`, `APODERADO` y `ESTUDIANTE`.
- Migraciones aplicadas hasta `027_fix_confirm_guardian_pickup_request_id.sql` para completar retiros con PIN dual.
- Chromium para Playwright.

Desde la raíz del repositorio, instala las dependencias y el navegador si aún no están disponibles:

```powershell
npm install
npx playwright install chromium
```

## 2. Configurar el ambiente E2E

Crea el archivo local de configuración a partir de la plantilla:

```powershell
Copy-Item .env.e2e.example .env.e2e.local
```

Completa `.env.e2e.local` con los datos del ambiente de testing. Como mínimo, debes definir:

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

Todos los correos deben contener el texto configurado en `E2E_EMAIL_MARKER`. El archivo `.env.e2e.local` contiene secretos, está ignorado por Git y no debe compartirse ni versionarse.

### Aplicación local

Usa esta configuración para que Playwright inicie VALIDGATE automáticamente:

```env
PLAYWRIGHT_BASE_URL=http://localhost:3000
E2E_START_LOCAL_SERVER=true
```

Si existe `.env.local`, su `NEXT_PUBLIC_SUPABASE_URL` debe apuntar al mismo proyecto que `E2E_SUPABASE_URL`; la ejecución se detendrá si son distintos.

### Despliegue de testing

Para probar un despliegue que ya está en ejecución:

```env
PLAYWRIGHT_BASE_URL=https://tu-entorno-testing.example
E2E_START_LOCAL_SERVER=false
```

## 3. Verificar y ejecutar el plan

Primero confirma qué casos reconoce Playwright, sin ejecutarlos:

```powershell
npm run test:e2e:list
```

Luego ejecuta el plan automatizado completo:

```powershell
npm run test:e2e
```

Para la preparación de la defensa existe además un smoke acotado que no ejecuta
el preparador con Service Role ni restablece datos:

```powershell
npm run test:demo
```

Este comando presupone que la aplicación ya está iniciada. El flujo recomendado
es `npm run demo`, ejecutado desde Git Bash.

El smoke usa `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD`. Estas credenciales son
independientes de las cuentas `E2E_*` que el preparador de la suite completa
puede crear o restablecer.

La suite se ejecuta en Chromium, con un trabajador y sin paralelismo. Antes de comenzar, el `globalSetup` valida la configuración y prepara datos aislados mediante `E2E_NAMESPACE`.

Actualmente Playwright descubre 46 pruebas: 45 funcionales asociadas a 28 IDs y un smoke de demo. Los siete casos PF-RET-AUT generan evidencias visuales ordenadas de los estados iniciales, acciones, mensajes, validaciones y resultados finales.

### Modos alternativos

```powershell
# Ver el navegador mientras se ejecuta la suite
npm run test:e2e:headed

# Seleccionar y depurar casos desde la interfaz de Playwright
npm run test:e2e:ui

# Ejecutar solamente un archivo
npx playwright test e2e/auth-access.spec.ts

# Ejecutar los siete casos de retirador temporal
npx playwright test e2e/authorized-retriever-pickup.spec.ts --project=chromium

# Ejecutar un caso por su ID o parte del título
npx playwright test --grep "PF-RET-AUT-006"

# Detenerse después del primer fallo
npx playwright test --max-failures=1
```

Los archivos principales agrupan estos flujos:

| Archivo | Cobertura |
|---|---|
| `auth-access.spec.ts` | Autenticación, roles, permisos y vinculación |
| `access-events.spec.ts` | Ingreso, salida regular y salida autónoma |
| `guardian-pickup.spec.ts` | Retiro con validación de PIN dual |
| `authorized-retriever-pickup.spec.ts` | Registro, autorización temporal, revocación y retiro mediante retirador autorizado |
| `links-visibility.spec.ts` | Visibilidad de vínculos por rol |

## 4. Revisar los resultados

Cada corrida crea una carpeta independiente con la hora local de inicio:

```text
reports/
└── YYYYMMDD-HHMM/
    ├── playwright-html/               # Reporte interactivo de Playwright
    ├── playwright-results.json        # Resultado estructurado
    ├── playwright-results.xml         # Resultado JUnit
    ├── VALIDGATE_resultados_e2e.html   # Resumen ejecutivo imprimible
    ├── VALIDGATE_resultados_e2e.pdf    # Evidencia para anexar a la tesis
    └── test-results/                   # Capturas, videos y trazas de fallos
```

Abre el reporte interactivo de la ejecución más reciente con:

```powershell
npm run test:e2e:report
```

El comando selecciona la carpeta `YYYYMMDD-HHMM` más reciente y levanta el visor local de Playwright. Para inspeccionar una corrida específica:

```powershell
npx playwright show-report reports/20260815-2136/playwright-html
```

Reemplaza `20260815-2136` por el identificador deseado. Para abrir una traza de una prueba fallida:

```powershell
npx playwright show-trace "reports/AAAAmmdd-HHMM/test-results/<caso>/trace.zip"
```

## 5. Criterio de revisión

Al finalizar una ejecución:

1. Confirma que el comando termine con código de salida `0`.
2. Revisa en el reporte HTML los casos aprobados, fallidos, omitidos o reintentados.
3. Para cada fallo, examina el mensaje, la captura, el video y la traza en `test-results/`.
4. Comprueba que el PDF incluya la matriz de trazabilidad, el ambiente y el build esperados.
5. Conserva la carpeta completa de la corrida que se usará como evidencia; no mezcles archivos de ejecuciones diferentes.

Un fallo puede deberse al producto, a datos E2E inconsistentes, a credenciales incorrectas o a que la aplicación y el preparador apuntan a proyectos Supabase distintos. Corrige la causa antes de repetir la corrida y conserva ambas ejecuciones si necesitas demostrar el ciclo hallazgo–corrección–revalidación.

## 6. Errores frecuentes

- **Faltan variables E2E:** completa todas las variables obligatorias en `.env.e2e.local`.
- **`E2E_ALLOW_REMOTE_MUTATIONS` no es `true`:** habilítalo solo después de verificar que `E2E_SUPABASE_URL` corresponde al proyecto de testing.
- **Clave administrativa inválida:** no uses una clave pública `sb_publishable_...`; configura una clave secreta o `service_role`.
- **El correo no contiene el marcador:** usa cuentas ficticias cuyo correo incluya `E2E_EMAIL_MARKER`.
- **La aplicación no responde:** revisa `PLAYWRIGHT_BASE_URL`; si es local, confirma que el puerto esté libre o inicia la aplicación manualmente y usa `E2E_START_LOCAL_SERVER=false`.
- **El visor abre una corrida inesperada:** indica directamente la ruta de la corrida con `npx playwright show-report`.

La suite completa debe continuar ejecutándose únicamente sobre un proyecto de testing. El smoke de demo no sustituye la evidencia funcional integral.
