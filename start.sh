#!/usr/bin/env bash
# Chạy vòng quay trên máy (macOS / Linux): ./start.sh
# Cần Node.js >= 20 (https://nodejs.org). Dữ liệu lưu trong thư mục .wrangler/
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Chưa cài Node.js. Tải tại https://nodejs.org (bản LTS) rồi chạy lại."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Cài đặt lần đầu (cần Internet)..."
  npm install || exit 1
fi

if [ ! -f .dev.vars ]; then
  read -r -s -p "Đặt mật khẩu admin: " PASS; echo
  printf 'ADMIN_PASSWORD=%s\n' "$PASS" > .dev.vars
  echo "Đã lưu mật khẩu vào file .dev.vars (sửa file này để đổi mật khẩu)."
fi

( sleep 4; URL="http://localhost:8080/dashboard"
  if command -v open >/dev/null 2>&1; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1; fi ) &

echo "Dashboard : http://localhost:8080/dashboard"
echo "Bảng danh sách (máy khác trong mạng LAN dùng IP của máy này): http://localhost:8080/bang-danh-sach/"
npm start
