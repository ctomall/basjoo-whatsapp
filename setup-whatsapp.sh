#!/bin/bash
# Basjoo WhatsApp 桥接 - 一键安装脚本
set -e

echo "🤖 Basjoo WhatsApp Bridge — 安装脚本"
echo "======================================"
echo ""

# 1. 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 需要 Node.js v18+。安装中..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "✅ Node.js $(node -v)"

# 2. 安装依赖
echo ""
echo "📦 安装依赖..."
cd "$(dirname "$0")"
npm install whatsapp-web.js qrcode-terminal axios 2>&1 | tail -3

# 3. 检查 Basjoo
echo ""
BASJOO_URL="${BASJOO_URL:-http://localhost:8000}"
echo "🔍 检查 Basjoo 服务: $BASJOO_URL"
if curl -s "$BASJOO_URL/health" > /dev/null 2>&1; then
    echo "✅ Basjoo 已运行"
else
    echo "⚠️  Basjoo 未检测到（$BASJOO_URL/health 无响应）"
    echo "   可以先部署 Basjoo 或设置 BASJOO_URL 环境变量"
    echo ""
    echo "   # 部署 Basjoo（一键）:"
    echo "   curl -fsSL https://raw.githubusercontent.com/haoyiyin/basjoo/main/install-deploy.sh | sudo sh"
fi

# 4. 启动说明
echo ""
echo "======================================"
echo "✅ 安装完成！启动方法："
echo ""
echo "  # 如果 Basjoo 在这台机器上:"
echo "  node whatsapp-bridge.js"
echo ""
echo "  # 如果 Basjoo 在另一台机器:"
echo "  BASJOO_URL=http://你的服务器IP:8000 node whatsapp-bridge.js"
echo ""
echo "  终端出现 QR 码后 → 手机 WhatsApp 扫码 → 自动工作"
echo "======================================"
