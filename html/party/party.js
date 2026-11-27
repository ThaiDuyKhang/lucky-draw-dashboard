// Vòng quay Party: chơi nhanh trên điện thoại, không cần đăng nhập.
// Tên, tuỳ chỉnh, âm thanh, hình nền lưu trên máy (localStorage); âm thanh / hình nền /
// nút quay do admin cài sẵn trong Dashboard > tab Party. Mọi chuyển động dùng GSAP.
(function () {
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = "party_v1";
  const BUILTIN_SOUND = { id: "builtin", name: "Mặc định", spinUrl: "/sound/am-thanh-vong-quay.mp3", winUrl: "/sound/am-thanh-chien-thang.mp3" };

  const SAMPLES = {
    names: ["An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khoa", "Linh", "Minh", "Ngọc"],
    party: [
      "Uống 1 ly", "Oẳn tù tì bên trái", "Uống 2 ly", "50/50 người bên cạnh", "Hát 2 câu chữ B",
      "Qua lượt an toàn", "Chỉ định 1 người", "Cả bàn cùng uống", "Kể chuyện xấu hổ", "Nhảy 10 giây",
      "Người bên phải uống", "Miễn uống 1 lượt",
    ],
    yesno: ["Có", "Không", "Có", "Không", "Để sau", "Chắc chắn rồi"],
  };

  const DEFAULTS = {
    title: "Vòng Quay May Mắn",
    buttonText: "Nhấn để xoay",
    duration: 6, // giây
    speed: 5, // 1-10
    blink: 6, // 0-10 (0 = không chớp)
    autoRemove: false,
  };

  // Màu pastel đậm (nền ô, chữ)
  const PALETTE = [
    ["#9fcdf5", "#1d4a73"], ["#5fe1f2", "#0b5058"], ["#9ad59d", "#1f5523"], ["#e6ee9c", "#57600f"],
    ["#fddc84", "#6b4a00"], ["#ffb69e", "#7a2e16"], ["#f594b2", "#7a1636"], ["#ae91dc", "#3b1f6b"],
  ];

  // ---------- Trạng thái ----------
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch (e) {}
  const prefs = {
    names: Array.isArray(saved.names) ? saved.names : SAMPLES.names.slice(0, 8),
    soundId: saved.soundId || null,
    bgId: saved.bgId ?? null,
    muted: !!saved.muted,
    settings: Object.assign({}, DEFAULTS, saved.settings || {}),
  };
  let config = { sounds: [], backgrounds: [], button: null };
  let slices = [];
  const wheelState = { deg: 0 }; // góc hiện tại của vòng quay
  let spinning = false;
  let lastWinner = null;
  let spinAudio = null;
  let winAudio = null;
  let blinkTweens = [];

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

  // ---------- Tiêu đề ----------
  function renderTitle() {
    const words = (prefs.settings.title || DEFAULTS.title).trim().split(/\s+/);
    const cut = words.length >= 3 ? words.length - 2 : words.length === 2 ? 1 : words.length;
    const t1 = words.slice(0, cut).join(" ");
    const t2 = words.slice(cut).join(" ");
    $("party-title-text").innerHTML = `<span class="t1">${esc(t1)}</span>${t2 ? ` <span class="t2">${esc(t2)}</span>` : ""}`;
  }

  // ---------- Nút quay: chữ luôn nằm giữa vòng tròn ----------
  function renderButtonText() {
    const text = (prefs.settings.buttonText || DEFAULTS.buttonText).trim() || DEFAULTS.buttonText;
    $("spin-btn").setAttribute("aria-label", text);
    // Ngắt dòng theo từ, tối đa ~9 ký tự/dòng, tối đa 3 dòng
    const words = text.split(/\s+/);
    const lines = [];
    for (const w of words) {
      const last = lines[lines.length - 1];
      if (last && (last + " " + w).length <= 9) lines[lines.length - 1] = last + " " + w;
      else lines.push(w);
    }
    while (lines.length > 3) lines.splice(1, 2, lines[1] + " " + lines[2]);
    const longest = Math.max(...lines.map((l) => l.length), 3);
    const size = Math.min(40, 136 / (longest * 0.56), 128 / (lines.length * 1.08));
    const lineHeight = size * 1.08;
    const first = 150 - ((lines.length - 1) * lineHeight) / 2; // tâm vòng tròn: (100, 150)
    $("spin-btn-text").setAttribute("font-size", size.toFixed(1));
    $("spin-btn-text").innerHTML = lines
      .map((l, i) => `<tspan x="100" y="${(first + i * lineHeight).toFixed(1)}" dominant-baseline="central">${esc(l)}</tspan>`)
      .join("");
  }

  // ---------- Vẽ vòng quay ----------
  function colorsFor(n) {
    const idx = [];
    for (let i = 0; i < n; i++) {
      let c = i % PALETTE.length;
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
    slices = names.map((name) => ({ name }));
    if (n === 0) {
      svg.innerHTML = `<g id="wheel-rot"><circle cx="${C}" cy="${C}" r="${R}" fill="#f1eefa" stroke="#e2dcf3" stroke-width="${RIM}"/>
        <text x="${C}" y="${C + 230}" fill="#8b84a8" font-size="40" text-anchor="middle">Thêm tên để bắt đầu</text></g>`;
      gsap.set("#wheel-rot", { rotation: wheelState.deg, svgOrigin: "500 500" });
      return;
    }
    const colors = colorsFor(n);
    const step = 360 / n;
    // Cỡ chữ: vừa độ dài bán kính (trừ phần nút ở giữa) và vừa bề ngang ô
    const textSpace = R - RIM - 18 - 130;
    const longest = Math.max(...names.map((x) => x.length), 3);
    const arcLimit = (2 * Math.PI * (R * 0.62)) / n;
    const fontSize = Math.max(16, Math.min(54, textSpace / (longest * 0.52), arcLimit * 0.62));
    const maxChars = Math.max(4, Math.floor(textSpace / (fontSize * 0.5)));
    let html = "";
    names.forEach((name, i) => {
      const [bg, fg] = colors[i];
      slices[i].color = bg;
      slices[i].text = fg;
      const a1 = (i * step - 90) * (Math.PI / 180);
      const a2 = ((i + 1) * step - 90) * (Math.PI / 180);
      const large = step > 180 ? 1 : 0;
      const p = (r, a) => `${C + r * Math.cos(a)},${C + r * Math.sin(a)}`;
      html += `<g class="slice" data-i="${i}">`;
      if (n === 1) {
        html += `<circle cx="${C}" cy="${C}" r="${R}" fill="${bg}"/>`;
        html += `<circle cx="${C}" cy="${C}" r="${R - RIM / 2}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="${RIM}"/>`;
      } else {
        html += `<path d="M${C},${C} L${p(R, a1)} A${R},${R} 0 ${large} 1 ${p(R, a2)} Z" fill="${bg}"/>`;
        html += `<path d="M${p(R, a1)} A${R},${R} 0 ${large} 1 ${p(R, a2)} L${p(R - RIM, a2)} A${R - RIM},${R - RIM} 0 ${large} 0 ${p(R - RIM, a1)} Z" fill="#fff" fill-opacity=".45"/>`;
      }
      const mid = i * step + step / 2;
      const label = name.length > maxChars ? name.slice(0, maxChars - 1) + "…" : name;
      const tx = C + (R - RIM - 18) * Math.cos((mid - 90) * (Math.PI / 180));
      const ty = C + (R - RIM - 18) * Math.sin((mid - 90) * (Math.PI / 180));
      html += `<text x="${tx}" y="${ty}" fill="${fg}" font-size="${fontSize.toFixed(1)}" text-anchor="start" dominant-baseline="central" transform="rotate(${mid + 90}, ${tx}, ${ty})">${esc(label)}</text>`;
      html += `</g>`;
    });
    svg.innerHTML = `<g id="wheel-rot">${html}</g>`;
    gsap.set("#wheel-rot", { rotation: wheelState.deg, svgOrigin: "500 500" });
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

  document.querySelectorAll("[data-sample]").forEach((btn) =>
    btn.addEventListener("click", () => {
      setNames(SAMPLES[btn.dataset.sample].slice());
      popWheel();
    })
  );

  $("btn-clear").addEventListener("click", () => {
    if (!prefs.names.length || confirm("Xoá hết tên trong danh sách?")) setNames([]);
  });

  function popWheel() {
    gsap.fromTo("#wheel-svg", { scale: 0.92, autoAlpha: 0.5 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: "back.out(2)", transformOrigin: "50% 50%" });
  }

  $("btn-shuffle").addEventListener("click", () => {
    if (spinning || prefs.names.length < 2) return;
    const arr = prefs.names.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // Xoay nhanh nửa vòng rồi đổi vị trí các ô
    gsap.timeline()
      .to("#wheel-svg", { scale: 0.9, rotation: "+=25", duration: 0.18, ease: "power2.in", transformOrigin: "50% 50%" })
      .add(() => setNames(arr))
      .to("#wheel-svg", { scale: 1, rotation: 0, duration: 0.45, ease: "back.out(2.2)" });
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
    sel.innerHTML = [BUILTIN_SOUND, ...config.sounds].map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
    sel.value = currentSound().id;
  }

  $("sound-select").addEventListener("change", (e) => {
    prefs.soundId = e.target.value;
    persist();
    prepareAudio();
    if (!prefs.muted && !spinning) {
      spinAudio.currentTime = 0;
      spinAudio.volume = 0.8;
      spinAudio.play().catch(() => {});
      gsap.delayedCall(1.5, () => !spinning && spinAudio.pause());
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
    const custom = config.button && config.button.imageId;
    img.hidden = !custom;
    $("spin-btn-default").style.display = custom ? "none" : "";
    btn.classList.toggle("has-image", !!custom);
    if (custom) img.src = "/api/image/" + config.button.imageId;
    // Tâm hình tròn của nút trùng tâm vòng quay (giọt nước: tâm ở 60% chiều cao)
    gsap.set(btn, { xPercent: -50, yPercent: custom ? -50 : -60 });
  }

  const btnInner = () => (config.button && config.button.imageId ? $("spin-btn-image") : $("spin-btn-default"));

  $("spin-btn").addEventListener("pointerdown", () => gsap.to(btnInner(), { scale: 0.92, duration: 0.12, transformOrigin: "50% 60%" }));
  ["pointerup", "pointerleave"].forEach((ev) =>
    $("spin-btn").addEventListener(ev, () => gsap.to(btnInner(), { scale: 1, duration: 0.25, ease: "power2.out" }))
  );

  // ---------- Quay ----------
  $("spin-btn").addEventListener("click", spin);

  function spin() {
    if (spinning) return;
    // Tự xoá ô vừa trúng trước lượt mới (nếu bật)
    if (prefs.settings.autoRemove && lastWinner !== null && prefs.names[lastWinner] !== undefined) {
      const rest = prefs.names.slice();
      rest.splice(lastWinner, 1);
      setNames(rest);
    }
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
    const duration = Math.min(30, Math.max(2, Number(prefs.settings.duration) || DEFAULTS.duration));
    const turns = spinTurns(duration, prefs.settings.speed);
    // Dừng ở vị trí ngẫu nhiên trong ô (không sát mép) cho tự nhiên
    const offset = (Math.random() - 0.5) * step * 0.7;
    const target = 360 - (index * step + step / 2 + offset);
    const current = ((wheelState.deg % 360) + 360) % 360;
    const end = wheelState.deg + turns * 360 + ((target - current + 360) % 360);

    spinning = true;
    document.body.classList.add("spinning");
    prepareAudio();
    if (!prefs.muted) {
      gsap.killTweensOf(spinAudio);
      spinAudio.currentTime = 0;
      spinAudio.volume = 0.8;
      spinAudio.play().catch(() => {});
      // "Mở khoá" âm thanh kết quả trên iOS bằng thao tác chạm hiện tại
      winAudio.muted = true;
      winAudio.play().then(() => { winAudio.pause(); winAudio.currentTime = 0; winAudio.muted = false; }).catch(() => { winAudio.muted = false; });
      // Nhỏ dần ở 1.2 giây cuối
      gsap.to(spinAudio, { volume: 0, duration: Math.min(1.2, duration / 2), delay: Math.max(0, duration - 1.2), ease: "none", onComplete: () => spinAudio.pause() });
    }

    const rot = $("wheel-rot");
    gsap.to(wheelState, {
      deg: end,
      duration,
      ease: "power4.out",
      onUpdate() {
        gsap.set(rot, { rotation: wheelState.deg, svgOrigin: "500 500" });
      },
      onComplete() {
        wheelState.deg = end;
        spinning = false;
        document.body.classList.remove("spinning");
        showResult(index);
      },
    });
  }

  // Tốc độ 1-10 -> số vòng quay trung bình mỗi giây
  function spinTurns(duration, speed) {
    const rps = 0.25 + (Number(speed) || DEFAULTS.speed) * 0.22;
    return Math.max(2, Math.round(rps * duration));
  }

  // Tốc độ chớp 0-10 -> thời gian 1 lần chớp (giây); 0 = không chớp
  function blinkPeriod(level) {
    level = Number(level);
    return level <= 0 ? 0 : 1.6 - (level - 1) * 0.155; // 1.6s ... 0.2s
  }

  function startBlink(targets) {
    const period = blinkPeriod(prefs.settings.blink);
    if (!period) return null;
    return gsap.to(targets, { opacity: 0.25, duration: period / 2, repeat: -1, yoyo: true, ease: "sine.inOut" });
  }

  // Kết quả: các ô khác mờ đi, ô trúng + tên chớp ngay, thẻ tên bật lên dưới tâm
  function showResult(index) {
    const slice = slices[index];
    lastWinner = index;
    const svg = $("wheel-svg");
    const all = svg.querySelectorAll(".slice");
    const win = svg.querySelector(`.slice[data-i="${index}"]`);
    gsap.to([...all].filter((g) => g !== win), { opacity: 0.25, duration: 0.35, ease: "power1.out" });

    const card = $("result");
    const nameEl = $("result-name");
    nameEl.textContent = slice.name;
    nameEl.style.background = slice.color;
    nameEl.style.color = slice.text;
    card.style.borderColor = slice.text;
    card.hidden = false;
    gsap.fromTo(card, { xPercent: -50, y: 24, scale: 0.6, autoAlpha: 0 }, { xPercent: -50, y: 0, scale: 1, autoAlpha: 1, duration: 0.45, ease: "back.out(2.2)" });

    blinkTweens = [startBlink(win), startBlink(nameEl)].filter(Boolean);

    if (!prefs.muted && winAudio) {
      winAudio.currentTime = 0;
      winAudio.volume = 0.8;
      winAudio.play().catch(() => {});
    }
  }

  function clearResult() {
    blinkTweens.forEach((t) => t.kill());
    blinkTweens = [];
    const card = $("result");
    if (!card.hidden) {
      gsap.killTweensOf(card);
      card.hidden = true;
    }
    gsap.set("#result-name", { opacity: 1 });
    const slicesEls = $("wheel-svg").querySelectorAll(".slice");
    gsap.killTweensOf(slicesEls);
    gsap.to(slicesEls, { opacity: 1, duration: 0.25 });
  }

  $("result-remove").addEventListener("click", () => {
    if (lastWinner === null) return;
    const names = prefs.names.slice();
    names.splice(lastWinner, 1);
    lastWinner = null;
    setNames(names);
  });
  $("result-close").addEventListener("click", () => {
    lastWinner = prefs.settings.autoRemove ? lastWinner : null;
    clearResult();
  });

  // ---------- Bảng tuỳ chỉnh ----------
  const sheet = $("settings");
  const scrim = $("sheet-scrim");
  let demoBlink = null;
  const isBottomSheet = () => window.matchMedia("(max-width: 1000px)").matches;

  function openSettings() {
    fillSettings();
    sheet.hidden = false;
    scrim.hidden = false;
    gsap.fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 });
    gsap.fromTo(sheet, isBottomSheet() ? { yPercent: 100, xPercent: 0 } : { xPercent: 100, yPercent: 0 }, { xPercent: 0, yPercent: 0, duration: 0.45, ease: "power3.out" });
    gsap.from(".sheet .field", { y: 12, autoAlpha: 0, duration: 0.35, stagger: 0.05, delay: 0.1, ease: "power2.out", clearProps: "all" });
    restartDemoBlink();
  }

  function closeSettings() {
    if (demoBlink) demoBlink.kill();
    gsap.to(scrim, { autoAlpha: 0, duration: 0.2, onComplete: () => (scrim.hidden = true) });
    gsap.to(sheet, {
      ...(isBottomSheet() ? { yPercent: 100 } : { xPercent: 100 }),
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => (sheet.hidden = true),
    });
  }

  $("btn-settings").addEventListener("click", openSettings);
  $("settings-close").addEventListener("click", closeSettings);
  $("settings-done").addEventListener("click", closeSettings);
  scrim.addEventListener("click", closeSettings);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!sheet.hidden) closeSettings();
    else clearResult();
  });

  function setSlider(id, value) {
    const el = $(id);
    el.value = value;
    const pct = ((value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty("--fill", pct + "%");
    $(id + "-num").value = value;
  }

  function fillSettings() {
    const s = prefs.settings;
    $("set-title").value = s.title;
    $("set-button").value = s.buttonText;
    setSlider("set-duration", s.duration);
    setSlider("set-speed", s.speed);
    setSlider("set-blink", s.blink);
    $("set-autoremove").checked = !!s.autoRemove;
    renderSpeedHint();
    document.querySelectorAll("[data-button-text]").forEach((c) => c.classList.toggle("selected", c.dataset.buttonText === s.buttonText));
  }

  function renderSpeedHint() {
    const s = prefs.settings;
    $("speed-turns").textContent = `≈ ${spinTurns(s.duration, s.speed)} vòng / lượt`;
  }

  function restartDemoBlink() {
    if (demoBlink) demoBlink.kill();
    gsap.set("#blink-demo", { opacity: 1 });
    demoBlink = startBlink("#blink-demo");
  }

  function updateSetting(key, value) {
    prefs.settings[key] = value;
    persist();
    if (key === "title") renderTitle();
    if (key === "buttonText") {
      renderButtonText();
      document.querySelectorAll("[data-button-text]").forEach((c) => c.classList.toggle("selected", c.dataset.buttonText === value));
    }
    if (key === "duration" || key === "speed") renderSpeedHint();
    if (key === "blink") {
      restartDemoBlink();
      if (blinkTweens.length) {
        // đang hiện kết quả: áp dụng tốc độ chớp mới ngay
        const win = $("wheel-svg").querySelector(".slice[data-i='" + lastWinner + "']");
        blinkTweens.forEach((t) => t.kill());
        gsap.set([win, $("result-name")], { opacity: 1 });
        blinkTweens = [startBlink(win), startBlink($("result-name"))].filter(Boolean);
      }
    }
  }

  $("set-title").addEventListener("input", (e) => updateSetting("title", e.target.value.trim() || DEFAULTS.title));
  $("set-button").addEventListener("input", (e) => updateSetting("buttonText", e.target.value.trim() || DEFAULTS.buttonText));
  document.querySelectorAll("[data-button-text]").forEach((chip) =>
    chip.addEventListener("click", () => {
      $("set-button").value = chip.dataset.buttonText;
      updateSetting("buttonText", chip.dataset.buttonText);
    })
  );

  // Thanh trượt <-> ô số
  [["set-duration", "duration"], ["set-speed", "speed"], ["set-blink", "blink"]].forEach(([id, key]) => {
    const slider = $(id);
    const num = $(id + "-num");
    slider.addEventListener("input", () => {
      setSlider(id, Number(slider.value));
      updateSetting(key, Number(slider.value));
    });
    num.addEventListener("change", () => {
      let v = Number(num.value);
      if (!isFinite(v)) v = DEFAULTS[key];
      v = Math.min(Number(slider.max), Math.max(Number(slider.min), v));
      setSlider(id, v);
      updateSetting(key, v);
    });
  });

  $("set-autoremove").addEventListener("change", (e) => updateSetting("autoRemove", e.target.checked));

  $("settings-reset").addEventListener("click", () => {
    prefs.settings = Object.assign({}, DEFAULTS);
    persist();
    fillSettings();
    renderTitle();
    renderButtonText();
    restartDemoBlink();
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
  renderTitle();
  renderButtonText();
  renderButton();
  setNames(prefs.names);
  renderMute();
  renderSoundSelect();
  renderBgSelect();

  // Hiệu ứng xuất hiện
  document.fonts && document.fonts.ready.then(() => {
    gsap.from(".party-title-text > span", { y: -40, scale: 0.6, autoAlpha: 0, duration: 0.7, stagger: 0.12, ease: "back.out(2.5)" });
  });
  gsap.from("#wheel-svg", { scale: 0.85, rotation: -40, autoAlpha: 0, duration: 0.9, ease: "back.out(1.6)", transformOrigin: "50% 50%" });
  gsap.from("#spin-btn", { scale: 0, duration: 0.6, delay: 0.35, ease: "back.out(3)" });
  gsap.from(".party-toolbar > *, .names-panel", { y: 20, autoAlpha: 0, duration: 0.5, stagger: 0.06, delay: 0.2, ease: "power2.out", clearProps: "transform,opacity,visibility" });

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
