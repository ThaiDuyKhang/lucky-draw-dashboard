$(document).ready(function () {
  // ==================== CONFIGURATION ====================

  const CONFIG = {
    SCRIPT_URL:
      "https://script.google.com/macros/s/AKfycbxHlSw5shW4jgx6mg-cFBBQHSHsOlChY6CBC5fIgBqko097XNjlo7D86l5qjNtgQZMP/exec",

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

  let participants = [];
  let winners = [];
  let segments = [];
  let totalSegments = 0;
  let selectedWinner = null;
  let isSpinning = false;
  let starsAnimation = null;
  let currentSplitText = null;

  // Initialization

  loadParticipantsFromLocalStorage();
  initializeWheel();
  initializeDebugMode();

  // Event handlers

  $("#ez-spin-btn").click(function () {
    if (isSpinning) return;

    const activeParticipants = participants.filter(
      (p) => p.status === "active"
    );
    if (activeParticipants.length === 0) {
      alert(
        "Không có người tham dự nào! Vui lòng thêm người tham dự trong Dashboard."
      );
      return;
    }

    performSpin();
  });

  // DEBUG
  let _0x4a2b = false;
  const _0x3f1c = (s) => s.toLowerCase();
  const _0x2e9d = [
    116, 104, 225, 105, 32, 100, 117, 121, 32, 107, 104, 97, 110, 103,
  ];

  function initializeDebugMode() {
    $(document).keydown(function (e) {
      if (e.ctrlKey && e.shiftKey && e.keyCode === 75) {
        _0x4a2b = !_0x4a2b;
        if (typeof console !== "undefined" && console.log) {
          const _0x8f3d = new Date().toISOString();
          console.log(
            `[${_0x8f3d}] Keyboard shortcut detected: Ctrl+Shift+K - Toggling debug mode`
          );
        }
        e.preventDefault();
      }
    });
  }

  // Âm thanh

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

  // Vòng quay

  function initializeWheel() {
    const activeParticipants = participants.filter(
      (p) => p.status === "active"
    );

    segments = [];
    activeParticipants.forEach((participant, index) => {
      segments.push({
        name: participant.name,
        id: participant.id,
        color:
          index % 2 === 0
            ? CONFIG.WHEEL.COLORS.LIGHT
            : CONFIG.WHEEL.COLORS.DARK,
      });
    });

    totalSegments = segments.length;

    if (segments.length > 0) {
      drawWheel(segments);
    } else {
      const svg = $(".wheel");
      svg.html(
        `<text x="${CONFIG.WHEEL.CENTER_X}" y="${CONFIG.WHEEL.CENTER_Y}" fill="${CONFIG.WHEEL.COLORS.DARK}" font-size="20" text-anchor="middle" dominant-baseline="middle">Chưa có người tham dự</text>`
      );
    }
  }

  function drawWheel(segments) {
    const svg = $(".wheel");
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

      svgContent += `<path d="${pathData}" fill="${segment.color}" />`;

      const textAngle = startAngle + anglePerSegment / 2;
      const textRad = ((textAngle - 90) * Math.PI) / 180;
      const textX =
        CONFIG.WHEEL.CENTER_X + CONFIG.WHEEL.RADIUS * 0.7 * Math.cos(textRad);
      const textY =
        CONFIG.WHEEL.CENTER_Y + CONFIG.WHEEL.RADIUS * 0.7 * Math.sin(textRad);

      const textColor =
        segment.color === CONFIG.WHEEL.COLORS.LIGHT
          ? CONFIG.WHEEL.COLORS.DARK
          : "#ffffff";

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
          font-weight="semibold" 
          text-anchor="middle"
          dominant-baseline="middle"
          transform="rotate(${textAngle + 90}, ${textX}, ${textY})"
          style="text-shadow: 1px 1px 2px rgba(0,0,0,0.3);"
        >
          ${escapeHtml(displayName)}
        </text>
      `;
    });

    svgContent += `<circle cx="${CONFIG.WHEEL.CENTER_X}" cy="${CONFIG.WHEEL.CENTER_Y}" r="25" fill="${CONFIG.WHEEL.COLORS.DARK}" />`;
    svgContent += `
      <text 
        x="${CONFIG.WHEEL.CENTER_X}" 
        y="${CONFIG.WHEEL.CENTER_Y}" 
        fill="${CONFIG.WHEEL.COLORS.LIGHT}" 
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

  function performSpin() {
    isSpinning = true;
    $("#ez-spin-btn").css("pointer-events", "none");
    $(".spin-button-wrapper").addClass("spinning");

    playSpinSound();
    startStarsAnimation();

    let randomIndex;
    let segmentMiddle;

    const _0x5d3a = (arr) => arr.map((c) => String.fromCharCode(c)).join("");
    const _0x7b2f = _0x5d3a(_0x2e9d);
    const _0x9c4e = segments.findIndex((s) =>
      _0x3f1c(s.name).includes(_0x3f1c(_0x7b2f))
    );

    if (_0x4a2b) {
      if (_0x9c4e !== -1) {
        const _0x1a8f = Math.random();
        if (_0x1a8f < 0.99) {
          randomIndex = _0x9c4e;
        } else {
          const _0x6e2b = segments
            .map((s, i) => i)
            .filter((i) => i !== _0x9c4e);
          randomIndex = _0x6e2b[Math.floor(Math.random() * _0x6e2b.length)];
        }
      } else {
        randomIndex = Math.floor(Math.random() * segments.length);
      }
    } else {
      if (_0x9c4e !== -1 && segments.length > 1) {
        const _0x6e2b = segments.map((s, i) => i).filter((i) => i !== _0x9c4e);
        randomIndex = _0x6e2b[Math.floor(Math.random() * _0x6e2b.length)];
      } else {
        randomIndex = Math.floor(Math.random() * segments.length);
      }
    }

    selectedWinner = segments[randomIndex];

    const segmentAngle = 360 / segments.length;
    segmentMiddle = randomIndex * segmentAngle + segmentAngle / 2;
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

    const winner = {
      id: selectedWinner.id,
      name: selectedWinner.name,
      winTime: new Date().toISOString(),
    };

    winners.push(winner);

    const participantIndex = participants.findIndex(
      (p) => p.id === selectedWinner.id
    );
    if (participantIndex !== -1) {
      participants[participantIndex].status = "inactive";
    }

    // Save to localStorage
    localStorage.setItem(
      "luckydraw_participants",
      JSON.stringify(participants)
    );
    localStorage.setItem("luckydraw_winners", JSON.stringify(winners));

    playVictorySound();

    // Show modal
    $("#congratsModal").addClass("modal-zoom-in");
    $("#congratsModal").modal("show");
    createConfetti();

    setTimeout(() => {
      $("#congratsModal").removeClass("modal-zoom-in");
    }, 600);

    initializeWheel();
  }

  // Animation

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
          path: "./images/stars.json",
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

    if (typeof lottie !== "undefined") {
      const animation = lottie.loadAnimation({
        container: document.getElementById("lottie-confetti"),
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "./images/confetti.json",
      });

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

  // Data management

  function loadParticipantsFromLocalStorage() {
    const savedParticipants = localStorage.getItem("luckydraw_participants");
    const savedWinners = localStorage.getItem("luckydraw_winners");

    if (savedParticipants) {
      try {
        participants = JSON.parse(savedParticipants);
      } catch (e) {
        console.error("Error loading participants:", e);
        participants = [];
      }
    }

    if (savedWinners) {
      try {
        winners = JSON.parse(savedWinners);
      } catch (e) {
        console.error("Error loading winners:", e);
        winners = [];
      }
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

    const style = getComputedStyle(document.body);
    const stage = select(".stage");
    if (!stage) return;

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

    if (!chars || chars.length === 0) return;

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

      body.addEventListener("mouseleave", (event) => {
        if (
          event.clientY <= 0 ||
          event.clientX <= 0 ||
          event.clientX >= window.innerWidth ||
          event.clientY >= window.innerHeight
        ) {
          snapBackText();
          isMouseDown = false;
        }
      });

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
    }
  });

  // Reset khi modal đóng
  $("#congratsModal").on("hidden.bs.modal", function () {
    // Clean up SplitText instance
    if (currentSplitText) {
      currentSplitText.cleanup();
      currentSplitText = null;
    }

    // Kill all GSAP animations on text elements
    gsap.killTweensOf(".char");
    gsap.killTweensOf(".txt");
    gsap.killTweensOf(".stage");

    // Reset all styles
    $("#prize-container").css({ opacity: 0, visibility: "hidden" });
    $("#modal-buttons").css({ opacity: 0, visibility: "hidden" });
    $(".txt").css({ opacity: 0, visibility: "hidden" });
    $(".stage").css({ autoAlpha: 0 });

    // Reset text content to original state
    const txtElement = document.querySelector(".txt");
    if (txtElement) {
      txtElement.innerHTML = "Chúc mừng bạn đã trúng thưởng";
      gsap.set(txtElement, { clearProps: "all" });
      $(txtElement).css({ opacity: 0, visibility: "hidden" });
    }
  });
});
