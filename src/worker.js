// Cloudflare Worker: phục vụ web tĩnh (thư mục html/), API và đăng nhập admin.
//
// Trang công khai : /bang-danh-sach/  (chỉ xem), /login
// Trang admin     : / (vòng quay), /dashboard  -> cần đăng nhập
// Mật khẩu admin  : biến bí mật ADMIN_PASSWORD (Cloudflare Secret hoặc file .dev.vars)
import { LuckyDrawStore } from "./store.js";

export { LuckyDrawStore };

const SESSION_COOKIE = "ld_session";
const ADMIN_PAGES = new Set(["/", "/index.html", "/dashboard", "/dashboard.html"]);
const encoder = new TextEncoder();

function store(env) {
  return env.STORE.get(env.STORE.idFromName("main"));
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

// ---------- Phiên đăng nhập (cookie ký HMAC, đổi mật khẩu là mọi phiên hết hạn) ----------
async function sessionKey(env) {
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode("lucky-draw:" + env.ADMIN_PASSWORD));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function createSession(env, maxAgeSec) {
  const exp = String(Date.now() + maxAgeSec * 1000);
  const sig = await crypto.subtle.sign("HMAC", await sessionKey(env), encoder.encode(exp));
  return exp + "." + b64url(sig);
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}

async function isLoggedIn(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const token = getCookie(request, SESSION_COOKIE);
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  try {
    return await crypto.subtle.verify("HMAC", await sessionKey(env), fromB64url(sig), encoder.encode(exp));
  } catch (e) {
    return false;
  }
}

async function passwordMatches(input, env) {
  const a = await crypto.subtle.digest("SHA-256", encoder.encode(String(input || "")));
  const b = await crypto.subtle.digest("SHA-256", encoder.encode(env.ADMIN_PASSWORD));
  return crypto.subtle.timingSafeEqual(a, b);
}

function cookie(value, maxAgeSec, secure) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? "; Secure" : ""}`;
}

// ---------- API ----------
async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method;
  const stub = store(env);
  const secure = url.protocol === "https:";

  if (path === "/api/state" && method === "GET") {
    return json(await stub.getPublicState());
  }

  if (path === "/api/live") {
    return stub.fetch(request); // WebSocket: nhận thông báo "changed"
  }

  const img = path.match(/^\/api\/image\/([a-z0-9]{6,32})$/);
  if (img && method === "GET") {
    const image = await stub.getImage(img[1]);
    if (!image) return new Response("Not found", { status: 404 });
    return new Response(image.data, {
      headers: {
        "Content-Type": image.type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  }

  if (path === "/api/session" && method === "GET") {
    return json({ loggedIn: await isLoggedIn(request, env), passwordSet: !!env.ADMIN_PASSWORD });
  }

  if (path === "/api/login" && method === "POST") {
    if (!env.ADMIN_PASSWORD) {
      return json({ ok: false, error: "Chưa đặt mật khẩu admin (ADMIN_PASSWORD)" }, 503);
    }
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    if (!(await stub.loginAllowed(ip))) {
      return json({ ok: false, error: "Sai mật khẩu quá nhiều lần. Thử lại sau 10 phút." }, 429);
    }
    let body = {};
    try {
      body = await request.json();
    } catch (e) {}
    if (!(await passwordMatches(body.password, env))) {
      await stub.loginFailed(ip);
      await new Promise((r) => setTimeout(r, 800));
      return json({ ok: false, error: "Sai mật khẩu" }, 401);
    }
    const maxAge = body.remember ? 30 * 86400 : 12 * 3600;
    return json({ ok: true }, 200, { "Set-Cookie": cookie(await createSession(env, maxAge), maxAge, secure) });
  }

  if (path === "/api/logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0, secure) });
  }

  if (path.startsWith("/api/admin/")) {
    if (!(await isLoggedIn(request, env))) {
      return json({ ok: false, error: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại", needLogin: true }, 401);
    }
    // Chống CSRF: header tuỳ chỉnh không gửi được từ trang web khác nếu không qua CORS
    if (method !== "GET" && request.headers.get("X-LD-Admin") !== "1") {
      return json({ ok: false, error: "Thiếu header X-LD-Admin" }, 403);
    }
    const action = path.slice("/api/admin/".length);
    const meta = { origin: url.origin };

    if (action === "state" && method === "GET") {
      return json(await stub.getAdminState());
    }
    if (action === "image" && method === "POST") {
      const type = (request.headers.get("Content-Type") || "").split(";")[0].trim();
      const result = await stub.uploadImage(await request.arrayBuffer(), type);
      return json(result, result.ok ? 200 : 400);
    }
    if (method === "POST" && /^[a-zA-Z]+$/.test(action)) {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {}
      const result = await stub.admin(action, body, meta);
      return json(result, result.ok ? 200 : 400);
    }
  }

  return json({ ok: false, error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    // Trang admin: chưa đăng nhập -> chuyển tới /login
    if (ADMIN_PAGES.has(url.pathname) && !(await isLoggedIn(request, env))) {
      const next = url.pathname === "/index.html" ? "/" : url.pathname;
      return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(next)}`, 302);
    }

    const response = await env.ASSETS.fetch(request);
    // Trang HTML luôn lấy bản mới nhất sau mỗi lần deploy
    if ((response.headers.get("Content-Type") || "").includes("text/html")) {
      const res = new Response(response.body, response);
      res.headers.set("Cache-Control", "no-cache");
      return res;
    }
    return response;
  },
};
