#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PORT=3000
MODE="production"
CHECK_ONLY=false
SERVER_PID=""
LOG_FILE=""

if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; RESET='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; BLUE=''; RESET=''
fi

ok()    { printf '%b[OK]%b %s\n' "$GREEN" "$RESET" "$*"; }
warn()  { printf '%b[WARN]%b %s\n' "$YELLOW" "$RESET" "$*"; }
error() { printf '%b[ERROR]%b %s\n' "$RED" "$RESET" "$*" >&2; }
info()  { printf '%b[INFO]%b %s\n' "$BLUE" "$RESET" "$*"; }

usage() {
  cat <<'EOF'
Uso: bash scripts/validgate-demo.sh [opciones]

  --check-only   Valida entorno, configuración y Supabase sin iniciar la app.
  --dev          Usa npm run dev como contingencia; omite el build de producción.
  --port N       Usa un puerto local distinto de 3000.
  --help         Muestra esta ayuda.
EOF
}

while (($# > 0)); do
  case "$1" in
    --check-only) CHECK_ONLY=true ;;
    --dev) MODE="development" ;;
    --port)
      shift
      [[ ${1:-} =~ ^[0-9]+$ ]] || { error "--port requiere un número."; exit 2; }
      PORT="$1"
      ;;
    --help|-h) usage; exit 0 ;;
    *) error "Opción desconocida: $1"; usage; exit 2 ;;
  esac
  shift
done

if ((PORT < 1 || PORT > 65535)); then
  error "El puerto debe estar entre 1 y 65535."
  exit 2
fi

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    info "Deteniendo el servidor local (PID $SERVER_PID)..."
    case "$(uname -s)" in
      MINGW*|MSYS*)
        MSYS_NO_PATHCONV=1 taskkill.exe /PID "$SERVER_PID" /T /F >/dev/null 2>&1 || kill "$SERVER_PID" 2>/dev/null || true
        ;;
      *)
        kill "$SERVER_PID" 2>/dev/null || true
        ;;
    esac
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

cd "$REPO_ROOT"

printf '%s\n' '===================================================='
printf '%s\n' ' VALIDGATE — PREPARACIÓN DE DEMO'
printf '%s\n\n' '===================================================='

printf '%s\n' '[1/7] Entorno'
[[ -f package.json ]] || { error "No se encontró package.json en $REPO_ROOT"; exit 1; }
for command_name in node npm curl; do
  command -v "$command_name" >/dev/null 2>&1 || { error "Falta $command_name. Instálalo antes de la defensa."; exit 1; }
done
ok "Node $(node --version)"
ok "npm $(npm --version)"
[[ -d node_modules ]] || { error "Faltan dependencias. Ejecuta npm install antes de la defensa."; exit 1; }
node -e "const p=require('./package.json'); for(const s of ['build','start']) if(!p.scripts?.[s]) throw new Error('Falta script npm: '+s)"
node -e "require.resolve('next/package.json'); require.resolve('@playwright/test/package.json')"
ok "Dependencias y scripts requeridos disponibles"

printf '\n%s\n' '[2/7] Configuración'
node scripts/validgate-health.mjs env --demo

printf '\n%s\n' '[3/7] Supabase'
node scripts/validgate-health.mjs supabase

if [[ "$CHECK_ONLY" == true ]]; then
  printf '\n%s\n' '===================================================='
  printf '%s\n' ' VALIDGATE — PREFLIGHT CORRECTO'
  printf '%s\n' '===================================================='
  ok "Entorno, configuración y Supabase"
  exit 0
fi

node scripts/validgate-health.mjs port-free "$PORT"

printf '\n%s\n' '[4/7] Build'
if [[ "$MODE" == "production" ]]; then
  npm run build
  ok "Build de producción"
else
  warn "Modo de contingencia: se utilizará npm run dev."
fi

printf '\n%s\n' '[5/7] Inicio de aplicación'
mkdir -p .demo-logs
LOG_FILE=".demo-logs/validgate-$(date '+%Y%m%d-%H%M%S').log"
if [[ "$MODE" == "production" ]]; then
  node node_modules/next/dist/bin/next start -p "$PORT" >"$LOG_FILE" 2>&1 &
else
  node node_modules/next/dist/bin/next dev -p "$PORT" >"$LOG_FILE" 2>&1 &
fi
SERVER_PID=$!
info "Servidor iniciado con PID $SERVER_PID. Log: $LOG_FILE"

printf '\n%s\n' '[6/7] Espera y Playwright smoke tests'
APP_URL="http://localhost:$PORT"
deadline=$((SECONDS + 60))
until curl --silent --show-error --fail --max-time 3 "$APP_URL" >/dev/null 2>&1; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    error "Next.js terminó antes de quedar disponible."
    tail -n 30 "$LOG_FILE" >&2 || true
    exit 1
  fi
  if ((SECONDS >= deadline)); then
    error "Next.js no estuvo disponible dentro de 60 segundos."
    tail -n 30 "$LOG_FILE" >&2 || true
    exit 1
  fi
  sleep 1
done
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  error "El proceso iniciado terminó aunque el puerto responde; puede existir otro servidor en $APP_URL."
  tail -n 30 "$LOG_FILE" >&2 || true
  exit 1
fi
ok "Aplicación disponible en $APP_URL"

PLAYWRIGHT_BASE_URL="$APP_URL" npm run test:demo
ok "Playwright demo smoke"

printf '\n%s\n' '[7/7] Demo lista'
printf '%s\n' '===================================================='
printf '%s\n' ' VALIDGATE LISTO PARA DEMO'
printf '%s\n' '===================================================='
ok "Node / npm"
ok "Variables de entorno"
ok "Supabase"
[[ "$MODE" == "production" ]] && ok "Build de producción" || warn "Servidor de desarrollo"
ok "Next.js"
ok "Playwright smoke test"
printf '\nAplicación: %s\n\n' "$APP_URL"
printf '%s\n' 'Servidor en ejecución. Presione Ctrl+C para finalizar.'

wait "$SERVER_PID"
