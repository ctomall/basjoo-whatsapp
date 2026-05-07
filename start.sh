#!/bin/bash
# ============================================
# Basjoo + WhatsApp Bridge 一键启动脚本
# ============================================
set -e

BASJOO_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$BASJOO_DIR/data"
QDRANT_BIN="/tmp/qdrant"
QDRANT_STORAGE="$BASJOO_DIR/qdrant_storage"

echo "🚀 Starting Basjoo + WhatsApp Bridge..."
echo ""

# ---------- 1. Qdrant Vector DB ----------
if ! pgrep -f "qdrant --storage-path" > /dev/null 2>&1; then
    echo "📦 Starting Qdrant..."
    if [ ! -f "$QDRANT_BIN" ]; then
        echo "   Downloading Qdrant v1.12.1..."
        curl -sL "https://github.com/qdrant/qdrant/releases/download/v1.12.1/qdrant-x86_64-unknown-linux-gnu.tar.gz" -o /tmp/qdrant.tar.gz
        tar xzf /tmp/qdrant.tar.gz -C /tmp/
        rm /tmp/qdrant.tar.gz
    fi
    mkdir -p "$QDRANT_STORAGE"
    nohup "$QDRANT_BIN" --storage-path "$QDRANT_STORAGE" --uri "http://127.0.0.1:6333" > "$DATA_DIR/qdrant.log" 2>&1 &
    sleep 2
    if curl -s http://127.0.0.1:6333/health > /dev/null 2>&1; then
        echo "   ✅ Qdrant ready (port 6333)"
    else
        echo "   ⚠️  Qdrant may not be ready yet"
    fi
else
    echo "📦 Qdrant already running ✓"
fi

# ---------- 2. Basjoo Backend ----------
if ! pgrep -f "python3 main.py" | grep -q basjoo 2>/dev/null; then
    echo "🧠 Starting Basjoo Backend..."
    cd "$BASJOO_DIR/backend"
    mkdir -p "$DATA_DIR"
    nohup python3 main.py > "$DATA_DIR/backend.log" 2>&1 &
    sleep 4
    if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
        echo "   ✅ Basjoo Backend ready (port 8000)"
    else
        echo "   ⚠️  Backend may not be ready, check $DATA_DIR/backend.log"
    fi
else
    echo "🧠 Basjoo Backend already running ✓"
fi

# ---------- 3. WhatsApp Bridge ----------
if ! pgrep -f "node bridge.js" | grep -q basjoo 2>/dev/null; then
    echo "📱 Starting WhatsApp Bridge..."
    echo ""
    echo "   ╔══════════════════════════════════════╗"
    echo "   ║  📱 SCAN QR CODE WITH WHATSAPP      ║"
    echo "   ║  Open WhatsApp → Settings →         ║"
    echo "   ║  Linked Devices → Link a Device     ║"
    echo "   ╚══════════════════════════════════════╝"
    echo ""
    cd "$BASJOO_DIR/whatsapp-bridge"
    node bridge.js
else
    echo "📱 WhatsApp Bridge already running ✓"
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Basjoo Admin:  http://localhost:3000"
echo "  API Docs:      http://localhost:8000/docs"
echo "  Health Check:  http://localhost:8000/health"
echo "  Bridge:        http://localhost:3001/health"
echo "═══════════════════════════════════════════"
