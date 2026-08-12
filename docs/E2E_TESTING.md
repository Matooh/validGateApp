# Automatización E2E de VALIDGATE

La suite inicial automatiza 15 escenarios funcionales identificados por los mismos IDs del plan Gherkin. Cada ejecución genera reporte HTML, JSON, JUnit, un resumen HTML imprimible y un PDF.

## 1. Configurar variables locales

1. Copia `.env.e2e.example` como `.env.e2e.local`.
2. Completa la URL y la `service_role` del proyecto Supabase de **testing**.
3. Define correos y passwords ficticios para los cinco roles.
4. Verifica que todos los correos contengan el valor de `E2E_EMAIL_MARKER` (por defecto, `e2e`).
5. Cuando hayas revisado el proyecto de destino, cambia `E2E_ALLOW_REMOTE_MUTATIONS=true`.

`.env.e2e.local` está ignorado por Git. La `service_role` nunca debe usarse en código del navegador, compartirse por chat ni subirse al repositorio.

## 2. Protección de los datos compartidos

La preparación no reutiliza los IDs `1`, `2` o `3` de los seeds históricos. Crea o reutiliza únicamente:

- una institución llamada `VALIDGATE E2E <namespace>`;
- un curso `Curso E2E <namespace>`;
- dos estudiantes cuyos códigos comienzan con `E2E-`;
- usuarios Auth marcados con `validgate_e2e=true` y el namespace configurado.

Si un correo ya existe y no está marcado como E2E, el proceso no cambia su password ni su perfil. Solo se acepta si ya pertenece a la institución E2E y tiene el rol esperado; ante cualquier diferencia, la ejecución se detiene.

Antes de cada prueba se eliminan solicitudes, PIN, notificaciones, QR y eventos pertenecientes exclusivamente a los dos estudiantes E2E. No se ejecutan eliminaciones por institución general, correo parcial ni IDs de los seeds existentes.

## 3. Ejecutar

Si VALIDGATE debe iniciarse localmente:

```env
PLAYWRIGHT_BASE_URL=http://localhost:3000
E2E_START_LOCAL_SERVER=true
```

Para usar un despliegue de testing existente:

```env
PLAYWRIGHT_BASE_URL=https://tu-entorno-testing.example
E2E_START_LOCAL_SERVER=false
```

Comandos:

```powershell
npm run test:e2e:list
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:report
```

## 4. Evidencias generadas

```text
reports/
└── YYYYMMDD-HHMM/                    # Una carpeta independiente por ejecución
    ├── playwright-html/              # Reporte interactivo
    ├── playwright-results.json       # Resultado estructurado
    ├── playwright-results.xml        # Formato JUnit
    ├── VALIDGATE_resultados_e2e.html  # Resumen ejecutivo
    ├── VALIDGATE_resultados_e2e.pdf   # Anexo para la tesis
    └── test-results/                 # Capturas, videos y trazas
```

La marca temporal usa la hora local del equipo al iniciar Playwright. Por ejemplo, una ejecución iniciada el 11 de agosto de 2026 a las 20:31 se conserva en `reports/20260811-2031/`.

El PDF incluye fecha, ambiente, build, navegador, totales, una matriz ID–RF–OE–rol–resultado y un anexo con evidencias rotuladas de las etapas relevantes de cada caso. Los flujos de varios actores pueden incluir múltiples capturas —estado inicial, acción, recepción, validación y estado final— dentro de una misma prueba. Los campos de entrada aparecen enmascarados para no divulgar passwords, códigos, PIN ni payloads QR.

El HTML de Playwright conserva las mismas capturas como adjuntos de cada caso. Cuando una prueba falla, además conserva la captura nativa del fallo, el video y la traza interactiva.

## 5. Cobertura inicial

- PF-AUTH-002, PF-AUTH-003.
- PF-ACC-002, PF-ACC-003.
- PF-VIN-001, PF-VIN-002.
- PF-ING-001, PF-ING-003.
- PF-SAL-003, PF-SAL-004.
- PF-RET-001, PF-RET-003, PF-RET-004, PF-RET-006.
- PF-SAU-001.

Los `Scenario Outline` producen más de un caso ejecutado cuando contienen varios roles o condiciones, pero conservan el mismo ID funcional.
