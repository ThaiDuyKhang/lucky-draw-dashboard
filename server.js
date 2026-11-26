// Web server tĩnh tối giản cho thư mục html/ — không cần cài thêm thư viện.
// Chạy:  node server.js        (hoặc: npm start)
// Đổi cổng: PORT=3000 node server.js   (Windows PowerShell: $env:PORT=3000; node server.js)

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.join(__dirname, "html");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".csv": "text/csv; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch (e) {
    res.writeHead(400);
    return res.end("Bad request");
  }
  if (urlPath.endsWith("/")) urlPath += "index.html";

  const filePath = path.join(ROOT, urlPath);
  // Chặn truy cập ra ngoài thư mục html/
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 - Không tìm thấy file");
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Cổng ${PORT} đang bị dùng. Thử cổng khác, ví dụ: PORT=8081 node server.js`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log("Vòng quay may mắn đang chạy:");
  console.log(`  Vòng quay : http://localhost:${PORT}/`);
  console.log(`  Dashboard : http://localhost:${PORT}/dashboard.html`);
  console.log("Nhấn Ctrl + C để tắt.");
});
