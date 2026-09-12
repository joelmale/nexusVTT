#!/bin/bash

echo "🔍 Nexus VTT - Port Management Helper"
echo "===================================="

# Function to check if port is in use
check_port() {
    local port=$1
    local result=$(lsof -i :$port 2>/dev/null)
    if [ -n "$result" ]; then
        echo "❌ Port $port is in use:"
        echo "$result" | head -2
        return 1
    else
        echo "✅ Port $port is available"
        return 0
    fi
}

echo ""
echo "Checking common ports:"
echo "─────────────────────"

# Check common ports
ports=(5000 5001 5002 8080 3000)
available_ports=()

for port in "${ports[@]}"; do
    if check_port $port; then
        available_ports+=($port)
    fi
    echo ""
done

echo "🎯 Recommendations:"
echo "─────────────────"

if [ ${#available_ports[@]} -eq 0 ]; then
    echo "❌ No common ports available. Try:"
    echo "   PORT=9000 npm run server:dev"
else
    first_port=${available_ports[0]}
    echo "✅ Use port $first_port:"
    if [ $first_port -eq 5000 ]; then
        echo "   npm run server:dev"
    else
        echo "   PORT=$first_port npm run server:dev"
        echo ""
        echo "🔧 Also update your frontend:"
        echo "   WS_PORT=$first_port npm run dev"
    fi
fi

echo ""
echo "🚀 Quick Start Commands:"
echo "─────────────────────"
echo "Terminal 1 (Frontend):"
echo "   npm run dev"
echo ""
echo "Terminal 2 (Backend):"
if [ ${#available_ports[@]} -eq 0 ]; then
    echo "   PORT=9000 npm run server:dev"
    echo ""
    echo "Terminal 1 (Frontend with custom port):"
    echo "   WS_PORT=9000 npm run dev"
else
    first_port=${available_ports[0]}
    if [ $first_port -eq 5000 ]; then
        echo "   npm run server:dev"
    else
        echo "   PORT=$first_port npm run server:dev"
        echo ""
        echo "Terminal 1 (Frontend with custom port):"
        echo "   WS_PORT=$first_port npm run dev"
    fi
fi

echo ""
echo "💡 The server will automatically find an available port if the default is busy!"
