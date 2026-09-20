#!/usr/bin/env bash

# ==============================================================================
# Akademiya — Learning Intelligence Platform Startup Script
# ==============================================================================

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="${PROJECT_DIR}/server"
APP_DIR="${PROJECT_DIR}/app"

# Terminal Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║             🎓 AKADEMIYA — LEARNING INTELLIGENCE PLATFORM            ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ------------------------------------------------------------------------------
# 1. Database Check (PostgreSQL + pgvector on port 5433)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}🔍 [1/3] Checking Database (PostgreSQL + pgvector)...${NC}"

if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -q "^akademiya-postgres$"; then
    echo -e "${GREEN}  ✓ PostgreSQL container 'akademiya-postgres' is already running.${NC}"
  elif docker ps -a --format '{{.Names}}' | grep -q "^akademiya-postgres$"; then
    echo -e "${CYAN}  ▶ Starting existing container 'akademiya-postgres'...${NC}"
    docker start akademiya-postgres >/dev/null
    echo -e "${GREEN}  ✓ PostgreSQL container started.${NC}"
  else
    echo -e "${YELLOW}  ⚠ Warning: Container 'akademiya-postgres' not found.${NC}"
    echo -e "    Ensure PostgreSQL with pgvector is accessible on the port specified in server/.env."
  fi

  # Wait briefly for PostgreSQL to be ready
  for i in {1..10}; do
    if docker exec akademiya-postgres pg_isready -U postgres >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ PostgreSQL is ready and accepting connections.${NC}"
      break
    fi
    sleep 1
  done
else
  echo -e "${YELLOW}  ⚠ Docker CLI not found. Skipping docker container check.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. Cleanup traps for graceful termination on Ctrl+C / EXIT
# ------------------------------------------------------------------------------
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo -e "\n${YELLOW}🛑 Shutting down Akademiya services...${NC}"
  if [ -n "${BACKEND_PID}" ] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill -TERM "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [ -n "${FRONTEND_PID}" ] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill -TERM "${FRONTEND_PID}" 2>/dev/null || true
  fi
  wait 2>/dev/null
  echo -e "${GREEN}✓ All services stopped safely.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ------------------------------------------------------------------------------
# 3. Start Backend Server (Express + WebSocket on port 5000)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}🚀 [2/3] Starting Backend Server (Express + WebSocket)...${NC}"
cd "${SERVER_DIR}"

if [ ! -d "node_modules" ]; then
  echo -e "${CYAN}  ▶ Installing server dependencies...${NC}"
  npm install
fi

node --watch index.js &
BACKEND_PID=$!
echo -e "${GREEN}  ✓ Backend started (PID: ${BACKEND_PID}) at http://localhost:5000${NC}"

# ------------------------------------------------------------------------------
# 4. Start Frontend Application (Vite on port 5173)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}💻 [3/3] Starting Frontend Application (Vite Desktop OS)...${NC}"
cd "${APP_DIR}"

if command -v bun >/dev/null 2>&1; then
  bun run dev --host 0.0.0.0 --port 5173 &
  FRONTEND_PID=$!
elif command -v npm >/dev/null 2>&1; then
  npm run dev -- --host 0.0.0.0 --port 5173 &
  FRONTEND_PID=$!
else
  echo -e "${RED}❌ Neither bun nor npm found. Cannot start frontend.${NC}"
  exit 1
fi

echo -e "${GREEN}  ✓ Frontend started (PID: ${FRONTEND_PID}) at http://localhost:5173${NC}"

# ------------------------------------------------------------------------------
# 5. Ready Info Banner
# ------------------------------------------------------------------------------
sleep 2

echo -e "\n${GREEN}${BOLD}========================================================================${NC}"
echo -e "${GREEN}${BOLD} ✨ AKADEMIYA PLATFORM IS READY! ✨${NC}"
echo -e "${GREEN}${BOLD}========================================================================${NC}"
echo -e "  ${BOLD}🌐 Frontend UI:${NC}         ${CYAN}http://localhost:5173${NC}"
echo -e "  ${BOLD}⚡ Backend API:${NC}         ${CYAN}http://localhost:5000${NC}"
echo -e "  ${BOLD}🔌 Realtime WebSocket:${NC}  ${CYAN}ws://localhost:5000/ws${NC}"
echo -e "  ${BOLD}🗄️ Database:${NC}            ${CYAN}PostgreSQL + pgvector (port 5433)${NC}"
echo -e ""
echo -e "  ${BOLD}Demo Credentials (Lock Screen):${NC}"
echo -e "    👩‍🏫 ${BOLD}Teacher:${NC} teacher.golden@akademiya.io / password123"
echo -e "    🎓 ${BOLD}Student:${NC} student.golden@akademiya.io / password123"
echo -e "${GREEN}${BOLD}========================================================================${NC}"
echo -e "${YELLOW}Press [Ctrl+C] anytime to stop all servers.${NC}\n"

# Wait for both background processes
wait "${BACKEND_PID}" "${FRONTEND_PID}"
