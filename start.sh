#!/bin/bash

# SAP CPI Ticketing Agent - Startup Script
echo "╔═══════════════════════════════════════════════════╗"
echo "║     SAP CPI AI Ticketing Integration Agent        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js 18+"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ required. Found: $(node -v)"
  exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check .env
if [ ! -f "backend/.env" ]; then
  echo ""
  echo "⚠️  backend/.env not found!"
  echo "Creating from example..."
  cp backend/.env.example backend/.env
  echo ""
  echo "🔑 ACTION REQUIRED: Edit backend/.env and set your ANTHROPIC_API_KEY"
  echo "   Then re-run this script."
  echo ""
  read -p "Press Enter after setting your API key..."
fi

# Check API key
API_KEY=$(grep "GEMINI_API_KEY" backend/.env | cut -d'=' -f2 | tr -d ' ')
if [ -z "$API_KEY" ] || [ "$API_KEY" = "your_gemini_api_key_here" ]; then
  echo ""
  echo "❌ GEMINI_API_KEY not set in backend/.env"
  echo "   Get your free key at: https://aistudio.google.com/app/apikey"
  exit 1
fi

echo "✅ API key configured"
echo ""

# Install dependencies
echo "📦 Installing backend dependencies..."
cd backend && npm install --silent
echo "✅ Backend dependencies installed"
cd ..

echo "📦 Installing frontend dependencies..."
cd frontend && npm install --silent
echo "✅ Frontend dependencies installed"
cd ..

echo ""
echo "🚀 Starting services..."
echo ""

# Copy .env for frontend if not exists
if [ ! -f "frontend/.env" ]; then
  cp frontend/.env.example frontend/.env
fi

# Start backend in background
cd backend
NODE_ENV=development npm start &
BACKEND_PID=$!
cd ..

echo "⏳ Waiting for backend to start..."
sleep 3

# Check backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
  echo "✅ Backend running (PID: $BACKEND_PID) on http://localhost:5000"
else
  echo "❌ Backend failed to start. Check logs."
  exit 1
fi

# Start frontend
echo "🌐 Starting frontend..."
cd frontend
PORT=3000 npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║              🎉 Agent is Running!                  ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  Frontend:  http://localhost:3000                  ║"
echo "║  Backend:   http://localhost:5000                  ║"
echo "║  Health:    http://localhost:5000/health           ║"
echo "║  WebSocket: ws://localhost:5000/ws                 ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  Press Ctrl+C to stop all services                 ║"
echo "╚═══════════════════════════════════════════════════╝"

# Cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Stopping services..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  echo "✅ All services stopped"
  exit 0
}

trap cleanup INT TERM
wait
