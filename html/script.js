$(document).ready(function () {
  // ==================== CONFIGURATION ====================

  const CONFIG = {
    AUDIO: {
      SPIN_SOUND: "./sound/am-thanh-vong-quay.mp3",
      VICTORY_SOUND: "./sound/am-thanh-chien-thang.mp3",
      SPIN_VOLUME: 0.7,
      VICTORY_VOLUME: 0.8,
    },

    TIMING: {
      SPIN_DURATION: 20000, // 20000
      FADE_OUT_START: 18000, //18000
      FADE_OUT_DURATION: 2000,
      MODAL_DELAY: 2000, // 2000
      EXTRA_SPINS: 3,
      EASING: "cubic-bezier(0.17, 0.67, 0.35, 0.96)",
    },

    WHEEL: {
      CENTER_X: 250,
      CENTER_Y: 250,
      RADIUS: 240,
      // Màu mặc định; màu chọn trong Dashboard > Giao diện (theme.js) được ưu tiên
      COLORS: {
        LIGHT: "#f3ffe1",
        DARK: "#246d4b",
      },
      TEXT: {
        SIZE: 15,
        MAX_LENGTH: 12,
        TRUNCATE_LENGTH: 10,
      },
    },

    ANIMATION: {
      STAR_COUNT: 15,
      CONFETTI_COUNT: 50,
      STAR_COLORS: ["#ffd700", "#ffeb3b", "#fff59d", "#fff176", "#ffee58"],
      CONFETTI_COLORS: [
        "#ff6b6b",
        "#4ecdc4",
        "#45b7d1",
        "#f9ca24",
        "#f0932b",
        "#eb4d4b",
        "#6c5ce7",
      ],
    },
  };

  // State

  const Api = window.LuckyApi;
  let state = null; // dữ liệu admin từ máy chủ
  let segments = [];
  let totalSegments = 0;
  let selectedWinner = null; // { name, prize, ... } của lượt quay hiện tại
  let isSpinning = false;
  let pendingRefresh = false;
  let starsAnimation = null;
  let currentSplitText = null;

  // Initialization

  refreshState(true);
  Api.live(() => refreshState(false));

  async function refreshState(first) {
    if (isSpinning) {
      pendingRefresh = true; // đang quay: cập nhật sau khi quay xong
      return;
    }
    try {
      const next = await Api.adminState();
      const prevKey = state ? activeKey(state) : "";
      const prevColors = state ? JSON.stringify(state.theme.colors) : "";
      state = next;
      Api.applyTheme(state.theme);
      renderPrizeBar();
      if ($("#winnersModal").hasClass("show")) renderWinnersModal();
      if (first || activeKey(state) !== prevKey) initializeWheel();
      else if (JSON.stringify(state.theme.colors) !== prevColors) drawWheel(segments);
    } catch (e) {
      document.documentElement.classList.add("theme-ready");
      if (first) showWheelMessage(e.message);
      else console.warn(e);
    }
  }

  // "Chữ ký" danh sách đang quay: chỉ vẽ lại vòng quay khi danh sách thay đổi
  function activeKey(s) {
    return s.participants
      .filter((p) => p.status === "active")
      .map((p) => p.id + ":" + p.name)
      .sort()
      .join("|");
  }

  function currentPrize() {
    return state && state.prizes.find((p) => p.id === state.currentPrizeId);
  }

  // Thanh giải thưởng đang quay (chọn giải ngay trên màn hình quay)
  function renderPrizeBar() {
    const bar = $("#prize-bar");
    if (!state || state.prizes.length === 0) {
      bar.addClass("d-none");
      return;
    }
    bar.removeClass("d-none");
    const select = $("#prize-select").empty();
    state.prizes.forEach((p) => {
      const left = p.remaining === null ? "" : ` (còn ${p.remaining}/${p.quantity})`;
      select.append($("<option>").val(p.id).text(p.name + left));
    });
    select.val(state.currentPrizeId || "");
    const prize = currentPrize();
    const img = $("#prize-bar-image");
    if (prize && prize.imageId) img.attr("src", Api.imageUrl(prize.imageId)).removeClass("d-none");
    else img.addClass("d-none");
  }

  $("#prize-select").on("change", async function () {
    try {
      const res = await Api.action("setCurrentPrize", { id: $(this).val() });
      state = res.state;
      renderPrizeBar();
    } catch (e) {
      showToast(e.message);
    }
  });

  // ----- Modal danh sách trúng thưởng (chỉ người đã công bố, chưa huỷ) -----
  $(document).on("click", ".open-winners", function () {
    const congrats = bootstrap.Modal.getInstance(document.getElementById("congratsModal"));
    if (congrats && $("#congratsModal").hasClass("show")) {
      $("#congratsModal").one("hidden.bs.modal", openWinnersModal);
      congrats.hide();
    } else {
      openWinnersModal();
    }
  });

  async function openWinnersModal() {
    if (!isSpinning) {
      try {
        state = await Api.adminState();
      } catch (e) {}
    }
    renderWinnersModal();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("winnersModal")).show();
  }

  function renderWinnersModal() {
    const now = Date.now();
    const winners = (state ? state.winners : [])
      .filter((w) => w.status !== "cancelled" && (w.revealAt || 0) <= now)
      .sort((a, b) => a.wonAt - b.wonAt);
    $("#winners-modal-count").text(winners.length);
    if (!winners.length) {
      $("#winners-modal-body").html('<div class="text-center text-muted py-5">Chưa có người trúng thưởng</div>');
      return;
    }
    const item = (w, i) => `<li><span class="num">${i + 1}</span><span>${escapeHtml(w.name)}</span></li>`;
    const group = (title, imageId, list) => `
      <div class="winners-prize">
        ${title !== null ? `<div class="winners-prize-header">
          ${imageId ? `<img src="${Api.imageUrl(imageId)}" alt="">` : '<i class="li icon-gift"></i>'}
          <div class="winners-prize-name">${escapeHtml(title)}</div>
          <span class="text-muted fw-semibold">${list.length}</span>
        </div>` : ""}
        <ol class="winners-grid">${list.map(item).join("")}</ol>
      </div>`;
    let html = "";
    const prizeIds = new Set();
    state.prizes.forEach((p) => {
      prizeIds.add(p.id);
      const list = winners.filter((w) => w.prizeId === p.id);
      if (list.length) html += group(p.name, p.imageId, list);
    });
    // Người trúng giải đã bị xoá: nhóm theo tên giải lúc trúng
    const orphan = {};
    winners
      .filter((w) => w.prizeId && !prizeIds.has(w.prizeId))
      .forEach((w) => (orphan[w.prize.name] = orphan[w.prize.name] || { img: w.prize.imageId, list: [] }).list.push(w));
    Object.keys(orphan).forEach((name) => (html += group(name, orphan[name].img, orphan[name].list)));
    const noPrize = winners.filter((w) => !w.prizeId);
    if (noPrize.length) html += group(html ? "Không gắn giải" : null, null, noPrize);
    $("#winners-modal-body").html(html);
  }

  function showToast(message) {
    const t = $('<div class="wheel-toast"></div>').text(message).appendTo("body");
    setTimeout(() => t.fadeOut(400, () => t.remove()), 4000);
  }

  function showWheelMessage(message) {
    $(".wheel").html(
      `<text x="250" y="250" fill="#c62828" font-size="16" text-anchor="middle" dominant-baseline="middle">${escapeHtml(message)}</text>`
    );
  }

  // Event handlers

  $("#ez-spin-btn").click(async function () {
    if (isSpinning || !state) return;

    if (!state.participants.some((p) => p.status === "active")) {
      showToast("Chưa có người tham dự! Vui lòng thêm người tham dự trong Dashboard.");
      return;
    }
    const prize = currentPrize();
    if (prize && prize.remaining === 0) {
      showToast(`Giải "${prize.name}" đã hết. Hãy chọn giải khác.`);
      return;
    }

    isSpinning = true; // khoá nút ngay để tránh bấm 2 lần
    try {
      const res = await Api.action("spin", {
        prizeId: state.currentPrizeId,
        revealDelayMs: CONFIG.TIMING.SPIN_DURATION + CONFIG.TIMING.MODAL_DELAY,
      });
      performSpin(res.winner);
      state = res.state; // vòng quay giữ nguyên các ô cho tới khi quay xong
    } catch (e) {
      isSpinning = false;
      showToast(e.message);
    }
  });

  // Audio

  function playSpinSound() {
    const sound = new Audio(CONFIG.AUDIO.SPIN_SOUND);
    sound.volume = CONFIG.AUDIO.SPIN_VOLUME;
    sound.play().catch((err) => console.log("Audio play failed:", err));

    // Fade out in last 2 seconds
    setTimeout(() => {
      fadeOutAudio(sound, CONFIG.TIMING.FADE_OUT_DURATION);
    }, CONFIG.TIMING.FADE_OUT_START);

    return sound;
  }

  function playVictorySound() {
    const sound = new Audio(CONFIG.AUDIO.VICTORY_SOUND);
    sound.volume = CONFIG.AUDIO.VICTORY_VOLUME;
    sound.play().catch((err) => console.log("Victory audio play failed:", err));
  }

  function fadeOutAudio(audio, duration) {
    const interval = 50;
    const volumeStep = audio.volume / (duration / interval);

    const fadeOut = setInterval(() => {
      if (audio.volume > volumeStep) {
        audio.volume -= volumeStep;
      } else {
        audio.volume = 0;
        audio.pause();
        audio.currentTime = 0;
        clearInterval(fadeOut);
      }
    }, interval);
  }

  // Số ngẫu nhiên nguyên trong [0, max) - ưu tiên crypto.getRandomValues
  function randomInt(max) {
    if (window.crypto && window.crypto.getRandomValues) {
      const limit = Math.floor(0x100000000 / max) * max; // tránh lệch modulo
      const buf = new Uint32Array(1);
      do {
        window.crypto.getRandomValues(buf);
      } while (buf[0] >= limit);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  // Utility function: Fisher-Yates shuffle algorithm
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Vòng quay

  function initializeWheel() {
    const activeParticipants = state.participants.filter(
      (p) => p.status === "active"
    );

    // Shuffle người tham dự để tăng tính ngẫu nhiên
    const shuffledParticipants = shuffleArray(activeParticipants);

    segments = [];
    shuffledParticipants.forEach((participant, index) => {
      segments.push({
        name: participant.name,
        id: participant.id,
        type: index % 2 === 0 ? 1 : 2, // ô lẻ / ô chẵn -> màu lấy từ theme
      });
    });

    totalSegments = segments.length;

    if (segments.length > 0) {
      drawWheel(segments);
    } else {
      const svg = $(".wheel");
      svg.html(
        `<text x="${CONFIG.WHEEL.CENTER_X}" y="${CONFIG.WHEEL.CENTER_Y}" fill="${getWheelColors().center}" font-size="20" text-anchor="middle" dominant-baseline="middle">Chưa có người tham dự</text>`
      );
    }
  }

  function getWheelColors() {
    return Api.colors(state && state.theme);
  }

  function drawWheel(segments) {
    const svg = $(".wheel");
    const colors = getWheelColors();
    const anglePerSegment = 360 / segments.length;
    let svgContent = "";

    segments.forEach((segment, index) => {
      const startAngle = index * anglePerSegment;
      const endAngle = (index + 1) * anglePerSegment;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 =
        CONFIG.WHEEL.CENTER_X + CONFIG.WHEEL.RADIUS * Math.cos(startRad);
      const y1 =
        CONFIG.WHEEL.CENTER_Y + CONFIG.WHEEL.RADIUS * Math.sin(startRad);
      const x2 = CONFIG.WHEEL.CENTER_X + CONFIG.WHEEL.RADIUS * Math.cos(endRad);
      const y2 = CONFIG.WHEEL.CENTER_Y + CONFIG.WHEEL.RADIUS * Math.sin(endRad);

      const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

      const pathData = [
        `M ${CONFIG.WHEEL.CENTER_X},${CONFIG.WHEEL.CENTER_Y}`,
        `L ${x1},${y1}`,
        `A ${CONFIG.WHEEL.RADIUS},${CONFIG.WHEEL.RADIUS} 0 ${largeArcFlag} 1 ${x2},${y2}`,
        "Z",
      ].join(" ");

      const fillColor = segment.type === 1 ? colors.segment1 : colors.segment2;

      // Chỉ có 1 người: cung tròn 360° không vẽ được bằng path -> vẽ hình tròn
      svgContent +=
        segments.length === 1
          ? `<circle cx="${CONFIG.WHEEL.CENTER_X}" cy="${CONFIG.WHEEL.CENTER_Y}" r="${CONFIG.WHEEL.RADIUS}" fill="${fillColor}" />`
          : `<path d="${pathData}" fill="${fillColor}" />`;

      const textAngle = startAngle + anglePerSegment / 2;
      const textRad = ((textAngle - 90) * Math.PI) / 180;
      const textX =
        CONFIG.WHEEL.CENTER_X + CONFIG.WHEEL.RADIUS * 0.7 * Math.cos(textRad);
      const textY =
        CONFIG.WHEEL.CENTER_Y + CONFIG.WHEEL.RADIUS * 0.7 * Math.sin(textRad);

      const textColor = segment.type === 1 ? colors.text1 : colors.text2;

      let displayName = segment.name;
      if (displayName.length > CONFIG.WHEEL.TEXT.MAX_LENGTH) {
        displayName =
          displayName.substring(0, CONFIG.WHEEL.TEXT.TRUNCATE_LENGTH) + "...";
      }

      svgContent += `
        <text 
          x="${textX}" 
          y="${textY}" 
          fill="${textColor}" 
          font-size="${CONFIG.WHEEL.TEXT.SIZE}" 
          font-weight="600" 
          text-anchor="middle"
          dominant-baseline="middle"
          transform="rotate(${textAngle + 90}, ${textX}, ${textY})"
          style="text-shadow: 1px 1px 2px rgba(0,0,0,0.3);"
        >
          ${escapeHtml(displayName)}
        </text>
      `;
    });

    svgContent += `<circle cx="${CONFIG.WHEEL.CENTER_X}" cy="${CONFIG.WHEEL.CENTER_Y}" r="25" fill="${colors.center}" />`;
    svgContent += `
      <text 
        x="${CONFIG.WHEEL.CENTER_X}" 
        y="${CONFIG.WHEEL.CENTER_Y}" 
        fill="${colors.centerText}" 
        font-size="14" 
        font-weight="bold" 
        text-anchor="middle"
        dominant-baseline="middle"
      >
        EZ
      </text>
    `;

    svg.html(svgContent);
  }

  // Người trúng do máy chủ chọn ngẫu nhiên; ở đây chỉ quay tới đúng ô của người đó
  function performSpin(winner) {
    isSpinning = true;
    $("#ez-spin-btn").css("pointer-events", "none");
    $(".spin-button-wrapper").addClass("spinning");

    playSpinSound();
    startStarsAnimation();

    let randomIndex = segments.findIndex((seg) => seg.id === winner.participantId);
    if (randomIndex === -1) {
      // Danh sách vừa đổi ở máy khác: thêm người trúng vào vòng quay rồi quay tới
      segments.splice(randomInt(segments.length + 1), 0, { id: winner.participantId, name: winner.name });
      segments.forEach((seg, i) => (seg.type = i % 2 === 0 ? 1 : 2));
      totalSegments = segments.length;
      drawWheel(segments);
      randomIndex = segments.findIndex((seg) => seg.id === winner.participantId);
    }

    selectedWinner = winner;

    const segmentAngle = 360 / segments.length;
    const segmentMiddle = randomIndex * segmentAngle + segmentAngle / 2;
    const spinAngle = CONFIG.TIMING.EXTRA_SPINS * 360 + (360 - segmentMiddle);

    $(".custom-wheel").css({
      transform: `rotate(${spinAngle}deg)`,
      transition: `transform ${CONFIG.TIMING.SPIN_DURATION / 1000}s ${
        CONFIG.TIMING.EASING
      }`,
    });

    setTimeout(() => {
      isSpinning = false;
      $("#ez-spin-btn").css("pointer-events", "auto");
      $(".spin-button-wrapper").removeClass("spinning");

      stopStarsAnimation();

      const finalAngle = (360 - segmentMiddle) % 360;
      $(".custom-wheel").css({
        transform: `rotate(${finalAngle}deg)`,
        transition: "none",
      });

      $(".custom-wheel")[0].offsetHeight; // Force reflow

      setTimeout(() => {
        showSpinResult();
      }, CONFIG.TIMING.MODAL_DELAY);
    }, CONFIG.TIMING.SPIN_DURATION);
  }

  function showSpinResult() {
    $("#prize-text").text(selectedWinner.name);

    // Giải thưởng: hình + tên (hiện cùng tên người trúng)
    const prize = selectedWinner.prize;
    $("#prize-award-name").text(prize ? prize.name : "");
    if (prize && prize.imageId) {
      $("#prize-award-image").attr("src", Api.imageUrl(prize.imageId)).removeClass("d-none");
    } else {
      $("#prize-award-image").addClass("d-none").attr("src", "");
    }
    $("#prize-award").toggleClass("d-none", !prize);

    playVictorySound();

    // Show modal
    $("#congratsModal").addClass("modal-zoom-in");
    $("#congratsModal").modal("show");
    createConfetti();

    setTimeout(() => {
      $("#congratsModal").removeClass("modal-zoom-in");
    }, 600);

    // Vẽ lại vòng quay không còn người vừa trúng
    initializeWheel();
    renderPrizeBar();
    if (pendingRefresh) {
      pendingRefresh = false;
      refreshState(false);
    }
  }

  // Animation

  // Dữ liệu Lottie nạp sẵn từ images/<name>.js (bản sao mới mỗi lần vì lottie
  // sửa trực tiếp vào object khi chạy)
  function getLottieData(name) {
    const data = window.LOTTIE_DATA && window.LOTTIE_DATA[name];
    if (!data) throw new Error("Thiếu file images/" + name + ".js");
    return JSON.parse(JSON.stringify(data));
  }

  function startStarsAnimation() {
    const starsContainer = $(`
      <div id="lottie-stars" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 1000;
      "></div>
    `);

    $("body").append(starsContainer);

    if (typeof lottie !== "undefined") {
      try {
        starsAnimation = lottie.loadAnimation({
          container: document.getElementById("lottie-stars"),
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: getLottieData("stars"),
        });
        console.log("Stars animation started");
      } catch (error) {
        console.error("Error loading stars animation:", error);
        createCSSStars();
        starsContainer.remove();
      }
    } else {
      console.log("Lottie not loaded, using CSS stars fallback");
      createCSSStars();
      starsContainer.remove();
    }
  }

  function stopStarsAnimation() {
    if (starsAnimation) {
      starsAnimation.destroy();
      starsAnimation = null;
    }

    $("#lottie-stars").fadeOut(500, function () {
      $(this).remove();
    });

    $(".css-star").fadeOut(500, function () {
      $(this).remove();
    });

    console.log("Stars animation stopped");
  }

  function createCSSStars() {
    const colors = CONFIG.ANIMATION.STAR_COLORS;

    for (let i = 0; i < CONFIG.ANIMATION.STAR_COUNT; i++) {
      const star = $("<div>")
        .addClass("css-star")
        .css({
          position: "fixed",
          left: Math.random() * window.innerWidth + "px",
          top: Math.random() * window.innerHeight + "px",
          width: Math.random() * 20 + 10 + "px",
          height: Math.random() * 20 + 10 + "px",
          backgroundColor: colors[Math.floor(Math.random() * colors.length)],
          zIndex: 1000,
          borderRadius: "50%",
          animation: `starTwinkle ${
            Math.random() * 2 + 1
          }s ease-in-out infinite alternate, starFloat ${
            Math.random() * 4 + 3
          }s ease-in-out infinite`,
          boxShadow: `0 0 ${Math.random() * 20 + 10}px currentColor`,
        });

      star.html("★").css({
        color: colors[Math.floor(Math.random() * colors.length)],
        fontSize: Math.random() * 15 + 10 + "px",
        textAlign: "center",
        lineHeight: star.css("height"),
        textShadow: "0 0 10px currentColor",
      });

      $("body").append(star);
    }
  }

  function createConfetti() {
    const lottieContainer = $(`
      <div id="lottie-confetti" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 9999;
      "></div>
    `);

    $("body").append(lottieContainer);

    let animation = null;
    if (typeof lottie !== "undefined") {
      try {
        animation = lottie.loadAnimation({
          container: document.getElementById("lottie-confetti"),
          renderer: "svg",
          loop: false,
          autoplay: true,
          animationData: getLottieData("confetti"),
        });
      } catch (error) {
        console.error("Error loading confetti animation:", error);
      }
    }

    if (animation) {
      animation.addEventListener("complete", function () {
        setTimeout(() => lottieContainer.remove(), 500);
      });

      setTimeout(() => {
        if (document.getElementById("lottie-confetti")) {
          lottieContainer.remove();
        }
      }, 5000);
    } else {
      console.log("Lottie not loaded, using CSS fallback");
      createCSSConfetti();
      lottieContainer.remove();
    }
  }

  function createCSSConfetti() {
    const colors = CONFIG.ANIMATION.CONFETTI_COLORS;

    for (let i = 0; i < CONFIG.ANIMATION.CONFETTI_COUNT; i++) {
      const confetti = $("<div>").css({
        position: "fixed",
        left: Math.random() * window.innerWidth + "px",
        top: "-10px",
        width: Math.random() * 8 + 4 + "px",
        height: Math.random() * 8 + 4 + "px",
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
        zIndex: 9999,
        borderRadius: "2px",
        animation: `confettiFall ${Math.random() * 3 + 2}s ease-in-out ${
          Math.random() * 3
        }s forwards`,
      });

      $("body").append(confetti);

      setTimeout(() => confetti.remove(), 6000);
    }
  }

  // utility
  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Interactive Text Animation
  function initInteractiveText() {
    const select = (e) => document.querySelector(e);
    const selectAll = (e) => document.querySelectorAll(e);

    const stage = select(".stage");
    if (!stage) return null;
    // Không tải được GSAP/SplitText (ví dụ mất mạng) -> bỏ qua hiệu ứng chữ
    if (typeof gsap === "undefined" || typeof SplitText === "undefined") {
      return null;
    }

    const weightInit = 600;
    const weightTarget = 400;
    const weightDiff = weightInit - weightTarget;
    const stretchInit = 150;
    const stretchTarget = 80;
    const stretchDiff = stretchInit - stretchTarget;
    const maxYScale = 2.5;
    const body = document.body;

    let mySplitText = new SplitText(".txt", {
      type: "chars",
      charsClass: "char",
      position: "relative",
    });
    let chars = selectAll(".char");
    let txt = select(".txt");

    if (!chars || chars.length === 0) return null;

    let numChars = chars.length;
    let isMouseDown = false;
    let letters = selectAll(".char");
    let mouseInitialY = 0;
    let mouseFinalY = 0;
    let distY = 0;
    let charIndexSelected = 0;
    let charH = 0;
    let elasticDropOff = 0.2;
    let dragYScale = 0;
    let charSelected = null;

    function init() {
      resize();

      // KHÔNG set autoAlpha ở đây để tránh text hiển thị sớm
      gsap.set(chars, {
        transformOrigin: "center center",
      });
      // Không gọi animInTxt() ngay, sẽ gọi từ bên ngoài
    }

    function animInTxt() {
      let elem = document.querySelector(".char");
      if (!elem) return;
      let rect = elem.getBoundingClientRect();

      // Hiển thị text trước khi animation
      gsap.set(stage, { autoAlpha: 1 });
      $(".txt").css("visibility", "visible");
      $(".txt").css("opacity", 1);

      gsap.from(chars, {
        y: () => {
          return -1 * (rect.y + charH + 0);
        },
        fontWeight: weightTarget,
        fontStretch: stretchTarget,
        scaleY: 1,
        ease: "elastic(0.15, 0.1)",
        duration: 0.8,
        delay: 0.1,
        stagger: {
          each: 0.02,
          from: "random",
        },
        onComplete: initEvents,
      });
    }

    function initEvents() {
      body.onmouseup = function (e) {
        if (isMouseDown) {
          mouseFinalY = e.clientY;
          isMouseDown = false;
          snapBackText();
          body.classList.remove("grab");
        }
      };

      body.onmousemove = function (e) {
        if (isMouseDown) {
          mouseFinalY = e.clientY;
          calcDist();
          setFontDragDimensions();
        }
      };

      body.addEventListener("mouseleave", onMouseLeave);

      chars.forEach((char, index) => {
        char.addEventListener("mousedown", function (e) {
          mouseInitialY = e.clientY;
          charIndexSelected = index;
          charSelected = e.target;
          isMouseDown = true;
          body.classList.add("grab");
        });
      });
    }

    function onMouseLeave(event) {
      if (
        event.clientY <= 0 ||
        event.clientX <= 0 ||
        event.clientX >= window.innerWidth ||
        event.clientY >= window.innerHeight
      ) {
        snapBackText();
        isMouseDown = false;
      }
    }

    function calcDist() {
      let maxYDragDist = charH * (maxYScale - 1);
      distY = mouseInitialY - mouseFinalY;
      dragYScale = distY / maxYDragDist;
      if (dragYScale > maxYScale - 1) {
        dragYScale = maxYScale - 1;
      } else if (dragYScale < -0.5) {
        dragYScale = -0.5;
      }
    }

    function setFontDragDimensions() {
      gsap.to(chars, {
        y: (index, target) => {
          let fracDispersion = calcfracDispersion(index);
          return fracDispersion * -50;
        },
        fontWeight: (index, target) => {
          let fracDispersion = calcfracDispersion(index);
          return weightInit - fracDispersion * weightDiff;
        },
        fontStretch: (index, target) => {
          let fracDispersion = calcfracDispersion(index);
          return stretchInit - fracDispersion * stretchDiff;
        },
        scaleY: (index, target) => {
          let fracDispersion = calcfracDispersion(index);
          let scaleY = 1 + fracDispersion;
          if (scaleY < 0.5) scaleY = 0.5;
          return scaleY;
        },
        ease: "power4",
        duration: 0.6,
      });
    }

    function calcfracDispersion(index) {
      let dispersion =
        1 - Math.abs(index - charIndexSelected) / (numChars * elasticDropOff);
      return dispersion * dragYScale;
    }

    function snapBackText() {
      gsap.to(chars, {
        y: 0,
        fontWeight: weightInit,
        fontStretch: stretchInit,
        scale: 1,
        ease: "elastic(0.35, 0.1)",
        duration: 1,
        stagger: {
          each: 0.02,
          from: charIndexSelected,
        },
      });
    }

    function autoPlayEffect(count = 0) {
      if (count >= 3) return; // Chạy 3 lần

      // Chọn ngẫu nhiên một ký tự
      const randomCharIndex = Math.floor(Math.random() * numChars);
      charIndexSelected = randomCharIndex;

      // Tạo hiệu ứng kéo ngẫu nhiên
      const randomDragScale = Math.random() * 1.5 + 0.5; // Random từ 0.5 đến 2
      dragYScale = randomDragScale;

      // Áp dụng hiệu ứng (fontWeight + text-stroke)
      gsap.to(chars, {
        fontWeight: (index, target) => {
          let fracDispersion = calcfracDispersion(index);
          return weightInit - fracDispersion * weightDiff;
        },
        webkitTextStroke: (index, target) => {
          let strokeWidth = 0.05;
          return `${strokeWidth}rem #ffeb60`;
        },
        ease: "power4",
        duration: 0.6,
        onComplete: () => {
          gsap.to(chars, {
            fontWeight: weightInit,
            webkitTextStroke: "0",
            ease: "elastic(0.35, 0.1)",
            duration: 1,
            stagger: {
              each: 0.02,
              from: randomCharIndex,
            },
            onComplete: () => {
              // Chạy lần tiếp theo sau 0.5s
              setTimeout(() => {
                autoPlayEffect(count + 1);
              }, 100);
            },
          });
        },
      });
    }

    function resize() {
      charH = txt.offsetHeight;
    }

    init();

    window.addEventListener("resize", resize);

    // Trả về function để có thể gọi từ bên ngoài
    return {
      autoPlay: autoPlayEffect,
      startAnimation: animInTxt, // Thêm function để start animation
      getAnimationDuration: () => {
        return 200 + 800 + numChars * 20;
      },
      cleanup: () => {
        window.removeEventListener("resize", resize);
        body.removeEventListener("mouseleave", onMouseLeave);
        body.onmouseup = null;
        body.onmousemove = null;
        if (mySplitText) {
          mySplitText.revert();
        }
      },
    };
  }

  // Initialize interactive text when modal is shown
  $("#congratsModal").on("shown.bs.modal", function () {
    $("#prize-container").css({ opacity: 0, visibility: "hidden" });
    $("#modal-buttons").css({ opacity: 0, visibility: "hidden" });

    // Clean up previous SplitText instance if exists
    if (currentSplitText) {
      currentSplitText.cleanup();
      currentSplitText = null;
    }

    const textAnimation = initInteractiveText();
    currentSplitText = textAnimation;

    if (textAnimation) {
      const animDuration = textAnimation.getAnimationDuration();

      // Bắt đầu animation text ngay lập tức
      textAnimation.startAnimation();

      setTimeout(() => {
        textAnimation.autoPlay();
      }, 100);

      setTimeout(() => {
        $("#prize-container").css("visibility", "visible");
        $("#prize-container").animate({ opacity: 1 }, 200);
      }, animDuration - 500); // Đợi animation hoàn thành + 0.5s

      setTimeout(() => {
        $("#modal-buttons").css("visibility", "visible");
        $("#modal-buttons").animate({ opacity: 1 }, 500);
      }, animDuration + 1500); // Đợi thêm 1s sau khi tên xuất hiện
    } else {
      // Fallback: không có hiệu ứng chữ -> hiện ngay lời chúc, tên và nút
      $(".txt").css({ opacity: 1, visibility: "visible" });
      $("#prize-container").css({ opacity: 1, visibility: "visible" });
      $("#modal-buttons").css({ opacity: 1, visibility: "visible" });
    }
  });

  // Reset khi modal đóng
  $("#congratsModal").on("hidden.bs.modal", function () {
    // Clean up SplitText instance
    if (currentSplitText) {
      currentSplitText.cleanup();
      currentSplitText = null;
    }

    const hasGsap = typeof gsap !== "undefined";

    // Kill all GSAP animations on text elements
    if (hasGsap) {
      gsap.killTweensOf(".char");
      gsap.killTweensOf(".txt");
      gsap.killTweensOf(".stage");
    }

    // Reset all styles
    $("#prize-container").css({ opacity: 0, visibility: "hidden" });
    $("#modal-buttons").css({ opacity: 0, visibility: "hidden" });
    $(".txt").css({ opacity: 0, visibility: "hidden" });

    // Reset text content to original state
    const txtElement = document.querySelector(".txt");
    if (txtElement) {
      txtElement.innerHTML = "Chúc mừng bạn đã trúng thưởng";
      if (hasGsap) gsap.set(txtElement, { clearProps: "all" });
      $(txtElement).css({ opacity: 0, visibility: "hidden" });
    }
  });
});
