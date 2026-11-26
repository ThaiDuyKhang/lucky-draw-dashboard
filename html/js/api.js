// Client dùng chung: gọi API, nhận cập nhật trực tiếp, áp dụng giao diện (ảnh + màu).
(function () {
  const DEFAULT_IMAGES = {
    background: "/images/bg-2.png",
    title: "/images/main-text.png",
    arrow: "/images/button-wheel.png",
    frame: "/images/wheel.png",
  };

  const DEFAULT_COLORS = {
    segment1: "#f3ffe1",
    text1: "#246d4b",
    segment2: "#246d4b",
    text2: "#ffffff",
    center: "#246d4b",
    centerText: "#f3ffe1",
  };

  function goLogin() {
    const next = location.pathname + location.search;
    location.href = "/login?next=" + encodeURIComponent(next);
  }

  async function request(method, path, body, headers = {}) {
    const opts = { method, headers: { ...headers }, credentials: "same-origin" };
    if (method !== "GET") opts.headers["X-LD-Admin"] = "1";
    if (body !== undefined) {
      if (body instanceof Blob) {
        opts.body = body;
        opts.headers["Content-Type"] = body.type;
      } else {
        opts.body = JSON.stringify(body);
        opts.headers["Content-Type"] = "application/json";
      }
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch (e) {
      throw new Error("Mất kết nối tới máy chủ. Kiểm tra Internet rồi thử lại.");
    }
    let data = null;
    try {
      data = await res.json();
    } catch (e) {}
    if (res.status === 401 && data && data.needLogin) {
      goLogin();
      throw new Error(data.error);
    }
    if (!res.ok || (data && data.ok === false)) {
      throw new Error((data && data.error) || "Lỗi máy chủ (HTTP " + res.status + ")");
    }
    return data;
  }

  const api = {
    publicState: () => request("GET", "/api/state"),
    adminState: () => request("GET", "/api/admin/state"),
    // Thao tác admin: trả về { ok, state, ... }
    action: (name, body = {}) => request("POST", "/api/admin/" + name, body),
    uploadImage: (blob) => request("POST", "/api/admin/image", blob),
    logout: () => request("POST", "/api/logout", {}),
    imageUrl: (id, key) => (id ? "/api/image/" + id : DEFAULT_IMAGES[key] || ""),
    DEFAULT_IMAGES,
    DEFAULT_COLORS,
  };

  // ---------- Cập nhật trực tiếp ----------
  // onChange() được gọi khi dữ liệu trên máy chủ thay đổi (WebSocket + dự phòng 20s/lần)
  api.live = function (onChange) {
    let ws = null;
    let retry = 1000;
    let pingTimer = null;
    let debounce = null;

    const trigger = () => {
      clearTimeout(debounce);
      debounce = setTimeout(onChange, 150);
    };

    function connect() {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      try {
        ws = new WebSocket(proto + "//" + location.host + "/api/live");
      } catch (e) {
        return setTimeout(connect, retry);
      }
      ws.onopen = () => {
        if (retry > 1000) trigger(); // kết nối lại sau khi rớt -> tải lại cho chắc
        retry = 1000;
        clearInterval(pingTimer);
        pingTimer = setInterval(() => ws.readyState === 1 && ws.send("ping"), 30000);
      };
      ws.onmessage = (e) => {
        if (e.data !== "pong") trigger();
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        setTimeout(connect, retry);
        retry = Math.min(retry * 2, 15000);
      };
    }

    connect();
    setInterval(trigger, 20000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) trigger();
    });
  };

  // ---------- Giao diện ----------
  api.colors = function (theme) {
    return Object.assign({}, DEFAULT_COLORS, (theme && theme.colors) || {});
  };

  // Gắn ảnh tuỳ chỉnh vào trang (phần tử nào không có trên trang thì bỏ qua)
  api.applyTheme = function (theme) {
    const images = (theme && theme.images) || {};
    document.body.style.backgroundImage = images.background
      ? 'url("' + api.imageUrl(images.background) + '")'
      : "";
    document.querySelectorAll(".main-title").forEach((el) => {
      el.style.backgroundImage = images.title ? 'url("' + api.imageUrl(images.title) + '")' : "";
    });
    document.querySelectorAll(".spin-button-image").forEach((el) => {
      const src = api.imageUrl(images.arrow, "arrow");
      if (el.getAttribute("src") !== src) el.src = src;
    });
    document.querySelectorAll(".wheel-image").forEach((el) => {
      const src = api.imageUrl(images.frame, "frame");
      if (el.getAttribute("src") !== src) el.src = src;
    });
    document.documentElement.classList.add("theme-ready");
  };

  api.escapeHtml = function (text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  // Nén / thu nhỏ ảnh trước khi tải lên (giới hạn lưu trữ ~1.9MB mỗi ảnh)
  api.prepareImage = async function (file, { maxWidth = 1600, maxHeight = 1600, opaque = false } = {}) {
    if (!file || !/^image\//.test(file.type)) throw new Error("Vui lòng chọn file ảnh (PNG, JPG, WEBP)");
    if (file.size > 25 * 1024 * 1024) throw new Error("Ảnh quá lớn (tối đa 25MB)");
    if (file.type === "image/svg+xml") {
      if (file.size > 1.5 * 1024 * 1024) throw new Error("File SVG quá lớn");
      return file;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("File ảnh bị lỗi hoặc không đúng định dạng"));
        el.src = url;
      });
      const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      // Ảnh nhỏ, đã đúng kích thước -> giữ nguyên file gốc
      if (scale === 1 && file.size < 1.2 * 1024 * 1024 && /png|jpeg|webp|gif/.test(file.type)) return file;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const type = opaque ? "image/jpeg" : "image/webp";
      for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
        const blob = await new Promise((r) => canvas.toBlob(r, type, quality));
        if (blob && blob.size < 1.8 * 1024 * 1024) return blob;
      }
      throw new Error("Ảnh quá lớn, hãy chọn ảnh nhỏ hơn");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  window.LuckyApi = api;
})();
