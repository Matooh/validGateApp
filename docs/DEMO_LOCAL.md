# Preparación local de la demo de VALIDGATE

## Arquitectura de validación

La defensa académica no requiere un deployment activo en Vercel. La aplicación
Next.js se ejecuta como build de producción en el PC del expositor y consume
Supabase Cloud mediante HTTPS.

```text
Chrome / Edge / Firefox
        |
        | http://localhost:3000
        v
Node.js + Next.js (PC de demostración)
        |
        | HTTPS / Internet
        v
Supabase Cloud: Auth + Data API/RPC + PostgreSQL/RLS
```

Este entorno es local, pero no offline. Vercel se conserva como alternativa para
una evolución productiva futura.

## Requisitos previos

- Windows con Git Bash.
- Node.js y npm instalados.
- Dependencias instaladas previamente con `npm install`.
- Chromium de Playwright instalado.
- `.env.local` con la URL y clave pública de Supabase.
- `.env.e2e.local` con `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD` de una cuenta ficticia estable.
- Redirect URL de localhost autorizada en Supabase Auth cuando se usen invitaciones.

No se instala ni actualiza software durante el preflight.

## Ejecución recomendada

Desde Git Bash:

```bash
npm run demo
```

El flujo ejecuta:

1. validación de Node, npm y dependencias;
2. validación de nombres de variables, sin imprimir sus valores;
3. health check de Supabase Auth y una consulta PostgREST con `limit=0`;
4. `npm run build`;
5. `npm start`;
6. espera de disponibilidad de la aplicación;
7. un smoke Playwright de disponibilidad, protección de ruta y login;
8. permanencia del servidor hasta presionar `Ctrl+C`.

El smoke no usa Service Role, no ejecuta el `globalSetup` de la suite completa y
no crea, elimina ni restablece datos de prueba.

## Opciones

```bash
npm run demo:check
bash scripts/validgate-demo.sh --dev
bash scripts/validgate-demo.sh --port 3100
```

- `--check-only`: valida entorno, configuración y Supabase.
- `--dev`: contingencia con el servidor de desarrollo.
- `--port`: evita un conflicto con el puerto 3000.

La ejecución sin parámetros es la única que certifica el flujo recomendado de
build de producción para la defensa.

## Logs y terminación

Los logs se guardan localmente en `.demo-logs/`, carpeta ignorada por Git. El
script no usa `set -x` y nunca imprime valores de variables sensibles.

Al presionar `Ctrl+C`, el script termina el árbol de procesos iniciado y libera
el puerto. En Git Bash para Windows utiliza `taskkill.exe` como respaldo cuando
una señal POSIX no termina los procesos hijos de Node.

## Plan de contingencia

### Plan A

`npm run build` + `npm start` + Supabase Cloud mediante `npm run demo`.

### Plan B

`bash scripts/validgate-demo.sh --dev` + Supabase Cloud.

### Plan C

Preparar antes de la defensa:

- capturas de los flujos principales;
- reporte Playwright de una ejecución integral aprobada;
- video corto de login, dashboard, ingreso, salida y retiro;
- copia local de la presentación y del documento de tesis.

Un deployment temporal puede conservarse como contingencia, pero no constituye
un requisito de validación del MVP.

## Supabase

El repositorio no contiene un endpoint de inicialización o reactivación. El
preflight comprueba disponibilidad, pero no intenta reactivar proyectos, acceder
al dashboard, ejecutar migraciones ni utilizar claves administrativas.

Si Supabase aparece pausado o inaccesible, la acción administrativa debe
realizarse manualmente desde su panel antes de volver a ejecutar el preflight.

## Matriz de validación del script

| Escenario | Comportamiento esperado | Validación 2026-08-22 |
|---|---|---|
| Node ausente | Error previo a cualquier operación | Ruta de error implementada; no se desinstaló Node |
| npm ausente | Error previo a cualquier operación | Ruta de error implementada |
| `.env.local` ausente | Error con nombre del archivo | Implementado en helper |
| Variable obligatoria ausente | Lista solo nombres, nunca valores | Implementado en helper |
| Internet no disponible | Timeout y error de conectividad | Timeout de 10 segundos implementado |
| Supabase no disponible | Detención antes del build | Health check Auth/PostgREST implementado |
| Build fallido | Detención con exit code no cero | Cubierto por `set -Eeuo pipefail` |
| Puerto ocupado | Detención antes de iniciar Next.js | Observado y validado |
| Next.js no inicia | Muestra últimas líneas del log | Implementado y observado con `EADDRINUSE` |
| Playwright falla | Detiene flujo y limpia servidor | Observado y validado |
| Usuario presiona `Ctrl+C` | Ejecuta `trap` | Validado |
| Servidor queda detenido | Puerto nuevamente disponible | Validado |
| Flujo completo correcto | Build, login y mensaje “LISTO PARA DEMO” | Validado: 1 smoke aprobado |

Los casos que exigirían desinstalar herramientas o desconectar la red se validan
por inspección controlada para no alterar innecesariamente el equipo de defensa.
