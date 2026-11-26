#!/usr/bin/env bash
# Chạy vòng quay trên macOS / Linux: ./start.sh   (đổi cổng: PORT=8081 ./start.sh)
# Tự dùng Node.js nếu có, không thì dùng Python 3.

cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8080}"
URL="http://localhost:$PORT/"

open_browser() {
  sleep 1
  if command -v open >/dev/null 2>&1; then open "$URL"        # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1  # Linux
  fi
}

if command -v node >/dev/null 2>&1; then
  open_browser &
  PORT="$PORT" exec node server.js
elif command -v python3 >/dev/null 2>&1; then
  echo "Vòng quay may mắn đang chạy:"
  echo "  Vòng quay : $URL"
  echo "  Dashboard : ${URL}dashboard.html"
  echo "Nhấn Ctrl + C để tắt."
  open_browser &
  exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory html
else
  echo "Không tìm thấy Node.js hoặc Python 3."
  echo "Cài một trong hai (https://nodejs.org hoặc https://python.org), hoặc mở thẳng file html/index.html bằng Chrome/Edge."
  exit 1
fi
