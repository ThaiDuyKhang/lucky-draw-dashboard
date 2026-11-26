// Tuỳ chỉnh giao diện (ảnh + màu) dùng chung cho Vòng quay và Dashboard.
// - Màu lưu trong localStorage ("luckydraw_theme_colors")
// - Ảnh tải lên lưu trong IndexedDB (ảnh nền có thể vài MB, vượt giới hạn localStorage)
// - Mỗi lần thay đổi ghi "luckydraw_theme_rev" để các tab khác nhận sự kiện storage
(function () {
  const COLORS_KEY = "luckydraw_theme_colors";
  const REV_KEY = "luckydraw_theme_rev";
  const DB_NAME = "luckydraw";
  const STORE = "images";

  const DEFAULT_COLORS = {
    segment1: "#f3ffe1", // ô lẻ
    text1: "#246d4b", // chữ trên ô lẻ
    segment2: "#246d4b", // ô chẵn
    text2: "#ffffff", // chữ trên ô chẵn
    center: "#246d4b", // vòng tròn ở tâm
    centerText: "#f3ffe1", // chữ ở tâm
  };

  // Ảnh có thể thay + ảnh mặc định (đường dẫn tính từ thư mục html/)
  const IMAGES = {
    background: { label: "Ảnh nền", src: "./images/bg-2.png" },
    title: { label: "Ảnh tiêu đề", src: "./images/main-text.png" },
    arrow: { label: "Nút mũi tên (giữa vòng quay)", src: "./images/button-wheel.png" },
    frame: { label: "Vành vòng quay", src: "./images/wheel.png" },
  };

  const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

  // ---------- Màu ----------
  function getColors() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(COLORS_KEY)) || {};
    } catch (e) {}
    const colors = Object.assign({}, DEFAULT_COLORS);
    Object.keys(DEFAULT_COLORS).forEach((k) => {
      if (/^#[0-9a-f]{6}$/i.test(saved[k] || "")) colors[k] = saved[k];
    });
    return colors;
  }

  function saveColors(colors) {
    localStorage.setItem(COLORS_KEY, JSON.stringify(colors));
    bumpRevision();
  }

  function resetColors() {
    localStorage.removeItem(COLORS_KEY);
    bumpRevision();
  }

  function bumpRevision() {
    try {
      localStorage.setItem(REV_KEY, String(Date.now()));
    } catch (e) {}
  }

  // ---------- IndexedDB ----------
  let dbPromise = null;
  function openDb() {
    if (!window.indexedDB) return Promise.reject(new Error("Trình duyệt không hỗ trợ IndexedDB"));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      dbPromise.catch(() => (dbPromise = null));
    }
    return dbPromise;
  }

  function dbRequest(mode, fn) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req && req.result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  }

  function getImageBlob(key) {
    return dbRequest("readonly", (s) => s.get(key)).catch(() => undefined);
  }

  function saveImage(key, file) {
    if (!IMAGES[key]) return Promise.reject(new Error("Loại ảnh không hợp lệ"));
    if (!file || !/^image\//.test(file.type)) {
      return Promise.reject(new Error("Vui lòng chọn file ảnh (PNG, JPG, WEBP, GIF, SVG)"));
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return Promise.reject(new Error("Ảnh quá lớn (tối đa 15MB)"));
    }
    // Lưu dạng Blob thuần để tránh phụ thuộc kiểu File khi đọc lại
    const blob = new Blob([file], { type: file.type });
    return checkImage(blob)
      .then(() => dbRequest("readwrite", (s) => s.put(blob, key)))
      .then(bumpRevision);
  }

  // Đảm bảo trình duyệt đọc được ảnh (chặn file hỏng / đổi đuôi)
  function checkImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("File ảnh bị lỗi hoặc không đúng định dạng"));
      };
      img.src = url;
    });
  }

  function resetImage(key) {
    return dbRequest("readwrite", (s) => s.delete(key)).then(bumpRevision);
  }

  function resetAll() {
    resetColors();
    return dbRequest("readwrite", (s) => s.clear())
      .catch(() => {})
      .then(bumpRevision);
  }

  // URL hiện tại của từng ảnh (ảnh tải lên hoặc mặc định)
  const objectUrls = {};
  function getImageUrls() {
    const keys = Object.keys(IMAGES);
    return Promise.all(keys.map(getImageBlob)).then((blobs) => {
      const urls = {};
      const custom = {};
      keys.forEach((key, i) => {
        if (objectUrls[key]) {
          URL.revokeObjectURL(objectUrls[key]);
          delete objectUrls[key];
        }
        if (blobs[i]) {
          objectUrls[key] = URL.createObjectURL(blobs[i]);
          urls[key] = objectUrls[key];
          custom[key] = true;
        } else {
          urls[key] = IMAGES[key].src;
          custom[key] = false;
        }
      });
      return { urls, custom };
    });
  }

  // Gắn ảnh vào trang hiện tại (phần tử nào không có trên trang thì bỏ qua)
  function applyImages() {
    return getImageUrls().then(({ urls, custom }) => {
      const bg = custom.background ? 'url("' + urls.background + '")' : "";
      document.body.style.backgroundImage = bg; // "" = dùng ảnh mặc định trong CSS
      document.querySelectorAll(".main-title").forEach((el) => {
        el.style.backgroundImage = custom.title ? 'url("' + urls.title + '")' : "";
      });
      document.querySelectorAll(".spin-button-image").forEach((el) => (el.src = urls.arrow));
      document.querySelectorAll(".wheel-image").forEach((el) => (el.src = urls.frame));
      return { urls, custom };
    });
  }

  // Gọi callback khi tab khác đổi giao diện
  function onChange(callback) {
    window.addEventListener("storage", (e) => {
      if (e.key === REV_KEY || e.key === COLORS_KEY) callback();
    });
  }

  window.LuckyTheme = {
    DEFAULT_COLORS,
    IMAGES,
    getColors,
    saveColors,
    resetColors,
    saveImage,
    resetImage,
    resetAll,
    getImageUrls,
    applyImages,
    onChange,
  };
})();
