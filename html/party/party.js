// Vòng quay Party: chơi nhanh trên điện thoại, không cần đăng nhập.
// Tên, âm thanh, hình nền được lưu trên máy (localStorage); âm thanh / hình nền /
// nút quay do admin cài sẵn trong Dashboard > tab Party.
(function () {
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = "party_v1";
  const SPIN_MS = 6000;
  const BUILTIN_SOUND = { id: "builtin", name: "Mặc định", spinUrl: "/sound/am-thanh-vong-quay.mp3", winUrl: "/sound/am-thanh-chien-thang.mp3" };
  const SAMPLE = ["An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khoa", "Linh", "Minh", "Ngọc"];

  // Màu pastel đậm (nền ô, chữ)
  const PALETTE = [
    ["#9fcdf5", "#1d4a73"],
    ["#5fe1f2", "#0b5058"],
    ["#9ad59d", "#1f5523"],
    ["#e6ee9c", "#57600f"],
    ["#fddc84", "#6b4a00"],
    ["#ffb69e", "#7a2e16"],
    ["#f594b2", "#7a1636"],
    ["#ae91dc", "#3b1f6b"],
  ];

  // ---------- Trạng thái ----------
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch (e) {}
  const prefs = {
    names: Array.isArray(saved.names) ? saved.names : SAMPLE.slice(0, 8),
    soundId: saved.soundId || null,
    bgId: saved.bgId || null,
    muted: !!saved.muted,
  };
  let config = { sounds: [], backgrounds: [], button: null };
  let slices = [];
  let rotation = 0;
  let spinning = false;
  let lastWinner = null;
  let spinAudio = null;
  let winAudio = null;

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  function randomInt(max) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do crypto.getRandomValues(buf);
    while (buf[0] >= limit);
    return buf[0] % max;
  }

  function esc(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ---------- Vẽ vòng quay ----------
  function colorsFor(n) {
    const idx = [];
    for (let i = 0; i < n; i++) {
      let c = i % PALETTE.length;
      // Ô cuối không trùng màu ô đầu (2 ô này nằm cạnh nhau)
      if (i === n - 1 && n > 1 && c === idx[0]) c = (c + 3) % PALETTE.length;
      if (i > 0 && c === idx[i - 1]) c = (c + 1) % PALETTE.length;
      idx.push(c);
    }
    return idx.map((c) => PALETTE[c]);
  }

  function drawWheel() {
    const svg = $("wheel-svg");
    const names = prefs.names;
    const n = names.length;
    const C = 500, R = 470, RIM = 26;
    slices = names.map((name, i) => ({ name }));
    if (n === 0) {
      svg.innerHTML = `<g id="wheel-rot"><circle cx="${C}" cy="${C}" r="${R}" fill="#f1eefa" stroke="#e2dcf3" stroke-width="${RIM}"/>
        <text x="${C}" y="${C + 230}" fill="#8b84a8" font-size="40" text-anchor="middle">Thêm tên để bắt đầu</text></g>`;
      return;
    }
    const colors = colorsFor(n);
    const step = 360 / n;
    const fontSize = Math.max(18, Math.min(52, 900 / n + 16, 1400 / Math.max(...names.map((x) => x.length), 4) / 1.2));
    const maxChars = Math.max(6, Math.floor((R * 0.72) / (fontSize * 0.55)));
    let html = "";
    names.forEach((name, i) => {
      html += `<g class="slice" data-i="${i}">`;
      const [bg, fg] = colors[i];
      slices[i].color = bg;
      slices[i].text = fg;
      const a1 = (i * step - 90) * (Math.PI / 180);
      const a2 = ((i + 1) * step - 90) * (Math.PI / 180);
      const large = step > 180 ? 1 : 0;
      const p = (r, a) => `${C + r * Math.cos(a)},${C + r * Math.sin(a)}`;
      if (n === 1) {
        html += `<circle cx="${C}" cy="${C}" r="${R}" fill="${bg}"/>`;
        html += `<circle cx="${C}" cy="${C}" r="${R - RIM / 2}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="${RIM}"/>`;
      } else {
        html += `<path d="M${C},${C} L${p(R, a1)} A${R},${R} 0 ${large} 1 ${p(R, a2)} Z" fill="${bg}"/>`;
        // Viền ngoài sáng hơn (giống bánh xe pastel)
        html += `<path d="M${p(R, a1)} A${R},${R} 0 ${large} 1 ${p(R, a2)} L${p(R - RIM, a2)} A${R - RIM},${R - RIM} 0 ${large} 0 ${p(R - RIM, a1)} Z" fill="#fff" fill-opacity=".45"/>`;
      }
      const mid = i * step + step / 2; // độ, tính từ đỉnh theo chiều kim đồng hồ
      const label = name.length > maxChars ? name.slice(0, maxChars - 1) + "…" : name;
      const tx = C + (R - RIM - 18) * Math.cos((mid - 90) * (Math.PI / 180));
      const ty = C + (R - RIM - 18) * Math.sin((mid - 90) * (Math.PI / 180));
      // Chữ chạy từ mép ngoài vào tâm (giống vòng quay mẫu)
      html += `<text x="${tx}" y="${ty}" fill="${fg}" font-size="${fontSize}" text-anchor="start" dominant-baseline="central" transform="rotate(${mid + 90}, ${tx}, ${ty})">${esc(label)}</text>`;
      html += `</g>`;
    });
    svg.innerHTML = `<g id="wheel-rot" style="transform:rotate(${rotation}deg)">${html}</g>`;
  }

  // ---------- Danh sách tên ----------
  function readNames() {
    return $("names-input")
      .value.split(/\r?\n/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 200);
  }

  function setNames(names, updateInput = true) {
    const changed = names.join("\n") !== prefs.names.join("\n");
    prefs.names = names;
    if (changed || updateInput) clearResult();
    if (updateInput) $("names-input").value = names.join("\n");
    $("name-count").textContent = names.length;
    persist();
    if (!spinning && (changed || !$("wheel-rot"))) drawWheel();
  }

  let inputTimer = null;
  $("names-input").addEventListener("input", () => {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => setNames(readNames(), false), 250);
  });

  $("btn-sample").addEventListener("click", () => setNames(SAMPLE.slice()));
  $("btn-clear").addEventListener("click", () => {
    if (!prefs.names.length || confirm("Xoá hết tên trong danh sách?")) setNames([]);
  });

  $("btn-shuffle").addEventListener("click", () => {
    if (spinning || prefs.names.length < 2) return;
    const arr = prefs.names.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setNames(arr);
    $("wheel-svg").animate([{ opacity: 0.4, transform: "scale(.96)" }, { opacity: 1, transform: "scale(1)" }], { duration: 300 });
  });

  // ---------- Âm thanh ----------
  function currentSound() {
    const all = [BUILTIN_SOUND, ...config.sounds.map((s) => ({ id: s.id, name: s.name, spinUrl: "/api/audio/" + s.spinId, winUrl: s.winId ? "/api/audio/" + s.winId : BUILTIN_SOUND.winUrl }))];
    return all.find((s) => s.id === prefs.soundId) || all.find((s) => s.id === config.defaultSoundId) || all[0];
  }

  function prepareAudio() {
    const s = currentSound();
    if (!spinAudio || spinAudio.dataset.src !== s.spinUrl) {
      spinAudio = new Audio(s.spinUrl);
      spinAudio.dataset.src = s.spinUrl;
      spinAudio.preload = "auto";
    }
    if (!winAudio || winAudio.dataset.src !== s.winUrl) {
      winAudio = new Audio(s.winUrl);
      winAudio.dataset.src = s.winUrl;
      winAudio.preload = "auto";
    }
  }

  function renderSoundSelect() {
    const sel = $("sound-select");
    const list = [BUILTIN_SOUND, ...config.sounds];
    sel.innerHTML = list.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
    sel.value = currentSound().id;
  }

  $("sound-select").addEventListener("change", (e) => {
    prefs.soundId = e.target.value;
    persist();
    prepareAudio();
    // Nghe thử 1.5 giây
    if (!prefs.muted && !spinning) {
      spinAudio.currentTime = 0;
      spinAudio.volume = 0.8;
      spinAudio.play().catch(() => {});
      setTimeout(() => !spinning && spinAudio.pause(), 1500);
    }
  });

  function renderMute() {
    $("btn-mute").innerHTML = prefs.muted ? '<i class="li icon-volume-x"></i>' : '<i class="li icon-volume-2"></i>';
  }

  $("btn-mute").addEventListener("click", () => {
    prefs.muted = !prefs.muted;
    persist();
    renderMute();
    if (prefs.muted && spinAudio) spinAudio.pause();
  });

  // ---------- Hình nền ----------
  function renderBgSelect() {
    const sel = $("bg-select");
    sel.innerHTML = `<option value="">Pastel</option>` + config.backgrounds.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("");
    const exists = (id) => config.backgrounds.some((b) => b.id === id);
    const id = prefs.bgId === "" ? "" : exists(prefs.bgId) ? prefs.bgId : exists(config.defaultBackgroundId) ? config.defaultBackgroundId : "";
    sel.value = id;
    applyBg(id);
  }

  function applyBg(id) {
    const bg = config.backgrounds.find((b) => b.id === id);
    document.body.style.backgroundImage = bg ? `url("/api/image/${bg.imageId}")` : "";
  }

  $("bg-select").addEventListener("change", (e) => {
    prefs.bgId = e.target.value;
    persist();
    applyBg(prefs.bgId);
  });

  // ---------- Nút quay ----------
  function renderButton() {
    const img = $("spin-btn-image");
    const btn = $("spin-btn");
    if (config.button && config.button.imageId) {
      img.src = "/api/image/" + config.button.imageId;
      img.hidden = false;
      btn.querySelector(".spin-btn-default").style.display = "none";
      btn.classList.add("has-image");
    } else {
      img.hidden = true;
      btn.querySelector(".spin-btn-default").style.display = "";
      btn.classList.remove("has-image");
    }
  }

  // ---------- Quay ----------
  $("spin-btn").addEventListener("click", spin);

  function spin() {
    if (spinning) return;
    const names = readNames();
    if (!names.length) {
      $("names-input").focus();
      return;
    }
    if (document.activeElement === $("names-input")) $("names-input").blur();
    setNames(names, false);
    clearResult();
    const n = slices.length;
    const step = 360 / n;
    const index = randomInt(n);
    // Dừng ở vị trí ngẫu nhiên trong ô (không sát mép) cho tự nhiên
    const offset = (Math.random() - 0.5) * step * 0.7;
    const target = 360 - (index * step + step / 2 + offset);
    const current = ((rotation % 360) + 360) % 360;
    rotation += 360 * 6 + ((target - current + 360) % 360);

    spinning = true;
    document.body.classList.add("spinning");
    prepareAudio();
    if (!prefs.muted) {
      spinAudio.currentTime = 0;
      spinAudio.volume = 0.8;
      spinAudio.play().catch(() => {});
      // "Mở khoá" âm thanh chiến thắng trên iOS bằng thao tác chạm hiện tại
      winAudio.muted = true;
      winAudio.play().then(() => { winAudio.pause(); winAudio.currentTime = 0; winAudio.muted = false; }).catch(() => { winAudio.muted = false; });
    }

    // Xoay nhóm hình bên trong SVG (không xoay cả khung -> trang không bị tràn ngang)
    const rot = $("wheel-rot");
    rot.style.transition = "none";
    void rot.getBoundingClientRect(); // để trình duyệt ghi nhận góc hiện tại trước khi chạy hiệu ứng
    requestAnimationFrame(() => {
      rot.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.18, 1)`;
      rot.style.transform = `rotate(${rotation}deg)`;
    });

    // Giảm dần âm lượng ở giây cuối
    const fadeStart = SPIN_MS - 1200;
    setTimeout(() => {
      if (!spinAudio || spinAudio.paused) return;
      const v0 = spinAudio.volume;
      const t0 = performance.now();
      const fade = () => {
        const k = Math.min(1, (performance.now() - t0) / 1200);
        spinAudio.volume = Math.max(0, v0 * (1 - k));
        if (k < 1) requestAnimationFrame(fade);
        else spinAudio.pause();
      };
      requestAnimationFrame(fade);
    }, fadeStart);

    setTimeout(() => {
      spinning = false;
      document.body.classList.remove("spinning");
      showResult(index);
    }, SPIN_MS + 150);
  }

  // Kết quả: làm mờ các ô khác, ô trúng nhấp nháy nhẹ, thẻ tên dưới tâm vòng quay
  function showResult(index) {
    const slice = slices[index];
    lastWinner = index;
    const svg = $("wheel-svg");
    svg.classList.add("has-result");
    svg.querySelectorAll(".slice").forEach((g) => g.classList.toggle("win", Number(g.dataset.i) === index));
    const card = $("result");
    $("result-name").textContent = slice.name;
    $("result-name").style.background = slice.color;
    $("result-name").style.color = slice.text;
    card.style.borderColor = slice.text;
    card.hidden = false;
    if (!prefs.muted && winAudio) {
      winAudio.currentTime = 0;
      winAudio.volume = 0.8;
      winAudio.play().catch(() => {});
    }
  }

  function clearResult() {
    lastWinner = null;
    $("result").hidden = true;
    const svg = $("wheel-svg");
    svg.classList.remove("has-result");
    svg.querySelectorAll(".slice.win").forEach((g) => g.classList.remove("win"));
  }

  $("result-remove").addEventListener("click", () => {
    if (lastWinner === null) return;
    const names = prefs.names.slice();
    names.splice(lastWinner, 1);
    setNames(names);
  });
  $("result-close").addEventListener("click", clearResult);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearResult();
  });

  // ---------- Toàn màn hình ----------
  const canFullscreen = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
  if (!canFullscreen) $("btn-fullscreen").style.display = "none";
  $("btn-fullscreen").addEventListener("click", () => {
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    else (doc.documentElement.requestFullscreen || doc.documentElement.webkitRequestFullscreen).call(doc.documentElement);
  });
  document.addEventListener("fullscreenchange", () => {
    $("btn-fullscreen").innerHTML = document.fullscreenElement ? '<i class="li icon-minimize"></i>' : '<i class="li icon-maximize"></i>';
  });

  // ---------- Khởi động ----------
  setNames(prefs.names);
  renderMute();
  renderSoundSelect();
  renderBgSelect();
  fetch("/api/party")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((c) => {
      config = c;
      renderSoundSelect();
      renderBgSelect();
      renderButton();
    })
    .catch(() => {}); // không có mạng / máy chủ: vẫn chơi được với âm thanh & nền mặc định
})();
